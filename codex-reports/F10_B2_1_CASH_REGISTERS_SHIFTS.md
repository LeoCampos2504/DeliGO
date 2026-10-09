# F10-B2.1 — Cajas físicas, turnos y atribución financiera

Fecha: 2026-10-09 · Entorno: TESTING únicamente (amiable-rejoicing / TESTING / DeliGO Copy / testing-codex) · Production: sin cambios.
Base: `5d91732` (F10-B2.0 IMPLEMENTED_TESTING) · rama `work/f10-b2-1-physical-cash-registers-shifts`.

```text
F10_B2_1_STATUS=IMPLEMENTED_TESTING (2026-10-09; motor y API; sin interfaz; obligatoriedad NO activada)
F10_B2_2_STATUS=NOT_STARTED · F10_C_STATUS=NOT_STARTED · F10_D_STATUS=NOT_STARTED · F10_E_STATUS=NOT_STARTED
CONSUMO_INTERNO_STATUS=PLANNED_NOT_STARTED
SHIFT_ENFORCEMENT=OPCIONAL en todos los negocios (no activado; activación prevista para F10-B2.2)
```

> **No es todavía una Caja para uso real con empleados.** Falta el cierre (ciego), las diferencias y la entrega de fondos (F10-B2.2). La obligatoriedad de turno queda **desactivada** (`OPCIONAL`) en todos los negocios.

## 1. Qué se construyó

| Pieza | Estado |
|---|---|
| Modelo `CajaFisica` (varias por negocio, una predeterminada) | listo |
| Caja predeterminada "Caja principal", idempotente y concurrente | listo |
| Administración de cajas por el dueño (crear, renombrar, activar/desactivar, predeterminada) | listo (API) |
| Modelo `TurnoCaja` (responsable inequívoco, fondo inicial exacto) | listo |
| Apertura idempotente de turno (dueño y cajero) | listo (API) |
| Un turno abierto por caja / por empleado / por dueño (PostgreSQL) | listo |
| Atribución de ventas al turno del actor (motor único) | listo |
| Cuenta de efectivo por caja física + operación con turno | listo |
| Efectivo esperado exacto por turno (sólo dueño) | listo (API del dueño) |
| Flag persistido `Negocio.cajaTurnosModo` (OPCIONAL/OBLIGATORIO) + cumplimiento en ruta y motor | listo, **sin activar** y sin ruta para activarlo |
| Interfaz | **no** (etapa de motor; la PWA del cajero de F10-B1 sigue igual) |
| Cierre, cierre ciego, diferencias, entrega/traspaso de fondos, recuento | **NO** (F10-B2.2) |

## 2. Arquitectura y tablas

- **`cajas_fisicas`:** `id`, `negocioId`, `nombre`, `descripcion?`, `esPredeterminada`, `activa`, `createdAt`, `updatedAt`.
- **`turnos_caja`:**
  - identificación: `id`, `negocioId`, `cajaFisicaId`;
  - responsable: `responsableTipo` (`NEGOCIO` | `EMPLEADO`), `responsableId`, `empleadoId?`;
  - estado y fondo: `estado` (`ABIERTO`), `abiertoEn`, `fondoInicialDecimal` NUMERIC(12,2);
  - idempotencia: `idempotencyKey?`, `idempotencyFingerprint?`;
  - `createdAt`, `updatedAt`.
- **Columnas nuevas (todas NULL, sin backfill):**
  - `ventas_caja.turnoCajaId`;
  - `operaciones_financieras.turnoCajaId`;
  - `cuentas_financieras.cajaFisicaId`;
  - `negocios.cajaTurnosModo`, que es NOT NULL con default `OPCIONAL`.
- **Servicios:**
  - `src/lib/caja-turnos-service.ts`: **único escritor** de cajas y turnos;
  - `src/lib/caja-turnos-admin.ts`: **sólo dueño**, efectivo esperado y resumen del turno;
  - `src/lib/negocio-caja-auth.ts`: sesión de dueño + negocio genérico;
  - el motor único de ventas sigue siendo `registrarVentaCaja`.

## 3. Restricciones PostgreSQL (migración `20261011120000`)

| Invariante | Mecanismo |
|---|---|
| Un solo turno ABIERTO por caja | índice único parcial `turnos_caja_cajaFisicaId_abierto_key` |
| Un solo turno ABIERTO por empleado y negocio | índice único parcial `turnos_caja_empleado_abierto_key` |
| Un solo turno ABIERTO del dueño por negocio | índice único parcial `turnos_caja_negocio_responsable_abierto_key` |
| Una sola caja predeterminada activa por negocio | índice único parcial `cajas_fisicas_negocioId_predeterminada_key` |
| Nombre de caja sin ambigüedad (mayúsculas/espacios) | índice único de expresión `("negocioId", lower(btrim(nombre)))` |
| Predeterminada ⇒ activa; nombre 1..60 | CHECK |
| Responsable coherente (EMPLEADO ⇒ empleadoId = responsableId; NEGOCIO ⇒ responsableId = negocioId) | CHECK |
| Fondo inicial ≥ 0, exacto | CHECK + `DECIMAL(12,2) NOT NULL` |
| El turno y su caja son del mismo negocio | FK compuesta `(cajaFisicaId, negocioId)` → `cajas_fisicas(id, negocioId)` |
| Una cuenta de efectivo por caja | índice único parcial `cuentas_financieras_cajaFisicaId_efectivo_key` |
| Flag con valores documentados | CHECK `cajaTurnosModo IN ('OPCIONAL','OBLIGATORIO')` |
| Una caja con turnos o ventas con turno no se borran solas | FKs `ON DELETE NO ACTION` |

Los índices parciales, de expresión y los CHECK no son representables en el DSL de Prisma 6.19.2 y viven en el SQL versionado, como el índice ya existente `sesiones_ocupacion_mesa_mesaId_activa_key`. `prisma migrate diff` contra TESTING no los marca como drift.

**Limitación:** Prisma no admite relaciones opcionales compuestas que compartan un `negocioId` obligatorio. Por eso, la coherencia de negocio de `turnos_caja.empleadoId`, `ventas_caja.turnoCajaId`, `operaciones_financieras.turnoCajaId` y `cuentas_financieras.cajaFisicaId` se garantiza en los únicos escritores, dentro de su transacción y con filtros por negocio, y queda probada en real-DB y en un contrato estático. Una alternativa futura es un trigger.

## 4. Concurrencia e idempotencia

- **Apertura:**
  - toma el lock de la fila de la caja (`SELECT … FOR UPDATE`), verifica que esté activa e inserta el turno;
  - los índices parciales deciden la carrera;
  - una violación de unicidad se traduce **según el estado confirmado**: misma clave → replay o 409 `IDEMPOTENCY_KEY_REUSED`; caja ocupada → 409 `CAJA_CON_TURNO_ABIERTO`; actor con otro turno → 409 `TURNO_YA_ABIERTO`.
- **Idempotency-Key obligatoria** (UUID). La huella cubre negocio + caja resuelta + fondo + responsable. El replay sólo se devuelve al mismo responsable.
- **Desactivar una caja** toma el mismo lock y cuenta los turnos abiertos en una sentencia posterior (nuevo snapshot en READ COMMITTED). Por eso nunca queda una caja inactiva con un turno abierto. Cambiar la predeterminada bloquea la anterior y la nueva dentro de la misma transacción.
- **Caja predeterminada:** `INSERT … ON CONFLICT DO NOTHING` y relectura (los perdedores no duplican). Si ya hay cajas activas sin predeterminada, se promueve la más antigua.
- **Ventas:** siguen en una transacción Serializable con reintento. El turno se revalida dentro de ella.

## 5. Identidad del responsable

- **Cajero:** sesión personal de DeliGO Operaciones con área `caja` en un negocio genérico (mismo resolver de F10-B1). El servicio vuelve a verificar empleado activo, del negocio y con área `caja`.
- **Dueño:** sesión del negocio; `responsableTipo=NEGOCIO`, `responsableId=negocioId`.
- **Sin anonimato:** no hay responsables anónimos ni terminales compartidas.
- **Inmutabilidad:** no existe ninguna ruta que cambie el responsable ni el fondo de un turno (contrato estático: sin `turnoCaja.update`).
- **Cajas autorizadas para un cajero:** todas las cajas **activas** de su negocio. La asignación por caja queda como decisión futura.

## 6. Fondo inicial

- Dinero declarado que ya está en la caja: `NUMERIC(12,2)`, ≥ 0, hasta 2 decimales (nunca se redondea en silencio), dentro de rango.
- **No** es venta ni ingreso: no genera operación ni movimiento financiero ni de inventario (probado).
- Queda en el turno para el cálculo del esperado.
- El traspaso entre turnos no existe todavía: no se inventan transferencias.

## 7. Atribución de ventas y del libro

- **Cajero:** la ruta resuelve **su propio** turno abierto desde la sesión.
- **Dueño:** sólo **su propio** turno (responsable NEGOCIO). Una venta del dueño **nunca** se atribuye al turno de un empleado.
- **Revalidación en el motor:** dentro de su transacción, el turno debe estar ABIERTO, ser del negocio, de la misma caja, y el actor debe ser su responsable. Si no, 409 `TURNO_NO_DISPONIBLE`, sin escribir nada.
- **El cuerpo de la solicitud nunca elige turno, actor ni negocio:** se ignoran `turnoCajaId`, `turnoId`, `actorId` y `negocioId` del body (probado).
- **Con turno:** `Venta.turnoCajaId` y `OperacionFinanciera.turnoCajaId` quedan registrados, y el efectivo va a la cuenta **de esa caja** (`efectivo_caja_fisica:<id>`, creada con ON CONFLICT DO NOTHING). Una transferencia sigue sin movimiento (DECLARADA, contrato de F10-B0).
- **Sin turno** (transición): el comportamiento de F10-B1 se mantiene y el efectivo va a `efectivo_caja_sin_asignar`. Es identificable y nunca se mezcla con una caja.
- **Ventas históricas:** no se tocaron (12 ventas, sin turno, sin backfill). El saldo de `efectivo_caja_sin_asignar` **no** se movió a ninguna caja.
- **Sin duplicados:** sigue habiendo un cobro, una operación y una pata por venta (idempotencia, replay y doble toque probados con turno).

## 8. Efectivo esperado (sólo dueño)

`esperado = fondo inicial + Σ patas de efectivo del turno en la cuenta de su caja (con signo)`

- Todo se calcula con aritmética exacta (`storedMoney` / `addMoney`); las transferencias no suman.
- Las salidas (F10-C) entrarán como patas negativas sin cambiar la fórmula. Hoy no existen y no se inventan.
- Ejemplo probado: fondo 20.000 + efectivo 5.000 + transferencia 8.000 → esperado **25.000**.
- Se expone **sólo** en `GET /api/negocio/caja/turnos/[id]` (dueño del negocio).

## 9. Protección del cierre ciego futuro

- **Cajero sin acceso:** el cajero no recibe el esperado, ni ingresos, salidas, diferencias, totales, saldos, ni turnos o movimientos de otros.
  - `GET /api/operativo/caja/[slug]/turno` devuelve sólo `cajas` (id, nombre, predeterminada, `ocupada`), su turno (caja, apertura, el fondo que **él** declaró) y el modo.
  - Las rutas del dueño rechazan la cookie operativa.
- **Contratos estáticos:**
  - `caja-turnos-admin` sólo se importa desde `/api/negocio/**`;
  - ningún código de `/api/operativo/**`, `/operaciones/**` o `src/components/**` menciona `esperado` ni el módulo admin.

## 10. Compatibilidad con F10-B1 y estado de activación

- `cajaTurnosModo = OPCIONAL` en **todos** los negocios: los cajeros siguen vendiendo como en F10-B1. Si un empleado tiene un turno abierto (vía API), sus ventas se atribuyen a ese turno.
- `OBLIGATORIO` se aplica en la ruta **y en el motor**: un cajero sin turno → 409 `TURNO_REQUERIDO`. No hay ruta ni interfaz para activarlo. Se activará por negocio en F10-B2.2, cuando existan cierre y recuperación.
- **Dueño con `OBLIGATORIO`:** no se le exige turno (decisión pendiente #17).

## 11. Decisión de producto pendiente (#17) — el dueño en un mostrador con turno de empleado

D6 aprueba que el dueño use la Caja con autoría identificada y "sin mezclar fondos", pero no define este caso. B2.1 aplica lo más conservador: la venta del dueño va a **su propio** turno, o queda **sin turno**; nunca al del empleado.

Alternativas para decidir antes de F10-B2.2:
- **(A)** Las ventas del dueño en esa caja cuentan en el esperado del turno del empleado, porque el efectivo físico entra a ese cajón, con autoría NEGOCIO visible.
- **(B)** El dueño debe usar otra caja física con su propio turno.
- **(C)** Las ventas del dueño quedan siempre fuera de los turnos de empleados (hoy), con el riesgo de una diferencia en el cierre ciego si el efectivo entra físicamente al cajón del empleado.

Relacionado: si el dueño debe tener turno obligatorio cuando el negocio active `OBLIGATORIO`.

## 12. Migración

- **Archivo:** `prisma/migrations/20261011120000_f10_b2_1_cash_registers_shifts/migration.sql`. Es la salida de `prisma migrate diff` más los invariantes en SQL de §3. Es aditivo: sin `DROP`, `ALTER COLUMN`, `UPDATE` ni `DELETE`, y sin tocar R3A.
- **Inmutabilidad:**
  - commiteado (`c765597`) **antes** de aplicarlo;
  - LF, sin CR, un único salto final;
  - sha256 del archivo = blob = `f2c7a0b9abd47aeb223adee01cc3fb5b960777509144399fcfc23d888cd76dfa`.
- **Aplicación (sólo TESTING):**
  - guardia de huella `d64be28f676e`;
  - `migrate status`: sólo esta migración pendiente;
  - comprobación de bytes contra el blob;
  - `prisma migrate deploy` → "Database schema is up to date".
- **Checksum:** `_prisma_migrations` = `f2c7a0b9…` = archivo (**coincide**). F10-B2.0 `10f49eab…` y F10-B0 `d3faab68…` sin cambios (sin `UPDATE` ni edición).
- **Verificación:**
  - 16 índices y 5 CHECK presentes, más las FKs nuevas (incluida la compuesta turno ↔ caja);
  - `migrate diff` contra TESTING sólo muestra el `ALTER INDEX … RENAME` preexistente del chat: los índices parciales y de expresión y los CHECK no aparecen como drift;
  - datos intactos: 0 cajas y 0 turnos creados por la migración, 12 ventas sin turno, Decimal (62310.00 / 5000.00) igual, stock (58 / 16 / 25 movimientos), reservas y modo ON sin cambios.
- **Bloqueos:** `ADD COLUMN` NULL o con default constante (metadatos), tablas nuevas vacías, índices sobre tablas chicas.

## 13. Pruebas

Nuevos — **52 pass / 0 fail**:

| Archivo | Resultado | Cubre |
|---|---|---|
| `src/lib/f10-b2-1-turnos.integration.test.ts` (real DB TESTING) | 22/0 | **Cajas:** 6 lecturas concurrentes → 1 sola "Caja principal"; varias cajas; nombre único sin mayúsculas/espacios (409); nombre inválido (400); cambio de predeterminada atómico; no desactivar la predeterminada; desactivar/reactivar; no desactivar con turno abierto; no abrir en caja inactiva; caja de otro negocio → 404; rubro no genérico → 403 sin crear cajas; **PostgreSQL rechaza** 2.ª predeterminada, predeterminada inactiva, turno en caja ajena (FK compuesta), fondo negativo, responsable incoherente, 2.º turno abierto en la misma caja y valor de flag inválido. **Apertura:** fondo exacto "20000.00"; replay (200 + mismo id); clave reutilizada → 409; sin operación financiera, sin movimiento de inventario, stock intacto; auditoría; clave obligatoria; fondos inválidos (negativo, >2 decimales, texto, vacío, null, fuera de rango, exponente, booleano) → 400; **dos cajeros compiten 6 veces por una caja → 1 turno**; **misma clave 5 veces en paralelo → 1 turno**; dos cajas abiertas en paralelo; un cajero no abre un 2.º turno (409); el dueño abre el suyo (una vez). **Dinero:** fondo 20.000 + efectivo 5.000 + transferencia 8.000 → esperado **25.000** con la pata en la cuenta de esa caja y la operación con turno; centavos exactos (0,10 + 0,20 + 0,10 × 3 → 0,60); **dos cajas y dos cajeros con ventas concurrentes → cada cuenta sólo tiene lo suyo**; sin turno (OPCIONAL) → comportamiento de F10-B1 a `efectivo_caja_sin_asignar`; OBLIGATORIO: cajero sin turno → 409 `TURNO_REQUERIDO` sin escrituras, con turno vende, el dueño no es forzado; venta del dueño **nunca** al turno del empleado y sí al propio; el motor rechaza el turno de otro empleado, del dueño o de otro negocio (409 `TURNO_NO_DISPONIBLE`, nada escrito); el cuerpo que nombra turno, actor o negocio ajenos se ignora; replay y doble toque con turno → 1 venta, 1 cobro, 1 pata, stock una vez; reserva R3A ACTIVA → 409 sin escrituras. **Acceso:** ruta de turno del cajero sin sesión 401, otra área 403, inactivo 403, negocio suspendido 403, no genérico 403; **el cajero nunca recibe esperado, ingresos, salidas, diferencias, saldos ni totales**; otro cajero no ve el turno ajeno (sólo `ocupada`); la cookie operativa no abre las rutas del dueño; el dueño de otro negocio no ve el turno (404) |
| `src/lib/caja-turnos.test.ts` | 9/0 | validación exacta del fondo (acepta / rechaza), nombre y descripción, huella de apertura, efectivo esperado con un doble en memoria (fondo + patas del turno − salidas, transferencias y otros turnos excluidos, cajas aisladas, patas legacy cuantizadas, 0,10 + 0,20 + 0,10 = 0,40 exacto, turno sin cuenta = fondo, turno ajeno → null), resumen por medio |
| `src/lib/f10-b2-1-origin.test.ts` | 5/0 | `POST/PATCH` de cajas y turnos del dueño y `POST` de turno del cajero: cross-origin → 403, sin origen → 403, same-origin pasa; lecturas sin validación de origen |
| `src/lib/f10-b2-1-static-contract.test.ts` | 16/0 | único escritor de cajas y turnos; ningún `update`/`delete` de turnos ni borrado de cajas; la apertura no toca el libro ni el inventario; sin ruta para el flag; locks y mapeo de 409; turno resuelto desde la sesión en las rutas de cajero y dueño; el motor revalida y usa la cuenta de la caja; un solo motor; el módulo admin sólo lo importan rutas `/api/negocio/**`; ningún código de cajero menciona el esperado; dinero exacto; migración aditiva con todos sus invariantes; bytes LF; sin `Float` nuevo en el turno |

**Ajustes sin debilitar:**
- `f10-b0-static-contract`: "todavía no hay turnos" pasa a "`turnoCajaId` sólo lo escribe el motor", y "sólo efectivo" admite la cuenta por caja.
- `f10-b2-0-static-contract`: corrige un bug latente del regex de escritores (`:\s*(?!true)` también encontraba `importeDecimal: true` en un `select`).
- El fake en memoria de `route.reservations.test.ts`: sin turno abierto (`turnoCaja.findFirst → null`), aserciones sin cambios, 14/0.

**Regresiones:** 141 archivos, secuencial, guardia de huella, timeout de 60 s y secreto OAuth de prueba. **Primera pasada: 1836 pass / 21 fail.** Clasificación:
- **13 causadas por B2.1 y corregidas:** el fake de reservas de Caja (arriba) → 14/0.
- **5 preexistentes verificadas** (idénticas en `e72c61b`, archivos no tocados): `catalog-tutorial-static-contract` 1, `category-filter-operational-static-contract` 1, `product-variants-static-contract` 2, `operativo-logout-wiring-static-contract` 1.
- **2 preexistentes verificadas:** `google-oauth-consent-gate.integration` 2.
- **1 intermitente preexistente:** `mesa-pedido-cancelacion` K2 (concurrencia real). Comprobado contra el baseline con 3 + 3 corridas alternadas base/rama, todas 72/0. Sumando B2.0, la base `e72c61b` falló K2 en 2 de 8 corridas. B2.1 no toca su código.

**Resultado: 0 regresiones nuevas pendientes.**

Destacados en la regresión: B2.1 real-DB 22/0 · B2.0 real-DB 11/0 · B1 real-DB 23/0 · B0 idempotencia 11/0 · Caja `route.test` 21/0 · F9 · R3A I1 19/0 / I2 34/0 · `proxy.test` 56/0 · Inventario · Pedidos · Mozo/PyR/Salón · empleados · auth.

## 14. Gates

| Gate | Resultado |
|---|---|
| Tests nuevos | 52/0 (real-DB 22/0; concurrencia: 4 escenarios reales) |
| Regresiones | 141 archivos; 0 regresiones nuevas pendientes (§13) |
| TypeScript | 35 = conjunto idéntico al baseline (0 nuevos) |
| ESLint (archivos .ts/.tsx cambiados) | limpio |
| `prisma validate` / `generate` | válido / generado |
| `next build` | OK (compiled, 162/162; 5 rutas nuevas) |
| `git diff --check` | limpio |
| Migración | aditiva; checksum aplicado = archivo = blob (`f2c7a0b9…`); B2.0/B0 sin cambios |

## 15. Deploy

- **Commits** (rama `work/f10-b2-1-physical-cash-registers-shifts`):
  - `c765597` feat: add physical cash registers and cash shift schema
  - `362ece2` feat: add cash register and shift engine with owner and cashier routes
  - `9c6b2e2` feat: attribute caja sales and cash to the actor's open shift
  - `d3c93c2` test: cover registers, shifts, attribution and blind-close safety
  - `4b836a7` test: stub the shift lookup in the caja reservations fake
- **Integración:**
  - migración aplicada a TESTING **antes** de integrar;
  - referencia local `f10-b2-1-pre-integration-testing-codex` → `5d91732`;
  - fast-forward `testing-codex` `5d91732..4b836a7` (sin force);
  - `main` sin cambios (`42ca500`).
- **Deploy TESTING:** `d5fb7c06-27a1-41f2-9990-2c003ab125de` SUCCESS, commitHash `4b836a738d2855c076342ae4f62d241d6b0826a6` (coincide). Logs: "41 migrations found", "No pending migrations to apply", "Ready", sin errores.
- **Smoke HTTP** (sin crear datos):
  - sin sesión: `GET` de cajas, turnos y turno del cajero → 401;
  - cross-origin: `POST` de turnos y cajas del dueño y de turno del cajero → **403 "Origen no permitido"**;
  - same-origin con sesión falsa: llega al handler (403 / 401 `sin_sesion`).
- **Base (sólo lectura):**
  - migraciones y checksums como en §12;
  - 0 cajas y 0 turnos (el deploy no crea nada; se crean al primer uso del dueño o cajero en un negocio genérico);
  - 12 ventas sin turno, 0 operaciones con turno, 0 cuentas con caja, 0 negocios OBLIGATORIO;
  - Decimal, stock, reservas (ACTIVA 1 · CONSUMIDA 1 · LIBERADA 4) y modo ON sin cambios;
  - integridad 0 problemas (claves, cobros, patas, cruces, stock negativo);
  - 0 fixtures `test-f10b21-*` y 0 auditorías de cajas/turnos remanentes.
- **Auditoría huérfana:** +34 filas de `audit_logs` dejadas otra vez por las suites real-DB **preexistentes** (mismo patrón, `FOLLOWUP_REAL_DB_SUITES_AUXILIARY_TABLE_CLEANUP`; total documentado 115). No se borraron. Las suites de B2.1 limpian las suyas.
- **Production** `6bf1ee84` @ `42ca500`: sin cambios.
- **Smoke físico:** no obligatorio (sin interfaz nueva; F10-B1 sin cambios visibles con `OPCIONAL`).

## 16. Rollback

- **Código:** `git revert` de los commits funcionales de B2.1 en `testing-codex` + deploy de TESTING. El código anterior funciona con el esquema ampliado: las columnas nuevas son NULL u opcionales y el flag tiene default.
- **Schema y datos:** no se borran tablas, turnos ni movimientos. Los turnos abiertos quedan como datos. Las cuentas por caja y sus patas quedan como registro histórico. Revertir el código no los "deshace".
- **Si hubiera turnos abiertos:** el código anterior vende sin turno, con el efectivo a `efectivo_caja_sin_asignar`.
- Nunca usar un `DROP` como mecanismo de rollback automático.

## 17. Limitaciones

- Sin interfaz (motor y API). Sin cierre ni recuperación de turnos: un turno abierto no se puede cerrar en B2.1 (F10-B2.2). Por eso el flag **no** debe activarse.
- Coherencia de negocio de las referencias opcionales garantizada por los escritores, no por FK compuestas (§3).
- Las cajas autorizadas para un cajero son todas las activas de su negocio (sin asignación por caja).
- Decisión #17 pendiente (dueño en el mostrador del empleado).
- Hereda las limitaciones documentadas de F10-B2.0 (Float de transición, decisión #16 de redondeo, rutas laterales del dueño sin protección de origen) y de R3A.

## 18. Próximos pasos (F10-B2.2)

- Cierre ciego en dos fases con CAS e idempotencia: el cajero declara contado, entregado y fondo que deja, sin ver el esperado.
- Diferencias visibles sólo para el dueño; correcciones auditadas.
- Traspaso del fondo al turno siguiente sin doble contabilización.
- Recuperación de turnos abandonados.
- Activación del flag por negocio (ruta del dueño con origen protegido).
- Interfaz de apertura y cierre para el cajero y supervisión para el dueño.
- Decidir #17 antes de implementar.
