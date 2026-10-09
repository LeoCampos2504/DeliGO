# F10-B2.1 — Cajas físicas, turnos y atribución financiera

Fecha: 2026-10-09 · Entorno: TESTING únicamente (amiable-rejoicing / TESTING / DeliGO Copy / testing-codex) · Production: sin cambios.
Base: `5d91732` (F10-B2.0 IMPLEMENTED_TESTING) · rama `work/f10-b2-1-physical-cash-registers-shifts`.

```text
F10_B2_1_STATUS=IMPLEMENTED_TESTING (2026-10-09; motor y API; sin interfaz; obligatoriedad NO activada)
F10_B2_2_STATUS=A_AND_B_IMPLEMENTED_TESTING · F10_C_STATUS=NOT_STARTED · F10_D_STATUS=NOT_STARTED · F10_E_STATUS=NOT_STARTED
CONSUMO_INTERNO_STATUS=PLANNED_NOT_STARTED
SHIFT_ENFORCEMENT=OPCIONAL en todos los negocios (no activado; cualquier activación requiere completar y autorizar sus gates posteriores)
```

**Actualización F10-B2.2-A (2026-10-09):** PostgreSQL TESTING volvió a autenticar; la
huella `d64be28f676e` coincide y las migraciones B0/B2.0/B2.1 están aplicadas.
La certificación real del código local dio 23/23 pruebas (218 aserciones), incluidas
atribución dueño/empleado, efectivo compartido, selección de Caja, reintentos,
concurrencia, aislamiento, R3A y privacidad del esperado. Regresiones focales: 255/255
(1.871 aserciones, incluye F9/R3A); TypeScript conserva exactamente los 35 errores
baseline, sin errores en archivos tocados. Prisma validate, ESLint, build de 162 páginas
y `git diff --check` pasan. Los fixtures temporales quedaron en cero. No hay migración
nueva ni activación de OBLIGATORIO. Integración al branch `testing-codex` y deploy
Railway TESTING quedan pendientes de este cierre.

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

## 11. Decisión de producto #17 — sustituida por la decisión del operador (2026-10-09)

**Estado al escribir B2.1 (histórico):** D6 no definía cómo registrar una venta del dueño en el cajón de un empleado; B2.1 la asignaba sólo al turno propio del dueño o la dejaba sin turno. El documento original enumeró A/B/C. Esa decisión quedó **reemplazada** por la regla aprobada que se transcribe en §19; las alternativas A/B/C ya no están pendientes ni son opciones vigentes.

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
- Incorporar y probar la adaptación de atribución de la decisión #17 antes de la interfaz y el cierre.

## 19. Decisión #17 aprobada y handoff de continuidad (2026-10-09)

`DECISION_17_SHARED_CASH_REGISTER=APPROVED`: la caja física pertenece al negocio y el dueño la administra. Un turno tiene un responsable operativo y puede tener empleados participantes autorizados. El dueño vende desde el panel principal en la misma caja y el mismo turno abierto del empleado; la venta se registra con autoría NEGOCIO y el empleado conserva autoría EMPLEADO en sus propias ventas. Ambas ventas entran al efectivo esperado del turno. El dueño no abre un segundo turno en esa caja. La selección física del dueño es explícita cuando existen varias cajas. El cajero no recibe esperado ni diferencia; el dueño mantiene acceso administrativo.

**Propuesta técnica previa a B2.2:**
- Mantener `TurnoCaja.responsableTipo/responsableId/empleadoId` como responsable único, inmutable. No reinterpretarlo como quien hizo todas las ventas.
- Incorporar una relación aditiva de participantes, recomendada como `TurnoCajaParticipante` para empleados: turno, negocio, empleado, fecha/actor de alta, revocación y estado; unicidad por turno/empleado. Sólo el dueño del mismo negocio autoriza o revoca. Validar empleado activo, del mismo negocio y con área operativa `caja`. El dueño es participante implícito por su sesión administrativa, no una cuenta compartida ni una fila de empleado.
- Para el dueño, permitir elegir `cajaFisicaId` explícitamente. El servidor deriva el negocio de la sesión, carga esa caja dentro del tenant, resuelve el único `TurnoCaja` abierto en ella y no acepta `turnoCajaId` del cliente. Si no hay turno, no asociar silenciosamente la venta a otra caja; usar el flujo OPCIONAL existente hasta definir UX/contrato, o rechazar si el modo ya fuera obligatorio. La elección de flujo ante caja sin turno debe resolverse antes de implementar.
- Para el empleado, resolver su turno como hoy y validar que siga abierto y que el participante no esté revocado. La ruta/motor deriva actor exclusivamente de sesión. La venta de dueño mantiene `actorTipo=NEGOCIO`, `actorId=negocioId`; la de empleado mantiene `actorTipo=EMPLEADO`, `actorId=empleadoId`, `empleadoId` ligado a ese actor.
- Una vez autorizado el actor, guardar el mismo `turnoCajaId` en `Venta` y `OperacionFinanciera`; el efectivo usa la cuenta de `CajaFisica` vinculada al turno. El esperado continúa como fondo inicial + patas exactas con signo asociadas al turno. Las transferencias no incrementan efectivo.
- Preservar el índice parcial PostgreSQL de un turno abierto por caja y la FK compuesta turno↔caja del mismo negocio. No flexibilizar el contrato de una caja/turno para habilitar al dueño.
- Revalidar caja, estado de turno, pertenencia del empleado/participante y tenant dentro de la misma transacción Serializable que graba inventario, venta, cobro y libro. Resolver las carreras venta-vs-revocación y venta-vs-cierre con bloqueo/CAS definido; cada transacción debe terminar completa o sin efectos.
- Incluir `cajaFisicaId` y el turno resuelto en la huella de idempotencia. Misma clave + mismo actor/contenido/caja permite replay al mismo actor; distinta caja o turno da conflicto 409, nunca mueve una venta existente. Mantener la unicidad por negocio y las restricciones actuales.
- Cambiar el panel del dueño para mostrar y seleccionar caja física y turno actual, sin esconder la selección cuando hay varias; seleccionar el turno no sustituye autorización server-side. El panel de cajero sólo muestra su caja/turno y acciones autorizadas; jamás efectivo esperado, diferencias, saldo global ni totales de otros.

**Secuencia propuesta de F10-B2.2 (no iniciada ni autorizada):**
1. Contrato y esquema aditivo para participantes, auditoría de alta/revocación y cambios del motor/idempotencia; pruebas unitarias/estáticas y transaccionales locales para autoría, aislamiento, replay, caja/turno, concurrencia y R3A. Sin interfaz ni activación.
2. API y UX de cajas/turnos compartidos: el dueño selecciona caja explícitamente y gestiona participantes; el empleado inicia con su sesión y participa sólo si está autorizado. Mantener `cajaTurnosModo=OPCIONAL`; certificar seguridad y recuperar reintentos.
3. Cierre ciego en dos fases: solicitud idempotente con CAS que congela el turno para ventas; el responsable declara el efectivo contado sin que respuesta, UI, metadata ni errores filtren esperado/diferencia. La carrera con ventas queda serializada o la venta falla íntegra.
4. Cierre normal/revisión: guardar declaración inmutable; el dueño ve esperado exacto, contado y diferencia; ajustes sólo mediante eventos auditados con motivo y autor, sin reescribir el origen.
5. Reparto de fondos: persistir efectivo contado, importe entregado a dueño/resguardo y fondo remanente. Invariante inicial: contado = entregado + remanente. La diferencia contra esperado se registra aparte y no altera ese balance. El remanente pasa como fondo inicial trazable al turno sucesor sin una entrada financiera nueva ni doble suma. Cualquier otro destino (gasto, retiro, cambio) requiere operación separada y autorizada antes de incluirse.
6. Traspaso: relacionar turno origen/destino, importe y responsables; crear ambos lados de forma atómica e idempotente. No convertir un mero cambio de responsable en transferencia de dinero.
7. Recuperación de turnos abandonados: dueño puede retomar o ejecutar cierre de recuperación con su identidad, motivo, evidencia/contado y auditoría; nunca borrar ni mutar responsable original, cerrar por timeout ni reabrir un turno cerrado. Resolver la indisponibilidad del responsable y las ventas inciertas pendientes antes de fijar estados.
8. Sólo tras completar los contratos anteriores: activación protegida por negocio de `OBLIGATORIO`, default OPCIONAL y procedimiento de reversión operacional. No activarlo en este handoff.

No considerar «cierre completo» listo mientras falten los invariantes de dinero, estados/transiciones, doble submit, ventas concurrentes, fondos remanentes, entrega, diferencia, traspaso y recuperación. Pruebas con base real, datos TESTING, migraciones aplicadas y despliegues necesitan autorización separada.

## 20. F10-B2.2-A — implementación y pruebas TESTING (2026-10-09; estado de esa fecha: deploy pendiente)

`DECISION_17=APPROVED_EMPLOYEE_STARTS_SHIFT_OWNER_SHARES_ACTIVE_REGISTER`.
Esta sección registra la implementación y las pruebas autorizadas para A. La
integración real contra PostgreSQL TESTING pasó; el commit, push a
`testing-codex` y despliegue automático Railway TESTING quedaron pendientes en
el momento en que se escribió esta sección; ver la actualización vigente al
final del informe para el estado A+B.
No se creó esquema ni migración.

- El empleado abre su propio turno por `POST /api/operativo/caja/[slug]/turno`
  con su sesión personal, negocio, área Caja, caja física, fondo e idempotency
  key. El responsable sigue siendo ese empleado; no se requiere una invitación
  adicional para que él mismo venda.
- `GET /api/negocio/caja/turnos` devuelve todos los turnos abiertos más hasta
  50 cerrados recientes. `GET /api/negocio/caja/cajas` ya expone cada caja y su
  turno/responsable activo. Ambos son exclusivos del dueño.
- `POST /api/negocio/caja/ventas` deriva `actorTipo=NEGOCIO` de la sesión y puede
  recibir `cajaFisicaId` (nunca acepta un `turnoCajaId` del cliente). Sin una
  elección, el motor asigna el único turno abierto; si hay más de uno devuelve
  `409 CAJA_SELECCION_REQUERIDA`. Una selección se valida por tenant y actividad,
  y requiere turno abierto en esa caja; una caja sin turno seleccionado falla
  con `409 TURNO_NO_DISPONIBLE`, sin cambiar a otra caja.
- Sin turnos abiertos ni selección explícita, el negocio conserva OPCIONAL:
  la venta sigue sin `turnoCajaId` y el efectivo se lleva a
  `efectivo_caja_sin_asignar`. No se abre un turno automático. El modo
  OBLIGATORIO no se activa; el dueño no queda forzado a abrir turno.
- Las ventas del dueño y del empleado responsable conservan autoría separada
  (`NEGOCIO` y `EMPLEADO`) y apuntan al mismo `turnoCajaId`. El saldo esperado
  administrativo suma las patas exactas de efectivo de ambas ventas; una
  transferencia no crea una pata de efectivo. El cálculo Decimal de B2.0 no se
  duplica ni cambia.
- El replay del mismo actor/contenido se consulta antes de resolver el destino
  abierto actual. Un replay sin selección mantiene la venta y turno originales
  aunque cambien turnos. Cuando se selecciona caja, el fingerprint incluye esa
  intención: reutilizar clave con otra selección produce conflicto. Las nuevas
  ventas revalidan caja y turno en la transacción Serializable y bloquean la
  caja; el cierre futuro deberá adquirir ese mismo bloqueo antes de cambiar el
  estado del turno.
- No se creó `TurnoCajaParticipante`: el dueño participa por su sesión de
  negocio y el responsable usa su propio turno. Un empleado adicional sigue sin
  poder vender en el turno de otro empleado; autorización/revocación de terceros
  queda pendiente explícita para otra etapa.
- La superficie del empleado sigue sin recibir efectivo esperado, diferencia,
  saldos, resumen global ni turnos ajenos. No hay UI completa, cierre,
  diferencias, traspasos, recuperación, vuelto, consumo interno ni cambio de
  OPCIONAL.

### Evidencia actualizada tras refrescar credenciales

- PostgreSQL TESTING autenticó sin P1000; la huella
  `SHA256(system_identifier)[0:12]` coincide con `d64be28f676e`; están aplicadas
  las migraciones F10-B0, F10-B2.0 y F10-B2.1. Prisma informa 41 migraciones y
  esquema al día.
- La integración real dio 23/23 (218 aserciones), incluidas apertura del turno
  por empleado, ventas del dueño en el mismo turno, autoría dual, efectivo y
  transferencias, selección de caja, reintentos, concurrencia, aislamiento,
  R3A y privacidad del efectivo esperado.
- Regresiones focales: 255/255 (1.871 aserciones; incluyen F9, R3A,
  F10-B0/B1/B2). El build Next compiló y generó 162 páginas; ESLint en archivos
  modificados, Prisma validate y `git diff --check` pasan.
- TypeScript: 35 diagnósticos, coincidentes con la baseline de B2.1; cero en
  los archivos de esta tarea.
- La auditoría posterior read-only encontró cero negocios fixture
  `test-f10b21-*`/`test-f10b0-*` y cero cuentas operativas temporales.
- Schema: sin cambios; migraciones nuevas: 0. Sólo se escribieron y limpiaron
  los fixtures de estas pruebas en TESTING. El estado de despliegue de esta
  sección es histórico. Production no fue tocada. Vuelto en productos y consumo
  interno siguen `PLANNED_NOT_STARTED`.

## Estado vigente F10-B2.2 — 2026-10-09

F10-B2.2-A y F10-B2.2-B están implementados y desplegados en Railway TESTING.
El commit de código B2.2-B es `a210edb9acea594c70579a20eeab80b165d8bb4e` y su
deployment `617eecb9-7e2d-4791-8ed5-713f3ccd4f2b` terminó `SUCCESS`. La UI de
cajas/turnos incluye apertura de empleado habilitada sólo en TESTING con flag y
allowlist controlada, gestión del dueño, selección automática si existe un
único turno abierto y selección requerida si hay varios. Sin turnos conserva
el comportamiento OPCIONAL. No se agregó migración, cierre, diferencias ni
activación de `OBLIGATORIO`.

Las pruebas locales relevantes dieron 138/0 (1.403 aserciones), la integración
real PostgreSQL usada como regresión pasó 24/24 (225 aserciones), TypeScript
conservó el baseline de 35 errores con cero en archivos cambiados; Prisma
validate, ESLint, build y `git diff --check` pasaron. Smoke posterior: `/` 200,
APIs de Caja/turno sin sesión 401. No hubo prueba autenticada de navegador ni
prueba física de iPhone PWA. Production continúa en el deployment previo y no
fue tocada. F10-B2.2-C permanece sin iniciar. Consultar el handoff vigente para
detalles y cualquier deployment documental posterior.

**Vuelto en productos:** `VUELTO_EN_PRODUCTOS=PLANNED_NOT_STARTED`; no pertenece al alcance de B2.2. El vuelto automático puede evaluarse como mejora UX separada del mecanismo de entrega en productos. La extensión futura debe distinguir precio comercial, importe entregado, vuelto calculado, devolución en efectivo, equivalente de productos y efectivo retenido. No inventar ingreso ni inventario; consentimiento del cliente y revisión de normas de protección al consumidor antes de publicación. Ubicación recomendada: extensión posterior al cierre de F10-B2.2, en Caja F10-B, sin asignar identificador que colisione con C/D/E.
