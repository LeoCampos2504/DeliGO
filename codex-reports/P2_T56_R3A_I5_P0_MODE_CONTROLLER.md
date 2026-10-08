# P2-T56-R3A-I5-P0 — Controlador auditado de modos y recuperación segura

```text
TASK=P2-T56-R3A-I5-P0
DATE=2026-10-08
BRANCH=work/p2-t56-r3-stock-lifecycle-i5-p0 (base testing-codex 607ac046b9168f541da96efba32439e0ddd20475)
FUNCTIONAL_COMMIT=96a93b69ad8b4a696ef171f0692837727612fa93 "feat: add audited stock reservation mode controller"
INTEGRATION=fast-forward testing-codex 607ac04..96a93b6 · SAFETY_REF=tag anotado local r3a-i5p0-pre-integration-testing-codex → 607ac04 (no publicado)
FUNCTIONAL_DEPLOY=Railway TESTING / DeliGO Copy 9e267fe5-65fc-4b36-8ccc-3100ebc09c94 SUCCESS (commit match)
R3A_I5_P0_STATUS=DEPLOYED_TESTING_MODE_OFF_AWAITING_ACTIVATION
R3A_I5_STATUS=NOT_CERTIFIED
STOCK_RESERVATION_MODE=OFF · MODE_ACTIVATED=NO · SCHEMA_CHANGED=NO · NEW_MIGRATIONS=0 · PRODUCTION_TOUCHED=NO
```

## 1. Por qué

La auditoría de I5 (2026-10-08) encontró que **ningún código escribía `ConfigPlataforma.stockReservaModo`**. A0.1-9 y A0.1-20 exigen:
- una transición auditada (CAS + AuditLog);
- `DRAINING → OFF` sólo con 0 reservas ACTIVA verificado en la misma transacción Serializable;
- `ON → OFF` prohibido;
- un script de recuperación extraordinaria (ROLLBACK), utilizable sólo en DRAINING.

A0.1-20 asignaba esto a I4, pero el I4 autorizado no lo incluyó. El operador aprobó resolverlo antes de activar ON.

## 2. Diseño implementado

Todo vive en la autoridad transaccional `src/lib/stock-lifecycle.ts`, el único módulo habilitado para tocar `stockReservaModo` y `ReservaStock` (contratos I1/I2 sin cambios). No hay un segundo sistema de reservas: la recuperación reutiliza el mismo modelo, motivos y estados.

### 2.1 Controlador de modos — `cambiarModoReservaStock(tx, request)`

```text
TRANSICIONES_PERMITIDAS=OFF→ON · ON→DRAINING · DRAINING→OFF
TRANSICIONES_RECHAZADAS=todas las demás (ON→OFF, OFF→DRAINING, DRAINING→ON, misma→misma) → STOCK_MODE_TRANSITION_FORBIDDEN, sin escribir
```

Orden dentro de `runStockSerializable` (Serializable, maxWait 5 s, timeout 15 s, reintento sólo P2034, 3 intentos; P2028 sin reintento):

1. Validación de la solicitud: actor, motivo ≥ 10 caracteres, `operationRef`, `source` y modos válidos. Si falla → `STOCK_MODE_REQUEST_INVALID`.
2. Actor: `SuperAdmin` existente y **activo**, verificado dentro de la tx. Si no → `STOCK_MODE_ACTOR_INVALID`.
3. Lectura de la fila de config (`id`, modo, `updatedAt`). Un modo persistido inválido → fail-closed (`STOCK_RESERVATION_MODE_INVALID`).
4. El modo vigente debe ser el esperado (`from`); si no → `STOCK_MODE_STALE_EXPECTED`.
5. La transición debe estar permitida.
6. Se cuentan las reservas ACTIVA **dentro de la tx**. Para `→ OFF` deben ser 0; si no → `STOCK_MODE_ACTIVE_RESERVATIONS`.
7. **CAS**: `updateMany` con `id + stockReservaModo + updatedAt`. Si no afecta exactamente 1 fila → `STOCK_MODE_CONCURRENT_CHANGE`.
8. **AuditLog en la misma tx**:
   - `userId` = SuperAdmin.id, `userType="superadmin"`;
   - `accion="stock.reserva_modo_cambiado"`, `recurso="config_plataforma"`, `recursoId` = id de config;
   - `detalle` = from, to, reason, operationRef, source, activeReservations, previousUpdatedAt y `result: "APPLIED"`.

Un rechazo nunca escribe. Una falla posterior al CAS (p. ej. del AuditLog) revierte la tx entera: **no existe un cambio de modo sin auditoría**.

**Carrera MODE vs RES (A0.1-10 #12):** el planner de pedidos lee el modo e inserta reservas en su propia tx Serializable (I2-F1). El controlador cuenta ACTIVA y actualiza el modo. SSI aborta una de las dos (P2034), y el reintento relee el estado. La certificación con concurrencia real queda para I5.

`evaluarCambioModoReservaStock` es la versión de sólo lectura (dry-run): informa el modo vigente, la transición, si está permitida, las reservas ACTIVA y todos los problemas.

### 2.2 Recuperación extraordinaria — `liberarReservasPorRollback(tx, request)`

```text
CUÁNDO=sólo con stockReservaModo=DRAINING (si no → MODE_NOT_DRAINING)
ALCANCE=IDs exactos de UN negocio (máx. 200, sin duplicados)
ELEGIBLE=reserva ACTIVA del negocio cuyo pedido (mismo negocio) está CANCELADO
EFECTO=ACTIVA → LIBERADA, motivoLiberacion="ROLLBACK", liberadaEn; AuditLog "stock.reservas_liberadas_rollback" en la misma tx
NUNCA=borrar filas · tocar stockCantidad · crear MovimientoInventario · reponer stock consumido
```

Clasificación por ID:

| Situación | Acción |
|---|---|
| ACTIVA y pedido cancelado | RELEASE |
| Ya LIBERADA (cualquier motivo) | no-op idempotente; el motivo original no se pisa |
| CONSUMIDA | rechazo |
| Pedido **pendiente** (recibido, aceptado, …) | rechazo `PEDIDO_NOT_CANCELLED_USE_NORMAL_FLOW` |
| Pedido en preparando o posterior con reserva ACTIVA (inconsistente) | rechazo |
| Otro negocio / inexistente | rechazo |

Si un solo ID se rechaza, **no se libera nada** (atómico). Una segunda ejecución sobre lo ya liberado no escribe ni audita.

### 2.3 Protección de pedidos pendientes (§5.3 del encargo)

- Liberar la reserva de un pedido pendiente lo dejaría sin protección e indistinguible de uno creado en OFF. Por eso **se rechaza**: la reserva de un pedido pendiente se resuelve por el flujo normal.
  - Cancelarlo: `aplicarEfectosCancelacion` libera con el motivo correcto.
  - Prepararlo: `transicionarAPreparandoConStock` consume y descuenta.
- La recuperación sólo cubre la anomalía «pedido cancelado con reserva todavía ACTIVA». Un pedido cancelado **no puede volver a `preparando`**:
  - los grafos de `src/lib/order-transitions.ts` sólo llegan a `preparando` desde `recibido`/`aceptado`;
  - `cancelado` es terminal (la route de estado del negocio lo rechaza explícitamente);
  - los 6 escritores de `preparando` hacen CAS desde esos estados.
- Por lo tanto, liberar esa reserva no habilita una preparación sin protección. No se introdujo ninguna política nueva de cancelación ni de reposición.

### 2.4 Comandos internos (sin endpoint ni UI)

| Comando | Uso |
|---|---|
| `scripts/stock-reservation-mode.ts` | transición de modo |
| `scripts/stock-reservation-rollback.ts` | recuperación extraordinaria |

La orquestación vive en `src/lib/stock-reservation-ops.ts`, con dependencias inyectadas (no importa la base). Toda escritura pasa por la autoridad.

Protecciones, en este orden y todas antes de escribir:
1. Argumentos estrictos: desconocidos, repetidos o sin valor → rechazo.
2. `--env` debe estar en `STOCK_RESERVATION_OPS_ENVIRONMENTS`, que **hoy sólo tiene `TESTING`**. Production no está habilitado: hace falta un cambio de código y una autorización. Si el proceso corre en Railway, `--env` debe coincidir con `RAILWAY_ENVIRONMENT_NAME`.
3. **Huella de la base**: sha256 del `system_identifier` del cluster, truncado a 12 hex. Debe coincidir con la registrada para ese entorno (TESTING = `d64be28f676e`) **y** con `--expect-db`. La huella es la misma por red interna o por proxy público, y no es un secreto.
4. Actor: `--actor-email` de **exactamente un** SuperAdmin activo; su id queda en el AuditLog y la autoridad lo revalida dentro de la tx.
5. `--reason` obligatorio y `--operation-ref` (o un UUID generado).
6. **DRY-RUN por defecto**: sin `--execute` sólo se lee y se informa.
7. Con `--execute` se exige además `--confirm` exacto: `OFF->ON` / `ON->DRAINING` / `DRAINING->OFF`, o `ROLLBACK:<n>`.

Además:
- Los scripts sólo corren como proceso principal (`if (import.meta.main)`).
- No figuran en `package.json` ni en ningún start/build/cron. Los start commands de TESTING son el servidor, `expire-review-moderation` y `cron:mesa-occupancy-expiration`.
- Ningún archivo productivo los importa.
- La salida es un JSON sin URL ni credenciales.

## 3. Tests

| Suite | Resultado |
|---|---|
| `src/lib/stock-mode-controller-i5p0.test.ts` (nueva) — matriz de transiciones, rechazos sin escritura, guarda ACTIVA en la tx, desactualizado, dos operadores, CAS perdido, actor inactivo/inexistente, solicitud inválida, modo persistido inválido, falla del AuditLog → rollback, falla del update → sin auditoría, reintento P2034 (una sola aplicación y una sola auditoría), P2028 sin reintento, mapeo 409, dry-run sin escrituras; recuperación: sólo DRAINING, liberación auditada sin stock ni borrado, idempotencia, pedido pendiente rechazado y luego consumido normalmente, flujo normal de cancelación + rollback no-op, pedido cancelado que no puede prepararse, rechazos (CONSUMIDA, preparando, otro negocio, inexistente), lote atómico, falla parcial → rollback, validación de la solicitud, dry-run | **32/0** |
| `src/lib/stock-reservation-ops.test.ts` (nueva) — parseo estricto, sólo TESTING, matriz de guardas (entorno, Railway, huella, `--expect-db`, huella no disponible), dry-run por defecto sin escrituras, actor (inexistente, ambiguo, ausente), motivo corto, transición inválida, `--execute` sin o con confirmación incorrecta, ejecución con confirmación exacta (AuditLog con origen y referencia, Serializable), salida sin credenciales, recuperación (dry-run en OFF, confirmación, guardas) | **15/0** |
| `src/lib/p2-t56-r3a-i5-p0-static-contract.test.ts` (nueva) — un único CAS de modo y sólo en el controlador; ningún otro escritor; `ROLLBACK` sólo en la recuperación; ReservaStock nunca se borra; la recuperación exige DRAINING y pedido cancelado; scripts con `import.meta.main`, imports acotados, fuera de `package.json`, sin importadores; el módulo de comandos no importa la base; sólo TESTING; dry-run antes de cualquier escritura | **10/0** |
| Regresión R3A | lifecycle 43, I3 32, I4 20, contrato I1 19, contrato I2 34, contrato I4 15 — 0 fail |
| Fake compartido | extensión aditiva (config con id/updatedAt + CAS, AuditLog, SuperAdmin, `pedido.findMany`, inyección de fallas); las suites existentes siguen pasando |

- **Mutation check** (cada archivo restaurado byte a byte): quitar la guarda ACTIVA de DRAINING→OFF → 1 falla · permitir el rollback de pedidos pendientes → 4 fallas · quitar el dry-run por defecto → 2 fallas.
- **Barrido completo por archivo** (sin base): 383 archivos, 4442 pass, 209 fail, 72 DB_ENV (= baseline). Sólo cambian los 3 archivos nuevos (todos PASS). Las fallas no-DB son las mismas 8 del baseline, que no se presentan como aprobadas.
- **Gates:** Prisma validate y generate PASS · schema sin cambios · 0 migraciones · tsc 33 = baseline (mismos archivos, 0 nuevos) · ESLint PASS · build PASS · diff-check PASS.
- **Real-DB (sólo lectura, sin cambiar el modo):** los scripts reales se ejecutaron en dry-run contra TESTING:
  - sin actor → `ACTOR_EMAIL_REQUIRED`;
  - `--env=production` → `ENV_NOT_ALLOWED`;
  - `--expect-db` equivocado → `DB_FINGERPRINT_NOT_EXPECTED`;
  - rollback con actor desconocido → `ACTOR_NOT_ACTIVE_SUPERADMIN`.
  En los cuatro casos la huella real calculada fue `d64be28f676e`. Estado antes y después idéntico: modo OFF, mismo `updatedAt` de config, ACTIVA 0, 0 auditorías del controlador.
- **Diferido a I5 (requiere cambiar el modo global, prohibido en esta etapa):**
  - transiciones persistentes reales con un SuperAdmin verdadero;
  - CAS y SSI reales contra PostgreSQL;
  - carrera MODE vs RES;
  - recuperación real en DRAINING;
  - dry-run completo con un actor válido (requiere el email del SuperAdmin del operador).
- No se re-ejecutaron suites real-DB de pedidos: creación, consumo y liberación no cambiaron y el código nuevo no está cableado a ninguna route.

## 4. Integración y deploy

```text
INTEGRATION_TYPE=FAST_FORWARD · testing-codex 607ac04..96a93b6 (1 commit, 8 archivos; UNRELATED=0; sin prisma/)
FUNCTIONAL_DEPLOY=9e267fe5-65fc-4b36-8ccc-3100ebc09c94 SUCCESS · branch testing-codex · commit 96a93b69ad8b4a696ef171f0692837727612fa93 (match)
BUILD="Compiled successfully" · RUNTIME="38 migrations found", "No pending migrations to apply", "Ready"; 0 líneas de error
HTTP_SMOKE=PASS_NO_5XX (/ 307 · /cliente 200 · /api/negocios 200 · promocionados 200 · slug inexistente 404 · APIs protegidas 401)
STOCK_MODE_BEFORE=OFF · STOCK_MODE_AFTER=OFF · ACTIVE_RESERVATIONS_BEFORE=0 · ACTIVE_RESERVATIONS_AFTER=0 · config updatedAt sin cambios · MODE_ACTIVATED=NO
PRODUCTION=origin/main 42ca500 · production/DeliGO 6bf1ee84 SUCCESS @ 42ca500 (sin cambios)
```

## 5. Riesgos y limitaciones

- La certificación real del controlador (CAS, SSI y la carrera con pedidos) recién ocurre en I5, al cambiar el modo de verdad.
- La recuperación no resuelve pedidos pendientes abandonados: el drenaje depende de que el negocio los cancele o prepare por el flujo normal. No existe vencimiento automático de pedidos (`STALE_OPEN_ORDER_EXPIRATION_POLICY` sigue como follow-up de A0.1).
- La huella de TESTING está fijada en el código. Si el cluster de TESTING se recrea, el comando se rechaza (fail-closed) hasta actualizarla con un cambio revisado.
- Habilitar Production requiere un cambio de código y una autorización explícita.
- Siguen abiertos: los follow-ups de I4 (timeouts de denuncias y superadmin-notifications, limpieza de tablas auxiliares en las suites, ocupación de mesa tras pedido rechazado, promocionados sin real-DB) y la falta de visibilidad Físico/Reservado/Disponible en Inventario (decisión 2 del plan I5).

## 6. Rollback del código

`git revert 96a93b6` en `testing-codex` y autodeploy. No hay schema ni datos que revertir: el modo nunca se cambió y no hay auditorías del controlador. Referencia: `r3a-i5p0-pre-integration-testing-codex` → `607ac04`.

## 7. Procedimiento para la siguiente fase — I5 (NO ejecutado; requiere autorización)

**Precondiciones**
- Git: `testing-codex` = HEAD esperado, árbol limpio.
- Railway: TESTING / DeliGO Copy en SUCCESS.
- Huella `d64be28f676e`.
- Modo OFF y 0 ACTIVA.
- Métricas previas tomadas.
- Email del SuperAdmin activo que firma.

**1) Dry-run de la activación** (sólo lectura; desde la carpeta del repo, con `DATABASE_URL` de TESTING en el entorno sin imprimirla, o con `railway run --environment TESTING`):

```bash
bun scripts/stock-reservation-mode.ts --env=TESTING --expect-db=d64be28f676e --from=OFF --to=ON --actor-email=<superadmin> --reason="I5: activación ON en TESTING para certificación"
```

Esperado: `DRY_RUN_NO_CHANGES`, `currentMode=OFF`, `allowed=true`, `problems=[]`.

**2) Activación** (el mismo comando + `--execute --confirm=OFF->ON --operation-ref=i5-on-<fecha>`). Esperado: `APPLIED`, `modeAfter=ON` y una fila `stock.reserva_modo_cambiado` en AuditLog.

**3) Verificación posterior:** releer el modo (ON) y el AuditLog; métricas (reservas por estado, físico y disponible de cada clave fixture, movimientos PEDIDO, pedidos, 409 por código, 5xx, P2034/P2028 en logs, tiempos).

**4) Pruebas real-DB** (plan I5 R1–R9; harness ad-hoc `test-i5-` con cleanup por ID exacto; subconjunto R9 de suites existentes): creación, consumo, cancelación, Caja, Inventario/AJUSTE, catálogo, concurrencia (stock 1×2 simple y variante, 5×10, 10×15, Caja vs pedido, preparación vs cancelación, MODE vs RES) y modos.

**5) Smoke manual del operador** (6 escenarios, con lecturas READ-ONLY de reservas que informa Claude):
1. reserva al confirmar;
2. consumo al preparar;
3. liberación al cancelar;
4. última unidad entre dos clientes;
5. Caja respetando reservas;
6. AJUSTE con advertencia real.

**6) DRAINING:**

```bash
bun scripts/stock-reservation-mode.ts --env=TESTING --expect-db=d64be28f676e --from=ON --to=DRAINING --actor-email=<superadmin> --reason="<motivo>" --execute --confirm=ON->DRAINING
```

Luego verificar que los pedidos controlados nuevos reciben 409 `STOCK_RESERVATIONS_DRAINING`, y drenar preparando o cancelando por el flujo normal.

**7) Reservas atascadas** (sólo en DRAINING y sólo si el pedido ya está cancelado):

```bash
bun scripts/stock-reservation-rollback.ts --env=TESTING --expect-db=d64be28f676e --negocio=<id> --reserva-ids=<ids> --actor-email=<superadmin> --reason="<motivo>"
```

Revisar el dry-run y luego ejecutar con `--execute --confirm=ROLLBACK:<n>`. Los pedidos pendientes se resuelven por el flujo normal.

**8) Volver a OFF** (`--from=DRAINING --to=OFF --execute --confirm=DRAINING->OFF`). Se rechaza mientras haya ACTIVA (la verificación está dentro de la tx). Nunca `ON->OFF` directo.

**9) Modo final después de certificar:** decisión 5 del plan I5 (recomendado: demostrar DRAINING→OFF y luego dejar TESTING en ON).

## 8. Estado

```text
R3A_I5_P0_STATUS=DEPLOYED_TESTING_MODE_OFF_AWAITING_ACTIVATION
R3A_I5_STATUS=NOT_CERTIFIED
STOCK_RESERVATION_MODE=OFF · MODE_ACTIVATED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_I5_ON_ACTIVATION_AUTHORIZATION
```
