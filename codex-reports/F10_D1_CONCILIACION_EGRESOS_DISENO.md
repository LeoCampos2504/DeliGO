# F10-D1 — Conciliación y recupero de egresos de Caja descubiertos después del cierre (DISEÑO PROPUESTO)

Fecha: 2026-11-27 · Autor: Claude Code · Tanda T4 del plan de consolidación. **Estado (2026-11-27): DISEÑO APROBADO por el
operador (DF-1 fuera de alcance → roadmap; DF-2 `DIFERENCIA_ACORDADA`; DF-3 el recupero cuenta el día que entra el dinero)
e IMPLEMENTADO; CERTIFICADO EN TESTING el 2026-11-27** (migración aditiva `20261127120000_f10_d1_conciliacion_recupero_egresos`,
servicio `src/lib/caja-egresos-correccion-service.ts`, rutas `/conciliacion` y `/recupero`; commit `1a3c33f5`, DeliGO Copy
`83c3f9d1`; operador 14/14 y verificación interna de solo lectura sin discrepancias). No autoriza Production.

Condiciones de integridad agregadas en la aprobación (implementadas): tope por **turno** (lo conciliado por todos los
egresos de un turno cerrado no supera su sobrante `contado − esperado`; sin sobrante no se concilia y la limitación se
informa con 409 `SIN_SOBRANTE_EN_CIERRE`); un retiro CONFIRMADO conserva salida real (sólo conciliación parcial o
recupero); un pago con correcciones no se vincula ni desvincula y su ajuste de F5 no se anula; operación de recupero
nunca huérfana (trigger diferido al confirmar); historial inmutable también frente a DELETE.

## 0. Fuentes y decisiones que no se reabren

- **D-2 (2026-11-26):** F10-D1 es obligatorio antes de Production; no se libera con egresos ni compras desactivados.
- **D9 de F10-C1 (2026-11-18):** las correcciones son por compensación, sin borrar historia; un error descubierto
  después del cierre se corrige en F10-D **sin tocar el turno cerrado** ni su revisión.
- **Ajuste 3 de F10-C1:** nunca reabrir ni cambiar importes de un turno cerrado.
- **D-C1c-1 (`F10_C_EGRESOS_CAJA_DISENO.md` §15.3):** una `REVERSION` sin turno crearía **dinero ficticio**, porque la
  entrega a custodia no es un movimiento del libro y la cuenta de efectivo de cada caja es un flujo por turno. Se
  esbozaron dos mecanismos: **(a) conciliación** del error contra la diferencia del cierre, sin movimiento de dinero, y
  **(b) recupero** como ingreso nuevo en el turno abierto que recibe el efectivo.
- **Alcance aprobado (plan §14).** **F5-A D-8:** un `PAGO_PROVEEDOR` vinculado no se compensa mientras el vínculo esté vigente.
- **Política de estabilización (2026-11-27):** no ampliar el alcance más allá de lo aprobado.

## 1. Estado vigente del código (verificado en `codex/estabilizacion-final`)

| Pieza | Comportamiento actual |
|---|---|
| Egreso (`egresos_caja`) | Una operación `GASTO` / `PAGO_PROVEEDOR` / `RETIRO_DUENO` con **una** pata negativa en la cuenta `EFECTIVO` de la caja, atribuida a un turno **abierto**. Inmutable (guarda SQL) |
| Esperado del turno (`caja-turnos-snapshot.ts`) | `fondo + patas positivas − patas negativas` de las operaciones **con ese `turnoCajaId`** en la cuenta de efectivo de la caja |
| Cierre | Congela declarado, esperado y diferencia. Las revisiones (`revisiones_turnos_caja`) copian esos valores |
| Entrega a custodia | **No** es un movimiento del libro: sólo reparte el contado |
| Compensación (`compensaciones_egresos_caja`) | Sólo `TURNO_ABIERTO` (`REVERSION` en el mismo turno abierto, total, una vez). `POSTERIOR_AL_CIERRE` está **bloqueada** por la API (409) y por la base (migración `20261118150000`) |
| Revisión del egreso | `REVISADO` / `OBSERVADO`; el retiro se confirma una vez (`CONFIRMADO` / `NO_RECIBIDO`). Nunca mueve dinero |
| Proveedores (F5-A) | Un `PAGO_PROVEEDOR` vinculado genera un crédito `PAGO_CAJA` `VIGENTE`. Existen la desvinculación (motivo obligatorio) y la obligación `AJUSTE_DEUDA` (`ERROR_DE_CARGA`, `DIFERENCIA_ACORDADA`, `RECARGO`, `OTRO`) |
| Tipos de operación | `operaciones_financieras.tipo` **no** tiene CHECK; las guardas de egresos sólo actúan sobre `GASTO` / `PAGO_PROVEEDOR` / `RETIRO_DUENO` / `REVERSION` |

## 2. Principio del diseño

Hay dos hechos distintos y **nunca** se mezclan:

1. **CONCILIACIÓN — el efectivo NO salió (o salió menos).** Ese efectivo ya apareció como **sobrante** en el cierre y se
   fue con la entrega. Corregirlo es **explicar** la diferencia del turno cerrado. **No se crea ningún movimiento de
   dinero**: ni pata, ni operación, ni cambio en la cuenta de efectivo. Sólo un registro auditado que vincula el egreso
   con su turno cerrado y corrige la **clasificación** en los reportes.
2. **RECUPERO — el efectivo SÍ salió y vuelve más tarde.** Es dinero real que entra en un cajón real: un **ingreso
   nuevo** (`RECUPERO_EGRESO`) con **una** pata positiva en la cuenta de efectivo de la caja que lo recibe, atribuida a
   **su turno abierto** (su esperado sube). Queda vinculado al egreso original.

En ningún caso se reabre, modifica ni recalcula un turno cerrado, ni se crea una `REVERSION` sin turno. **El bloqueo de
`20261118150000` queda intacto** (`POSTERIOR_AL_CIERRE` sigue prohibido): F10-D1 no lo levanta, usa mecanismos nuevos.

**Tope por egreso (invariante en la base):** `Σ conciliado + Σ recuperado ≤ importe del egreso`.

## 3. Escenarios

Actor en todos los casos: **sólo el dueño**, desde Caja → Egresos (detalle del egreso de un turno **cerrado**). Si el
turno original sigue abierto, se usa la compensación existente (`TURNO_ABIERTO`): F10-D1 responde 409 `USAR_COMPENSACION`.

### E1 — Egreso cargado por error; el efectivo nunca salió
- **Interfaz:** «Corregir egreso (turno cerrado)» → «El dinero no salió de la caja» → importe (por defecto el total) y motivo obligatorio.
- **Intacto:** el egreso, su operación y su pata; el turno cerrado (declarado, esperado, diferencia, entregas, revisiones).
- **Registro:** `conciliaciones_egresos_caja` tipo `SIN_SALIDA` por el importe. **Sin movimiento financiero.**
- **Turno cerrado:** su detalle muestra «Diferencia original +X · conciliada por egresos X · sin explicar 0». El número congelado no cambia.
- **Reportes:** el egreso deja de contar como gasto, pago o retiro **efectivo** del período (se muestra «registrado X · conciliado X · efectivo 0»).
- **Dinero ficticio:** imposible, porque no se crea ninguna pata. El sobrante ya se fue con la entrega.

### E2 — Importe mal cargado (se registró de más)
- **Interfaz:** la misma acción → «Salió menos de lo registrado» → importe real que salió; el sistema concilia la diferencia.
- **Registro:** `conciliaciones_egresos_caja` tipo `IMPORTE_EXCEDENTE` por (registrado − real). Sin movimiento.
- **Efecto:** el cierre muestra esa parte del sobrante como explicada; los reportes cuentan como efectivo sólo lo real.
- **Registrado de MENOS** (salió más de lo cargado): el cierre ya mostró **faltante**. Ver la decisión **DF-1**.

### E3 — El efectivo salió y vuelve más tarde (total o parcial)
- **Interfaz:** «Registrar recupero» → caja de destino **con turno abierto** (selección explícita, como los egresos del dueño), importe ≤ pendiente y motivo.
- **Intacto:** el egreso y su turno cerrado.
- **Registro:** operación `RECUPERO_EGRESO` con **una** pata `+importe` en la cuenta de efectivo de esa caja, `turnoCajaId` = turno abierto, más una fila `recuperos_egresos_caja` (con referencia al egreso).
- **Turno receptor:** su esperado sube en el importe. El cierre ciego no cambia: el cajero no ve el esperado, el importe ni el motivo; recibe el efectivo físicamente y lo cuenta al cerrar.
- **Reportes:** línea propia «recuperos de egresos» en el día del recupero (no es venta ni cobro); el egreso original muestra «recuperado X».
- **Dinero ficticio:** no, porque el efectivo entra de verdad en un cajón con turno abierto. La guarda exige turno ABIERTO, pata positiva única y cuenta de esa caja.

### E4 — `PAGO_PROVEEDOR` vinculado a un proveedor
- Primero el mismo paso de E1, E2 o E3 en Caja, y en **la misma transacción** se ajusta la deuda con el **motor único de F5**:
  - **Conciliación** (el pago no ocurrió, o fue menor): obligación `AJUSTE_DEUDA` naturaleza `ERROR_DE_CARGA` por el importe conciliado. La deuda vuelve a subir. El crédito `PAGO_CAJA` queda intacto (historia). Sus asignaciones existentes no se tocan; el ajuste es una deuda nueva que se asigna como cualquier otra.
  - **Recupero** (el proveedor devuelve dinero): obligación `AJUSTE_DEUDA` naturaleza `DIFERENCIA_ACORDADA` (ver **DF-2**) por el importe recuperado.
- **Alternativa existente:** si el error es total y nada está asignado, el dueño puede desvincular el pago (F5-A) y luego conciliar como un egreso sin proveedor. No se agrega lógica nueva para eso.
- **Proveedores y reportes:** la cuenta corriente muestra el ajuste con referencia al egreso. «Pagos a proveedores» efectivo = registrado − conciliado − recuperado.

### E5 — `RETIRO_DUENO` confirmado o `NO_RECIBIDO`
- **`CONFIRMADO`** (el dueño declaró haberlo recibido): sólo `IMPORTE_EXCEDENTE` (recibió menos de lo registrado) o recupero (devuelve el efectivo a la caja). No se permite `SIN_SALIDA` total: contradice la confirmación (409 `RETIRO_CONFIRMADO`).
- **`NO_RECIBIDO`:**
  - si el efectivo quedó en la caja (el cierre tuvo sobrante): `SIN_SALIDA`;
  - si el efectivo salió y no llegó: **no se concilia** (no hay sobrante que explicar). El egreso queda observado como pérdida a investigar. Si aparece el dinero, se hace un recupero.
- **Pendiente** o **`NO_REQUERIDA`** (lo registró el dueño): igual que un egreso común (E1, E2 o E3).
- **Reportes:** «retiros del dueño» efectivo = registrado − conciliado − recuperado.

### E6 — Repeticiones y concurrencia
- **Idempotencia:** `Idempotency-Key` y huella del contenido, igual que en F10-C1 (repetición → 200 con el mismo resultado; clave reusada con otro contenido → 409).
- **Transacción `SERIALIZABLE`** con reintento acotado (P2034 y P2010/40001, como en T2).
- **Orden de bloqueo:**
  - **conciliación:** fila del egreso `FOR UPDATE` y luego verificación del turno CERRADO;
  - **recupero:** fila de la caja de destino (el mismo candado que ventas, egresos y cierre) y luego fila del egreso.
- **Carreras:**
  - un recupero que compite con el cierre del turno receptor, o gana y el cierre congelado lo incluye, o pierde y responde 409 `TURNO_CAMBIO` sin escribir;
  - dos correcciones simultáneas del mismo egreso se serializan y el tope `Σ ≤ importe` lo garantiza **la base**.
- **Auditoría (R1) en la misma transacción:** `caja.egreso_conciliado` y `caja.egreso_recuperado`, más el evento de F5 en E4.

### E7 — Permisos y restricciones
- **Sólo el dueño:** familia `negocio`, negocio exacto por sesión, nunca del cuerpo. Rutas bajo `/api/negocio/caja/egresos/[id]/…` (protección de origen existente).
- **El cajero y los empleados no ven ni ejecutan nada nuevo;** el cierre ciego queda intacto. Un recupero sólo cambia el total esperado del turno receptor, como cualquier ingreso.
- **Aislamiento:** egreso, caja, turno y proveedor del mismo negocio; un registro de otro negocio responde 404.
- **Sin cambios en:** la compensación `TURNO_ABIERTO`, la revisión y la confirmación de retiros, la entrega a custodia y el cierre.

## 4. Matriz de efectos financieros

| Escenario | Operación / patas | Cuenta efectivo | Turno cerrado original | Turno receptor | Proveedor (F5) | Reportes | Auditoría |
|---|---|---|---|---|---|---|---|
| E1 sin salida | **Ninguna** | Sin cambio | Intacto; «sobrante conciliado» informativo | — | — | Egreso efectivo = 0 | `caja.egreso_conciliado` |
| E2 excedente | **Ninguna** | Sin cambio | Intacto; parte del sobrante conciliada | — | — | Efectivo = real | `caja.egreso_conciliado` |
| E3 recupero | `RECUPERO_EGRESO` + 1 pata `+X` | +X en la caja receptora | Intacto | Esperado +X | — | Línea «recuperos de egresos» | `caja.egreso_recuperado` |
| E4 + conciliación | Ninguna en Caja | Sin cambio | Intacto | — | `AJUSTE_DEUDA` `ERROR_DE_CARGA` +X | Pagos efectivos −X | + evento F5 |
| E4 + recupero | `RECUPERO_EGRESO` + 1 pata `+X` | +X | Intacto | Esperado +X | `AJUSTE_DEUDA` +X | Pagos efectivos −X; recupero | + evento F5 |
| E5 confirmado | Excedente o recupero (como E2/E3) | Según el caso | Intacto | Según el caso | — | Retiros efectivos | Ídem |
| E5 no recibido, sin salida | Ninguna | Sin cambio | Intacto; sobrante conciliado | — | — | Retiro efectivo 0 | Ídem |
| E5 no recibido, salió y se perdió | Ninguna (sólo observación existente) | Sin cambio | Intacto | — | — | Sigue como retiro con observación | Revisión existente |

## 5. Migración nueva y aditiva (propuesta; nunca se edita `20261118150000` ni ninguna histórica)

`<fecha>_f10_d1_conciliacion_recupero_egresos`:

1. **`conciliaciones_egresos_caja`:**
   - `id`, `negocioId`, `egresoId`, `turnoCajaId` (el cerrado original);
   - `tipo` CHECK `SIN_SALIDA` | `IMPORTE_EXCEDENTE`, `importeDecimal` > 0, `motivo` NOT NULL;
   - `obligacionAjusteId` opcional (E4), `actorTipo='NEGOCIO'`, `actorId`;
   - `idempotencyKey` único por negocio, `idempotencyFingerprint`, `createdAt`;
   - claves foráneas compuestas por negocio; filas inmutables (trigger).
2. **`recuperos_egresos_caja`:**
   - `id`, `negocioId`, `egresoId`, `operacionId` (único), `turnoCajaId` (receptor, NOT NULL), `cajaFisicaId`;
   - `importeDecimal` > 0, `motivo`, `obligacionAjusteId` opcional;
   - actor, idempotencia y `createdAt`; inmutable.
3. **Guardas nuevas** (funciones y triggers **nuevos**; no se reemplaza ninguna existente):
   - `guard_conciliacion_egreso_caja`: el turno del egreso está CERRADO; el egreso no está compensado; para un
     `RETIRO_DUENO` `CONFIRMADO` sólo `IMPORTE_EXCEDENTE`; tope `Σ ≤ importe` (con bloqueo de la fila del egreso).
   - `guard_operacion_recupero_egreso` y `guard_movimiento_recupero_egreso`: una operación `RECUPERO_EGRESO` exige un
     turno ABIERTO de la caja de destino y **una sola** pata positiva en la cuenta `EFECTIVO` de esa caja; inmutable.
   - `guard_recupero_egreso_caja`: coherencia fila–operación–importe y el mismo tope compartido.
4. **Sin cambios** en `egresos_caja`, `compensaciones_egresos_caja`, `turnos_caja`, entregas, revisiones ni en las
   tablas de F5 (E4 reutiliza `AJUSTE_DEUDA`).
5. Antes de Production, la migración se ensaya sobre la copia restaurada de Production (P0-03, T6).

## 6. Servicio, API e interfaz (alcance mínimo)

- **Servicio** `caja-egresos-correccion-service.ts`: `conciliarEgresoCerrado` y `registrarRecuperoEgreso`. Reutiliza el
  candado de la caja, `runSerializable`, la idempotencia y la auditoría de F10-C1, y el motor de F5 para `AJUSTE_DEUDA`.
- **API del dueño:**
  - `POST /api/negocio/caja/egresos/[id]/conciliacion`;
  - `POST /api/negocio/caja/egresos/[id]/recupero`;
  - el detalle existente del egreso agrega `conciliado`, `recuperado`, `pendiente` y su historial.
- **Interfaz:**
  - en Caja → Egresos (dueño), en el detalle de un egreso de turno cerrado, un botón «Corregir egreso» con dos opciones guiadas;
  - en el detalle del turno cerrado, la línea informativa de conciliación;
  - en Resumen, la línea «recuperos de egresos».
  - Nada nuevo para el cajero.
- **Pruebas previstas (CI, PostgreSQL efímero):**
  - E1–E5;
  - tope por egreso;
  - repetición y clave reusada;
  - carreras recupero contra cierre y conciliación contra conciliación;
  - otro negocio y empleado (rechazos sin efectos);
  - guardas SQL directas;
  - turno cerrado igual campo por campo;
  - reportes.
  - Después, certificación funcional en TESTING.

## 7. Decisiones del operador (sólo las que faltan)

- **DF-1 — Egreso registrado de MENOS (salió más de lo cargado; el cierre mostró faltante).**
  - Recomendación: **fuera de F10-D1**. Ese efectivo ya no está, así que no hay dinero que mover ni sobrante que explicar.
  - El faltante queda en el cierre con su revisión, y el dueño lo explica con la observación existente.
  - Registrar un «complemento de egreso» sin movimiento sería una clasificación contable nueva, que no está en el alcance aprobado.
  - Alternativa: incluir un tipo `COMPLEMENTO` informativo, sin movimiento, que cuente como gasto en los reportes.
- **DF-2 — Naturaleza del ajuste de deuda en un recupero de proveedor.**
  - Recomendación: `DIFERENCIA_ACORDADA` (ya existe; sin cambiar la CHECK de F5).
  - Alternativa: una naturaleza nueva `DEVOLUCION_PROVEEDOR`, que exige reemplazar la CHECK de F5 en una migración nueva.
- **DF-3 — Período del recupero en los reportes.**
  - Recomendación: el recupero cuenta en **el día en que entra el dinero**, y el día original sólo muestra «recuperado X» como nota, sin reescribir reportes pasados.
  - Alternativa: restarlo del período del egreso original.

Lo que **no** se pregunta, porque ya está decidido:
- sólo el dueño;
- sin reabrir turnos;
- sin dinero ficticio;
- correcciones por registros nuevos e inmutables;
- naturalezas separadas;
- el bloqueo SQL de `20261118150000` se mantiene;
- migraciones sólo aditivas;
- F10-D1 antes de Production.
