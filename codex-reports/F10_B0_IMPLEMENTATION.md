# F10-B0 — Bases técnicas de Caja: motor único, idempotencia, actor, cobros y libro mínimo

Fecha: 2026-10-09 · Entorno: TESTING únicamente (amiable-rejoicing / TESTING / DeliGO Copy / testing-codex) · Production: sin cambios.
Diseño de referencia: `codex-reports/F10_A_TECHNICAL_DESIGN.md`.

```text
F10_B0_STATUS=IMPLEMENTED_TESTING (2026-10-09; sin smoke manual obligatorio — ver §9)
F10_B1_STATUS=NOT_STARTED · F10_B2_STATUS=NOT_STARTED · F10_C_STATUS=NOT_STARTED · F10_D_STATUS=NOT_STARTED · F10_E_STATUS=NOT_STARTED
```

## 1. Objetivo y alcance

Preparar la arquitectura interna para cajeros y turnos sin habilitar todavía ninguna funcionalidad visible de etapas posteriores. Implementado:

1. **Motor único de ventas de Caja:** `src/lib/caja-venta-service.ts` → `registrarVentaCaja(db, input)`. La ruta del dueño delega en él; la futura ruta del cajero (F10-B1) deberá llamar a esta misma función.
2. **Idempotencia real del checkout** (cabecera `Idempotency-Key` + huella + unicidad por negocio).
3. **Autoría de la venta** derivada de la sesión (`actorTipo`, `actorId`, `empleadoId`).
4. **`CobroVenta`:** un cobro por venta nueva, estructura preparada para varios (D7).
5. **Libro financiero mínimo:** `CuentaFinanciera` / `OperacionFinanciera` / `MovimientoFinanciero`, usado sólo para cobros en efectivo.
6. **Cliente de Caja:** clave por intento, reintento seguro, recuperación tras recarga, aviso sin conexión (D9).

**No implementado (a propósito):**
- área `caja`, ruta y vista del cajero (F10-B1);
- cajas físicas, turnos, cierre ciego y `Venta.turnoId` (F10-B2);
- salidas de efectivo y recepciones (F10-C);
- cuentas editables, Mercado Pago, remitente y conciliación (F10-D);
- cambios de efectivo y transferencias internas (F10-E);
- pagos mixtos en la interfaz.

## 2. Archivos

Commits (rama `work/f10-b0-core-sales-idempotency`, integrados por fast-forward `f984b4c..88ff0c1`):
- `f72b0e76bc2bc266e101cba95b34ca86425c7041` docs: record F10-A technical design and approved decisions
- `3ecff2e38652d960f024e4d5ec7cdd1b9a9eb591` feat: add shared caja sale engine with idempotency, cobros and cash ledger base
- `88ff0c1e2afbb06d700412da1e4cd7ddfd34a9e7` feat: send idempotent checkout attempts from caja

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | columnas NULLables en `Venta` + 4 modelos nuevos + back-relations |
| `prisma/migrations/20261009120000_f10_b0_sales_idempotency_payments_ledger/migration.sql` | migración aditiva |
| `src/lib/caja-venta-service.ts` | **nuevo** — motor único |
| `src/lib/caja-venta.ts` | helpers puros: clave, representación canónica, estado inicial del cobro, lectura legacy |
| `src/lib/caja-checkout-attempt.ts` | **nuevo** — intento de cobro del cliente (clave, clasificación, sessionStorage) |
| `src/app/api/negocio/caja/ventas/route.ts` | delega en el motor; cabecera; replay |
| `src/components/business/caja-tab.tsx` | clave por intento, reintento, recuperación, aviso sin conexión |
| `src/lib/p2-t56-r3a-i2-wiring-static-contract.test.ts` | aserciones de Caja reubicadas al motor (sin debilitar) |
| `src/lib/p2-t56-r3a-i1-schema-migration-contract.test.ts` | "la migración I1 es la más reciente" → "las posteriores no tocan R3A y son aditivas" |
| `src/app/api/negocio/caja/ventas/route.reservations.test.ts` | mock extendido con los modelos nuevos (sin cambiar aserciones) |
| `src/app/api/negocio/caja/ventas/route.test.ts` | limpieza de fixtures: libro antes de ventas (FK NO ACTION) |
| tests nuevos | `route.idempotency.test.ts` (real DB), `caja-venta-f10b0.test.ts`, `caja-tab.checkout-idempotency.test.tsx`, `f10-b0-static-contract.test.ts` |

`prisma/migrations/migration_lock.toml` aparece sin seguimiento desde 2026-09-01 (preexistente, no tocado ni versionado).

## 3. Schema y migración (aditiva)

Migración `prisma/migrations/20261009120000_f10_b0_sales_idempotency_payments_ledger/migration.sql`:
- **`ventas_caja`:** columnas NULLables `idempotencyKey`, `idempotencyFingerprint`, `actorTipo`, `actorId`, `empleadoId` (FK a `empleados`, ON DELETE SET NULL); `UNIQUE (negocioId, idempotencyKey)` (los NULL no colisionan → ventas históricas y clientes legacy intactos); índice por `empleadoId`.
- **Tablas nuevas:** `cobros_venta`, `cuentas_financieras` (`UNIQUE (negocioId, clave)`), `operaciones_financieras` (`cobroVentaId` UNIQUE = a lo sumo una operación por cobro; `revierteOperacionId` UNIQUE = a lo sumo una reversión; `UNIQUE (negocioId, idempotencyKey)` para operaciones manuales futuras), `movimientos_financieros` (`UNIQUE (operacionId, cuentaId)`).
- **Integridad referencial:**
  - el cobro cuelga de la venta (CASCADE, igual que `VentaItem`);
  - la operación apunta al cobro con NO ACTION: una venta con registro financiero **no puede borrarse sola**, pero borrar un negocio completo sigue funcionando;
  - las patas cuelgan de su operación (CASCADE);
  - la cuenta no se borra mientras tenga patas (NO ACTION).
- **Sin** DROP, ALTER COLUMN, UPDATE, DELETE ni backfill. Las ventas históricas quedan sin cobros y se leen con `resolveCobrosVenta` (un cobro legacy derivado de `metodoPago`, nunca persistido).
- **`turnoId` diferido a F10-B2:** se agregará con su FK cuando exista `TurnoCaja`, en vez de crear hoy una referencia a un modelo inexistente.
- **Aplicación en TESTING:** `prisma migrate deploy` con verificación previa de la huella de la base (`d64be28f676e`) y `migrate status` (sólo pendiente esta migración); luego `Database schema is up to date`. El deploy posterior no encontró migraciones pendientes nuevas.
- **Bloqueos:** ADD COLUMN NULL sin default (sólo metadatos); índices y FK sobre tablas chicas cuyas columnas nuevas son todas NULL.

## 4. Motor único y garantías conservadas

`registrarVentaCaja` contiene, sin cambios, el núcleo que estaba en la ruta:
- lectura de productos y variantes acotada al negocio de la sesión;
- precios y total recalculados por el servidor (`computeSaleFromAuthoritativeProducts`);
- plan de stock R3A por clave agregada contra el disponible, **antes** de crear la venta (`planificarStockVentaCaja`);
- escritura de stock y `MovimientoInventario` VENTA vía `registrarStockVentaCaja`;
- todo en **una** transacción Serializable con el reintento acotado compartido (`runStockSerializable`).

La ruta conserva la autenticación, la validación del cuerpo y el mapeo de errores de siempre (mismo mensaje ante P2034/deadlock, `mapStockLifecycleError`, 500). Sumó la lectura de la cabecera y el replay (200 + `Idempotency-Replayed: true`, sin nueva auditoría). El `GET` y sus estadísticas no cambiaron: siguen leyendo `Venta.metodoPago`, así que los cobros nuevos no duplican totales.

**Contrato R3A reubicado (no debilitado):** `p2-t56-r3a-i2-wiring-static-contract.test.ts` verificaba esas cadenas literales en la ruta. Ahora:
- verifica exactamente las mismas cadenas en el motor, que es el llamador de `runStockSerializable` en la lista exacta;
- exige además que la ruta delegue en `registrarVentaCaja` y no contenga `runStockSerializable`, `planificarStockVentaCaja`, `registrarStockVentaCaja` ni `venta.create`;
- extiende la prohibición de leer `ReservaStock`, el modo o escribir `stockCantidad` a ruta y motor.

## 5. Idempotencia

- **Formato:** UUID (mismo patrón que `POST /api/pedidos`). Huella = sha256(negocioId + representación canónica de `metodoPago` + líneas, sin importar el orden).
- **Dentro de la transacción, antes de validar nada:**
  - si la clave ya existe con la misma huella → **replay** de la venta original, sin escribir nada;
  - si la huella difiere → **409 `IDEMPOTENCY_KEY_REUSED`**.
- **Carreras:** si dos solicitudes con la misma clave compiten, la segunda recibe la violación de unicidad (o un conflicto de serialización reintentado) y termina devolviendo la venta ganadora: **una sola venta**.
- **Falla antes del commit** (por ejemplo stock 409): no queda venta, cobro, libro ni movimiento, y la clave **no** se consume.
- **Convivencia:** la ruta del dueño acepta todavía solicitudes **sin** cabecera, con la semántica legacy (sin deduplicación); la interfaz actual siempre la envía. Una cabecera mal formada → 400. La ruta del cajero (F10-B1) deberá exigirla desde su primera versión. La obligatoriedad en la ruta del dueño puede activarse cuando no queden clientes sin actualizar.
- **Cliente** (`src/lib/caja-checkout-attempt.ts` + `caja-tab.tsx`):
  - la clave queda atada al contenido exacto;
  - sin respuesta o con 5xx = **incierto** → se conserva el intento y el reintento usa la **misma** clave;
  - un 4xx definitivo o una clave reutilizada → se descarta el intento;
  - el intento se guarda en `sessionStorage` desde que se envía hasta tener una respuesta definitiva, así que tras recargar se restauran carrito y clave con un aviso ("Hay un cobro sin confirmar") y la opción "Descartar este intento";
  - sin conexión no se envía nada y se informa que la venta **no** se registró;
  - no hay colas ni reenvíos automáticos.

## 6. Actor, cobros y libro

- **Actor:**
  - dueño → `actorTipo=NEGOCIO`, `actorId=negocioId`, `empleadoId=NULL`;
  - el cuerpo **no** puede elegir el actor;
  - el motor acepta `EMPLEADO` sólo si el empleado es activo **del mismo negocio** (defensa para F10-B1; probado con un empleado ajeno → 403);
  - ventas históricas: actor NULL.
- **Cobro:** uno por venta nueva, con `metodo`, `importe` = total y `estadoConciliacion`. TRANSFERENCIA nace **DECLARADO**: lo declarado por quien vendió, **no** una acreditación verificada. EFECTIVO/OTRO: NO_APLICA. Remitente, referencia, comprobante, cuenta de destino y verificación llegan en F10-D.
- **Libro:**
  - sólo EFECTIVO genera una operación `VENTA_COBRO` con una pata `+total` en la cuenta de sistema `efectivo_caja_sin_asignar`;
  - la cuenta se crea fuera de la transacción con INSERT … ON CONFLICT DO NOTHING, sin carreras;
  - TRANSFERENCIA/OTRO no generan movimiento y no existe cuenta de Mercado Pago ni saldo alguno.
- **Punto de inicio del libro:** el primer cobro en efectivo registrado después del deploy de F10-B0. Su saldo **no** reconstruye el efectivo histórico, **no** es el saldo de un cajón concreto y **no** incluye fondos iniciales no declarados.
- **Reversiones futuras:** operaciones compensatorias (`revierteOperacionId`, como máximo una por operación). No existe ruta para editar importes.

## 7. Pruebas

Nuevos — **36 pass / 0 fail**:

| Archivo | Resultado | Cubre |
|---|---|---|
| `route.idempotency.test.ts` (real DB TESTING) | 11/0 | A primer intento (venta + cobro + operación + pata + stock + movimiento una vez, actor de la sesión, cuerpo que intenta suplantar actor y precio ignorado) · B/E replay sin escrituras (incluido orden de líneas distinto) · C misma clave con otro contenido → 409 · **D 6 solicitudes concurrentes con la misma clave → 1×201 + 5×200, una sola venta, un cobro, una pata, stock una vez** · F falla antes del commit sin residuos y clave no consumida · transferencia/otro sin libro ni cuenta de MP · sin control de stock + variante · legacy sin cabecera + cabecera inválida → 400 · aislamiento (misma clave en dos negocios, producto ajeno → 400, cuentas separadas) · empleado ajeno → 403 · venta con libro no borrable sola |
| `caja-venta-f10b0.test.ts` | 10/0 | formato de clave, representación canónica, huella por negocio, DECLARADO vs NO_APLICA, lectura legacy, clasificación de respuestas, reutilización de clave, sessionStorage |
| `caja-tab.checkout-idempotency.test.tsx` (happy-dom, CajaTab real) | 6/0 | cabecera UUID, reintento tras error de red con la misma clave, carrito cambiado → clave nueva, recuperación tras recarga + descartar, 409 de clave reutilizada / stock, sin conexión no envía |
| `f10-b0-static-contract.test.ts` | 9/0 | motor único (sólo él crea Venta / CobroVenta / operaciones / cuentas), actor sólo de la sesión, libro sólo efectivo sin MP, estadísticas desde Venta, sin área/ruta/página de cajero, sin turnos ni `turnoId`, un solo medio, migración aditiva |

Regresiones dirigidas (cada archivo en su propio proceso, secuencial, sin pruebas reales en paralelo) — **43 archivos, 695 pass / 0 fail** tras dos correcciones:
- Caja: `route.test.ts` 21/0 (real DB), `route.reservations` 14/0, `caja-venta` 27/0, `caja-tab.scanner` (F9) 7/0, contrato responsive.
- Pedidos (`route.test`, `route.stock-mode`, `route.variantes`, rate-limit), Inventario (movimientos real DB y reservas), Mozo/PyR/Salón (pedidos, push), F9 (contrato, barcode, scanner, Inventario, unicidad real DB, catálogo).
- R3A: stock-lifecycle, i3, i4, autoridad, controlador i5p0, ops, contratos I1/I2/I4/I5-P0/P0-F1, timeout de mesa.
- `proxy.test`, gating del panel.

**Las dos correcciones:**
1. El test F9 de Caja simula `fetch` con respuestas sin `headers`. El cliente nuevo leía `res.headers.get` y fallaba tras una venta exitosa (el intento quedaba guardado y se filtraba al test siguiente). Se corrigió el **cliente** (`res.headers?.get?.`); el test F9 no se modificó.
2. El contrato I1 exigía que su migración fuera "la más reciente", algo que sólo podía valer hasta la siguiente migración. Se generalizó sin perder la intención: la migración I1 sigue presente y toda migración posterior no toca objetos de R3A y es aditiva.

Las 9 fallas baseline CRLF conocidas de contratos de UI (copia Windows) no pertenecen a este conjunto dirigido.

## 8. Gates

| Gate | Resultado |
|---|---|
| Tests F10-B0 nuevos | 36/0 |
| Regresiones dirigidas | 695 pass / 0 fail (43 archivos) |
| Pruebas con base real (TESTING, huella d64be28f676e) | idempotencia/cobro/libro 11/0 + Caja 21/0 + Inventario + unicidad F9 + pedidos, sin residuos (`test-f10b0-*` = 0) |
| TypeScript | 0 errores |
| ESLint (archivos cambiados + tests) | limpio |
| `prisma validate` / `generate` | válido / generado |
| `next build` | OK (compiled, 160/160) |
| `git diff --check` | limpio |
| SQL de la migración | sólo CREATE TABLE / CREATE INDEX / ADD COLUMN / ADD CONSTRAINT sobre columnas nuevas |

## 9. Integración y deploy

- **Migración en TESTING:** aplicada antes de la integración con `prisma migrate deploy` (huella verificada); `migrate status` = al día. Después se quitó una línea en blanco final del archivo (sólo espacio en blanco) para pasar `git diff --check`. `migrate status` siguió reportando "up to date". La suma de verificación guardada en TESTING corresponde a la versión con esa línea extra; `migrate deploy` no revalida migraciones ya aplicadas.
- **Integración:** rama publicada; referencia de seguridad local `f10-b0-pre-integration-testing-codex` → `f984b4c`; fast-forward `testing-codex` `f984b4c..88ff0c1`; push sólo a `origin/testing-codex`. `main` sin cambios (`42ca500`).
- **Deploy TESTING:** `232d72cf-7e44-4786-9e91-7b4f958debf9` SUCCESS, commitHash `88ff0c1e2afbb06d700412da1e4cd7ddfd34a9e7` (coincide). Build con `bun install --frozen-lockfile`, compiled. Runtime: "No pending migrations to apply" (39), Ready, sin errores.
- **Verificación post-deploy (sólo lectura):**
  - sin sesión, `GET` y `POST /api/negocio/caja/ventas` y `/api/negocio/productos` → 401; `/negocio` → 200;
  - base: modo ON (config sin cambios), reservas ACTIVA 0 · CONSUMIDA 1 · LIBERADA 4;
  - 8 ventas históricas intactas (sin clave ni actor); tablas nuevas vacías porque no se crearon ventas reales;
  - 0 claves duplicadas, 0 cobros dobles, 0 cobros con importe distinto del total, 0 operaciones sin patas, 0 patas entre negocios, 0 operaciones de medios no efectivo, 0 movimientos VENTA duplicados, 0 stock negativo, 0 residuos de fixtures.
- **Production** `6bf1ee84` @ `42ca500`: sin cambios.
- **Smoke manual recomendado (opcional, no bloqueante):** en Caja de TESTING, una venta normal en efectivo y otra por transferencia.
  - Verificar que se registran y aparecen en Resumen como siempre.
  - Para el reintento: activar el modo avión justo al tocar "Confirmar venta", volver a conectarse y confirmar de nuevo. Debe quedar **una sola** venta y aparecer el aviso "La venta ya estaba registrada" o el registro normal.

## 10. Riesgos y limitaciones

- La convivencia sin cabecera mantiene la semántica legacy (sin deduplicación) para clientes desactualizados.
- Dinero en `Float` (como el resto de `Venta`); redondeo a centavos en el motor.
- La cuenta `efectivo_caja_sin_asignar` mezcla las ventas en efectivo del negocio hasta que existan cajas físicas (F10-B2). No representa un cajón ni el efectivo real.
- Cada venta suma dos o tres inserciones en la misma transacción Serializable. Se mantiene el follow-up conocido de contención R3A.
- La restauración del intento usa `sessionStorage` (por pestaña): si se cierra la pestaña o la PWA borra el almacenamiento, el intento se pierde; el servidor sigue impidiendo duplicados sólo si se reintenta con la misma clave.

## 11. Rollback

- **Código:** `git revert` de los commits funcionales de F10-B0 en `testing-codex`, más el deploy de TESTING. El código anterior funciona con las columnas y tablas nuevas (aditivas), así que **no** hace falta revertir la base para volver atrás.
- **Datos nuevos (por separado):**
  - las filas de `cobros_venta` / libro y las columnas nuevas de `ventas_caja` quedan como registro histórico;
  - revertir el código no las borra ni las "deshace";
  - eliminar las tablas o columnas nuevas sería una migración destructiva aparte que requiere autorización explícita y pierde ese registro;
  - las ventas con libro no pueden borrarse solas (FK NO ACTION).
- Nunca desactivar reservas ON para resolver problemas de este cambio.

## 12. Dependencias para F10-B1 y F10-B2

- **B1:**
  - área `caja` en `src/lib/area-operativa.ts` (excluida de `areaOperativaRequiereSalon`, sólo rubro "negocio");
  - ruta `POST /api/operativo/caja/[slug]/ventas` que llame a `registrarVentaCaja` con `actor: { tipo: "EMPLEADO", empleadoId }` derivado de `resolveOperativoAreaForSlug`, con idempotencia obligatoria;
  - vista móvil;
  - contratos que impidan al cajero leer `resumenHoy`.
- **B2:**
  - `CajaFisica` (una por defecto) y `TurnoCaja`;
  - `Venta.turnoId` con FK;
  - cuentas de efectivo por caja (el libro ya admite varias cuentas);
  - cierre ciego en dos fases con CAS e idempotencia.
