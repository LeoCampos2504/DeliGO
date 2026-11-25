# F10-C — Egresos de Caja · diseño y estado de F10-C1a / F10-C1b / F10-C1c

Estado: `F10_C1_STATUS=CLOSED_TESTING_CERTIFIED (2026-11-19, testing-codex bfaba2a; ver §16)` · histórico: `F10_C_STATUS=C1A_C1B_C1C_IMPLEMENTED_LOCAL_NOT_COMMITTED` · `F10_C1C_POST_CLOSE_COMPENSATION=BLOCKED_PENDING_F10_D` · `F10_C_DECISIONS=D1_D11_APPROVED_WITH_4_ADJUSTMENTS (2026-11-18)` ·
Base de código: `testing-codex` `4294123` (worktree local `deligo-dev-local`, rama `dev/local-f4c`).
2026-11-18: el operador aprobó D1–D11 con cuatro ajustes obligatorios (§11.1) y autorizó **F10-C1a** (§13) y luego
**F10-C1b** (§14, interfaz del cajero) y **F10-C1c** (§15, panel del dueño, supervisión, compensaciones y reportes),
todos **sólo en el entorno local**. C2, F10-D/E y F5 **no** están autorizados;
sin commit, push ni despliegue; Railway TESTING, Production y los datos de `paola-vinal` no se tocaron.

## 1. Objetivo y alcance

Registrar **salidas de efectivo de una caja física** (pagos a proveedores en el momento, gastos operativos, retiros
del dueño y otros egresos identificados) con:

- descuento **inmediato** del efectivo esperado del turno (requisito 6 aprobado en F10, 2026-10-08);
- **sin autorización previa** del dueño: el control es **posterior** (revisión: Sin revisar · Revisado · Observado;
  los estados **no** vuelven a mover dinero);
- trazabilidad completa (caja, turno, actor, importe, tipo, motivo, fecha-hora, cuenta, proveedor/comprobante si existen);
- inmutabilidad: nadie borra ni reescribe un egreso confirmado; las correcciones son operaciones compensatorias.

Fuera de alcance de F10-C1 (etapas o módulos propios): recepciones de mercadería y stock (F10-C2), egresos por
transferencia/Mercado Pago y cuentas del negocio (F10-D), cambios efectivo↔transferencia (F10-E), cuentas por pagar y
catálogo de proveedores (F5), consumo interno, operación offline (D9: sólo en línea).

## 2. Lo que ya existe y se reutiliza

| Pieza | Uso en F10-C |
|---|---|
| Libro `OperacionFinanciera` + `MovimientoFinanciero` + `CuentaFinanciera` (`efectivo_caja_fisica:{caja}`, `efectivo_caja_sin_asignar`) | Un egreso = una operación con **una pata negativa** en la cuenta de efectivo de la caja |
| `calcularSnapshotEfectivoTurno` (fondo + patas de la cuenta de la caja atribuidas al turno; ya separa `ingresosEfectivo` / `salidasEfectivo`) | El esperado del turno y el cierre ciego incluyen el egreso **sin cambiar la fórmula** |
| Turnos (F10-B2.x): una caja = un turno abierto; un turno por empleado; uno del dueño por negocio; el dueño puede operar sobre la caja de un turno de empleado (F10-B2.2-A) | Destino del egreso y responsabilidad |
| Idempotencia (Idempotency-Key + huella, replay 200 / clave reusada 409) y reintentos acotados ante 40001/40P01 (E2) | Mismo contrato para registrar egresos y revisiones |
| **R1**: auditoría con `auditLogWithClient(tx)` en la misma transacción | Obligatorio desde el diseño |
| Avisos al dueño (`notificacion` en la misma transacción) y `nombreVisibleEmpleado` | Aviso por cada egreso de un empleado |
| Contratos estáticos del cierre ciego (el cajero nunca recibe esperado/diferencia/totales) | Se extienden a las rutas nuevas del cajero |

## 3. Modelo (migración ADITIVA)

La propuesta inicial de esta sección (una sola tabla, con el retiro como categoría) fue **reemplazada** por el modelo
aprobado e implementado en F10-C1a: tres naturalezas con tipos de operación propios, historial de revisiones y
compensaciones preparadas. Ver **§13.1** (migración) y **§13.2** (modelo financiero).

## 4. Flujo de registro (servicio único, una transacción Serializable)

1. Autenticación: dueño (sesión de negocio) o cajero (sesión operativa, área `caja`, mismo negocio). Idempotency-Key obligatoria.
2. Replay/clave reusada por huella (antes de cualquier escritura).
3. Resolución del turno, **con bloqueo de la fila del turno** (`FOR UPDATE`, como el cierre):
   - **cajero**: SU turno abierto (nunca uno elegido por el cuerpo); sin turno → `409 TURNO_REQUERIDO` (ver D2);
   - **dueño**: la caja elegida debe tener un turno abierto (propio o de un empleado: operación identificada como del dueño);
     sin caja elegida y con varias cajas abiertas → `409 CAJA_SELECCION_REQUERIDA`.
4. Validaciones (categoría, importe, motivo, tope) — rechazos **devueltos**, sin escrituras (lección E1).
5. Escrituras: operación `EGRESO_GASTO` o `RETIRO_DUENO` + pata negativa en `efectivo_caja_fisica:{caja}` atribuida al turno + fila
   `egresos_caja` + aviso al dueño si actuó un empleado + **auditoría `caja.egreso_registrado` en la misma transacción (R1)**.
6. Reintentos acotados ante conflictos de serialización (mismo esquema que E2); respuesta 201 sin esperado ni saldos.

**Carrera con el cierre ciego:** el egreso y el cierre bloquean la misma fila del turno: o el egreso entra antes y el
cierre lo incluye en el esperado, o el cierre gana y el egreso recibe `409 TURNO_NO_ABIERTO` sin escribir nada.

## 5. Revisión del dueño (control posterior)

- Lista por fecha / caja / turno / responsable / categoría / estado; detalle con quién, cuándo, cuánto, motivo, proveedor.
- Acciones: **Revisado** u **Observado** (con observación). Idempotentes, auditadas en la misma transacción
  (`caja.egreso_revisado`), **sin mover dinero**.
- Un egreso erróneo **no se edita**: se compensa con una operación de reversión explícita del dueño (motivo obligatorio,
  pata positiva, auditoría) — propuesta para C1c o etapa posterior (D9).
- Alertas **informativas** por importes elevados (umbral configurable por negocio, sin bloqueo), como las P1 de F4-C.

## 6. Interfaz

- **Cajero (Operaciones → Caja)**: botón «Registrar egreso» visible sólo con turno abierto; formulario (importe,
  categoría, motivo, proveedor opcional); confirmación explícita; diálogo de éxito accesible; lista de **sus** egresos
  del turno (importes individuales, sin totales comparados con el esperado ni diferencia — cierre ciego).
- **Dueño (Caja → Cajas y turnos / Egresos)**: registrar egreso eligiendo caja; revisión; en el detalle del turno,
  separar «salidas por reintegros» y «egresos de caja» (hoy `salidasEfectivo` las suma juntas).
- **Resumen del día (dueño)**: «Egresos de caja hoy» por categoría, separado de devoluciones/reintegros; el neto de
  ventas no cambia (un egreso no es una devolución).

## 7. Permisos

| Acción | Dueño | Cajero (área caja, habilitado) |
|---|---|---|
| Registrar egreso | Sí, en una caja con turno abierto | Sí, sólo en SU turno abierto |
| Ver egresos | Todos | Sólo los propios del turno actual (sin totales/esperado) |
| Revisar / observar | Sí | No |
| Revertir | Sí (compensación auditada) | No |
| Configurar umbrales de alerta | Sí | No |

## 8. Pruebas previstas

- Unitarias de validación y huella; integración con PostgreSQL real: alta, replay, clave reusada, rechazo sin escrituras,
  egreso del dueño en caja de un empleado, aislamiento entre cajas/negocios/empleados.
- **Esperado del turno**: fondo + ventas − reintegros − egresos; cierre ciego con egresos; entrega/remanente sin cambios.
- **Concurrencia**: doble clic con la misma clave (1 egreso), claves distintas en paralelo, **egreso vs cierre** en
  ambos órdenes, revisión concurrente.
- **R1**: falla forzada de la auditoría del egreso y de la revisión → rollback completo (JS y SQL), reintento limpio.
- Contratos estáticos: ninguna ruta del cajero devuelve esperado/diferencia/totales.
- UI: formularios, confirmación, accesibilidad (nombres, diálogos en castellano — no repetir E7), 375 px.
- QA: escenarios nuevos en la suite aislada y una fase del runner para TESTING (con autorización).

## 9. Etapas propuestas

| Etapa | Contenido |
|---|---|
| **C1a** | Migración aditiva + servicio + API (dueño y cajero) + auditoría/avisos + pruebas de integración y concurrencia |
| **C1b** | Interfaz del cajero |
| **C1c** | Revisión del dueño, detalle de turno separado, resumen del día, umbrales; reversión compensatoria (si se aprueba D9) |
| **C2** | Recepciones de mercadería pendientes de aprobación + aprobación atómica del stock (requiere actualizar el contrato R3A) y vínculo opcional pago↔recepción |
| **C3** | Certificación en TESTING (runner + SQL de sólo lectura), incluido OBLIGATORIO si para entonces está habilitado |

## 10. Clasificación contable y límites (para no contar dos veces)

Reglas iniciales del operador (2026-11-17), tomadas como base: (1) empezar por egresos en efectivo de Caja · (2) turno
abierto obligatorio para sacar efectivo físico · (3) categorías de gastos y movimientos de retiro · (4) sin autorización
previa del dueño por egreso del cajero · (5) aviso al dueño y revisión posterior · (6) comprobante opcional · (7) sin
bloqueo automático por esperado insuficiente: advertencia y justificación · (8) correcciones por compensación, sin
borrar historia · (9) proveedor opcional · (10) historial y auditoría de todos los responsables · (11) cajero limitado a
su turno; dueño supervisa todo el negocio.

Cuatro naturalezas distintas, que **nunca** se suman entre sí en los reportes (ajuste 1 del operador, 2026-11-18: el
pago a proveedor se separa del gasto operativo):

| Naturaleza (tipo de operación) | Qué es | Libro | ¿Es gasto del período? | Etapa |
|---|---|---|---|---|
| **Gasto operativo** (`GASTO`) | El dinero sale hacia un tercero por un gasto que se consume: insumos, servicios, transporte, mantenimiento, otros | 1 pata negativa en `efectivo_caja_fisica:{caja}` | **Sí** | F10-C1 |
| **Pago a proveedor** (`PAGO_PROVEEDOR`) | Paga una compra/mercadería o una deuda con un proveedor | 1 pata negativa en la caja | **No por sí mismo**: el costo es la compra/recepción (F10-C2/F5); el pago la cancela | F10-C1 |
| **Retiro del dueño** (`RETIRO_DUENO`) | El dinero sale de la caja hacia el dueño o alguien autorizado por el dueño (no paga nada del negocio) | 1 pata negativa en la caja (en F10-D, contrapartida en una cuenta del dueño si se decide) | **No** (retiro/distribución) | F10-C1 |
| **Movimiento entre cuentas propias** (`TRANSFERENCIA_INTERNA`) | Caja → caja fuerte/resguardo, caja → banco/Mercado Pago, caja → otra caja | 2 patas que suman cero | **No** (ni ingreso ni gasto) | **F10-D/E**, no en C1 |

Reglas de no doble conteo:
- El **depósito al banco o a la caja fuerte NO es un egreso**: es una transferencia interna (F10-D/E). En C1 no se
  ofrece como categoría ni como naturaleza.
- La **entrega de custodia del cierre** (F10-B2.2-E, destino dueño o resguardo) hoy **no mueve el libro**: sólo divide
  el efectivo contado (verificado en `caja-turnos-entrega.ts`: no crea operaciones ni movimientos). Un retiro del dueño
  **durante** el turno se registra como `RETIRO_DUENO` (baja el esperado); el dinero entregado **al cierre** sigue
  siendo entrega de custodia. El mismo dinero nunca es retiro y entrega a la vez. Cuando F10-D cree cuentas de
  resguardo/dueño, la entrega pasará a ser una transferencia interna (no un retiro ni un gasto).
- Reportes: «gastos» = sólo `GASTO`; «pagos a proveedores» = sólo `PAGO_PROVEEDOR` (nunca sumados a los gastos: en F5
  el costo de la mercadería viene de la compra/recepción y el pago sólo la cancela, así el mismo costo no se cuenta
  dos veces); «retiros del dueño» = sólo `RETIRO_DUENO`; transferencias internas fuera de todos; reintegros de
  devoluciones (F4-A) siguen separados («salidas por reintegros»). El neto de ventas no cambia.

**Pago a proveedor ≠ recepción de mercadería.** El pago (`PAGO_PROVEEDOR`) mueve **dinero** y no toca el stock. La recepción (F10-C2) mueve **stock** (pendiente → aprobada mediante la autoridad R3A) y no toca
dinero. Se vinculan sólo como **referencia opcional** (un pago puede cubrir una, varias o ninguna recepción; una
recepción puede quedar impaga). El saldo con cada proveedor (cuentas por pagar) es de **F5**: en C1 no se calcula
ninguna deuda ni se infiere stock desde un pago.

## 11. Decisiones D1–D11 (APROBADAS 2026-11-18 con los ajustes de §11.1)

Impacto: **[FIN]** cambia el modelo financiero (libro, tipos de operación, atribución al turno) · **[ESQ]** agrega
esquema de control no financiero (campos/tablas que no mueven dinero) · **[UI]** sólo interfaz o configuración.

### D1 — Medio del egreso en C1 · [FIN]
- **Recomendación:** sólo **efectivo de la caja física** (regla 1). Columna `medio = EFECTIVO` con un CHECK que hoy
  admite sólo ese valor (ampliable más adelante sin migrar datos).
- **Alternativa:** (b) incluir transferencia/Mercado Pago ya en C1.
- **Consecuencias:** (a) todo egreso baja el esperado de un turno y entra en el cierre ciego; los pagos por
  transferencia esperan a F10-D (cuentas, declarado vs acreditado). (b) obligaría a crear cuentas no-efectivo y
  conciliación antes de tiempo; además un egreso por transferencia no debe tocar el esperado de efectivo.

### D2 — Turno abierto obligatorio · [FIN]
- **Recomendación:** **siempre** exigir turno abierto, también en modo OPCIONAL (regla 2). Cajero: sólo SU turno.
  Dueño: una caja con turno abierto (propio o de un empleado; queda registrado como operación del dueño, y el egreso
  aparece en la lista del cajero de ese turno como «registrado por el dueño», importe individual sin totales).
- **Alternativa:** (b) permitir egresos sin turno desde `efectivo_caja_sin_asignar` en OPCIONAL.
- **Consecuencias:** (a) todo egreso tiene caja física y responsable; el esperado y la revisión del turno lo reflejan;
  el dueño sin turno abierto debe abrir uno. (b) dinero saliendo de una cuenta sin caja ni responsable: difícil de
  controlar y conciliar, y mezcla efectivo de turnos distintos.

### D3 — Naturalezas y categorías · [FIN] (naturaleza) / [ESQ] (categoría)
- **Recomendación:** dos naturalezas habilitadas, **cada una con su propio tipo de operación** en el libro
  (`EGRESO_GASTO`, `RETIRO_DUENO`); categorías de gasto fijas en C1: `PAGO_PROVEEDOR`, `INSUMOS`, `SERVICIOS`,
  `TRANSPORTE`, `OTRO` (con detalle obligatorio). `TRANSFERENCIA_INTERNA` reservada para F10-D/E.
- **Alternativas:** (b) un único tipo «egreso» con el retiro como categoría (propuesta original de este documento);
  (c) categorías configurables por negocio desde el inicio.
- **Consecuencias:** (a) los reportes de F10-D/E separan gasto y retiro por tipo de operación, sin depender de una
  categoría editable. (b) gasto y retiro compartirían tipo: riesgo real de sumarlos juntos. (c) exige tabla y
  pantallas de configuración ahora; puede agregarse después mapeando la categoría fija a la configurable.

### D4 — Retiro del dueño · [FIN]
- **Recomendación:** `RETIRO_DUENO` registrable por el **dueño** (en una caja con turno) y por el **cajero** cuando el
  dueño se lleva efectivo durante el turno; si lo registra el cajero, el dueño recibe aviso y en la revisión
  **confirma u observa** la recepción (no mueve dinero). No reemplaza la entrega de custodia del cierre.
- **Alternativas:** (b) retiro sólo registrable por el dueño; (c) retiros sólo al cierre, mediante la entrega.
- **Consecuencias:** (a) refleja la práctica real (el dueño pasa y se lleva efectivo) sin dejar faltantes inexplicables
  al cierre. (b) obliga al dueño a tener sesión abierta para cada retiro; si no lo hace, el cierre muestra faltante.
  (c) deja el esperado desalineado durante el turno y confunde retiro con custodia.

### D5 — Esperado insuficiente · [ESQ] (+ [UI])
- **Recomendación:** **no bloquear** (regla 7). El servidor calcula en la transacción si el egreso deja el esperado del
  turno por debajo de cero y guarda `excedeEsperado` (+ el esperado previo, visible sólo para el dueño). El **motivo**
  es obligatorio para todos. **Dueño:** si `excedeEsperado`, ve la advertencia con importes y debe escribir una
  **justificación adicional**. **Cajero:** **no** ve ninguna advertencia basada en el esperado (cierre ciego); su
  egreso se registra igual con la marca y el dueño recibe aviso **prioritario**.
- **Alternativas:** (b) bloquear con «fondos insuficientes»; (c) advertir también al cajero y pedirle justificación.
- **Consecuencias:** (a) no filtra el esperado al cajero y deja el control al dueño. (b) contradice la regla 7 y revela
  el esperado. (c) cumple literalmente la regla 7 pero revela un bit del esperado por intento: probando importes el
  cajero podría deducir cuánto efectivo «debería» haber.
- **Nota:** es el único punto donde la recomendación se aparta de la regla inicial 7 — la advertencia y la
  justificación adicional quedan **sólo del lado del dueño**.

### D6 — Comprobante · [ESQ] (+ [UI])
- **Recomendación:** **opcional** (regla 6): en C1 sólo una referencia de texto (número de factura/ticket). Foto del
  comprobante en una etapa posterior con decisión propia.
- **Alternativas:** (b) foto obligatoria; (c) foto opcional ya en C1.
- **Consecuencias:** (a) sin almacenamiento de archivos ni datos personales nuevos. (b)/(c) requieren almacenamiento,
  privacidad, retención y límites de tamaño; (b) además frena la operación cuando no hay comprobante.

### D7 — Umbral de alerta · [UI] (configuración)
- **Recomendación:** por negocio y opcional: importe a partir del cual un egreso registrado por un empleado genera un
  aviso **destacado** al dueño; nunca bloquea ni pide pasos extra al cajero. Por defecto, sin umbral (todos los
  egresos de empleados avisan igual, regla 5).
- **Alternativas:** (b) umbral fijo global; (c) sin alertas diferenciadas.
- **Consecuencias:** (a) cada comercio ajusta según su escala (como los umbrales P1 de F4-C). (b) no sirve igual para
  un kiosco que para un almacén. (c) los egresos grandes se pierden entre los avisos comunes.

### D8 — Revisión del dueño · [ESQ]
- **Recomendación:** estado vigente (`SIN_REVISAR` / `REVISADO` / `OBSERVADO`) **más historial** de revisiones (quién,
  cuándo, observación), idempotente y auditado en la misma transacción (regla 10). Nunca mueve dinero.
- **Alternativa:** (b) un único estado sin historial.
- **Consecuencias:** (a) igual que la revisión de turnos (F10-B2.2-D): trazabilidad completa. (b) se pierde quién
  cambió el estado y cuándo.

### D9 — Corrección por compensación · [FIN]
- **Recomendación:** sólo el dueño revierte un egreso con una **operación compensatoria** (`REVERSION`: pata positiva
  por el mismo importe en la misma cuenta, motivo obligatorio, vínculo al egreso original, auditoría en la
  transacción); el original queda intacto (regla 8). Reversión **total**; el importe correcto se registra como egreso
  nuevo. En C1 se permite **sólo mientras el turno original está abierto**; un error descubierto después del cierre se
  corrige en F10-D como ajuste de cuenta, **sin tocar el turno cerrado** ni su revisión.
- **Alternativas:** (b) revertir después del cierre imputando a otro turno; (c) sin reversión en C1.
- **Consecuencias:** (a) cierres, esperados y revisiones nunca cambian retroactivamente. (b) movería dinero a un turno
  que no lo tuvo (diferencias falsas en ese cierre). (c) obliga a «compensar» con movimientos inventados.

### D10 — Permiso del cajero · [UI] (+ [ESQ] si hubiera tope)
- **Recomendación:** todo empleado con área `caja`, habilitado para turnos y con turno abierto registra egresos de
  **su** turno sin autorización previa (reglas 4 y 11) y ve sólo los de ese turno. El dueño registra en cualquier caja
  con turno, ve todo el negocio y es el único que revisa y revierte. Sin tope bloqueante en C1.
- **Alternativas:** (b) permiso específico por empleado; (c) tope máximo por egreso que bloquee.
- **Consecuencias:** (a) simple y coherente con el control posterior. (b) agrega gestión de permisos por empleado
  (posible después, sin cambiar el libro). (c) contradice la regla 4 para montos altos legítimos.

### D11 — Proveedor · [ESQ] en C1 / [FIN] en F5
- **Recomendación:** opcional siempre (regla 9), también en `PAGO_PROVEEDOR` (la UI lo sugiere, no lo exige): nombre
  en texto libre y, opcionalmente, CUIT. Sin saldo de proveedor en C1. Vínculo pago↔recepción como referencia opcional
  en C2/F5 (ver §10).
- **Alternativas:** (b) catálogo de proveedores ya en C1; (c) proveedor obligatorio en pagos a proveedor.
- **Consecuencias:** (a) no adelanta F5; cuando exista el catálogo podrá asociarse el texto a un proveedor. (b) es F5
  (cuentas por pagar). (c) frena pagos al paso cuando el proveedor no está identificado.

### Resumen de impacto

| Cambia el modelo financiero [FIN] | Esquema de control no financiero [ESQ] | Sólo interfaz / configuración [UI] |
|---|---|---|
| D1 medio · D2 turno obligatorio · D3 naturalezas como tipos de operación · D4 retiro · D9 compensación (· D11 al llegar F5) | D3 categorías · D5 marca y justificación · D6 referencia de comprobante · D8 historial de revisión · D11 proveedor en texto | D7 umbral · D10 permisos sin tope · textos y avisos de D5/D6 |

Las decisiones [FIN] conviene fijarlas **antes de C1a** (definen la migración y los tipos de operación); las [ESQ]
también entran en la migración de C1a; las [UI] pueden ajustarse en C1b/C1c sin migrar datos.

### 11.1 Ajustes obligatorios del operador (2026-11-18) y cómo quedaron

| # | Ajuste | Resolución en C1a |
|---|---|---|
| 1 | Diferenciar el pago a proveedor del gasto operativo (F5 lo vincula a compras/mercadería sin contar dos veces el costo); retiros y transferencias propias separados | `PAGO_PROVEEDOR` es su **propio tipo de operación** y naturaleza (ya no una categoría de gasto); `GASTO` lleva categoría (`INSUMOS`, `SERVICIOS`, `TRANSPORTE`, `MANTENIMIENTO`, `OTRO`); `RETIRO_DUENO` aparte; `TRANSFERENCIA_INTERNA` no existe en C1 (la migración ni la menciona) |
| 2 | Retiro registrado por un cajero: identificar quién entrega, destinatario, importe y motivo; salida inmediata; confirmación posterior sin otro movimiento, con trazabilidad | Quien entrega = el actor de la sesión (empleado o dueño), nunca del cuerpo; `destinatarioTipo` (`DUENO` / `AUTORIZADO_POR_DUENO`) + `destinatarioNombre` obligatorios (CHECK); el efectivo sale al registrar (pata negativa, esperado baja); el dueño confirma **una vez** (`CONFIRMADO` / `NO_RECIBIDO` con observación) → fila en `revisiones_egresos_caja` + auditoría, **ningún** movimiento financiero (verificado por prueba). Si lo registra el dueño: `NO_REQUERIDA` |
| 3 | Preparar desde C1a las compensaciones posteriores al cierre; nunca reabrir ni modificar importes de un turno cerrado | Tabla `compensaciones_egresos_caja` + guardas SQL (§13.1). `TURNO_ABIERTO`: misma caja y mismo turno todavía abierto. `POSTERIOR_AL_CIERRE`: operación `REVERSION` **sin turno** (`turnoCajaId` NULL) → ningún esperado, cierre, entrega ni revisión cambia. Ejecución (servicio, API, UI) en **C1c** — ver §13.7 (resolución antes de Production y restricciones mientras tanto) |
| 4 | Ninguna advertencia al cajero basada en el esperado; el dueño recibe alertas por retiros, umbrales y esperado negativo; sin bloqueo | El cajero no recibe ni puede enviar datos del esperado (respuesta y lista sin esperado/alertas/totales; `justificacion` y `cajaFisicaId` rechazados en su cuerpo). Aviso al dueño por **cada** egreso de un empleado; prioridad **ALTA** si es retiro, si supera el umbral del negocio o si deja el esperado negativo. Nada bloquea; el dueño que registra un egreso que deja el esperado negativo ve los importes y justifica |

## 12. Riesgos

- Mezclar «egreso» con «reintegro» en reportes (mitigado separando tipos y vistas).
- Revelar el esperado al cajero por mensajes de error (D5) o por totales en su lista.
- Carreras con el cierre (mitigado con el bloqueo de la fila del turno y pruebas en ambos órdenes).
- Uso del egreso para encubrir faltantes: control posterior, avisos y alertas; no se puede eliminar ni editar.
- Contención Serializable en cajas muy activas (mismo patrón E2 de reintentos acotados).
- R2/R3/R4 siguen abiertos y no se resuelven con F10-C.
- Riesgos restantes después de C1a: ver §13.8.

## 13. F10-C1a — implementación LOCAL (2026-11-18)

`F10_C1A_STATUS=IMPLEMENTED_LOCAL_TESTS_PASS_NOT_COMMITTED` · worktree `C:\Leo Campos\Trabajo\deligo-dev-local`
(rama `dev/local-f4c` = `origin/testing-codex` `4294123` + cambios sin commit) · sin commit, push ni despliegue ·
Railway TESTING, Production y `paola-vinal` sin tocar · `deligo_dev` (base de la app local) **sin migrar**.

Revisión previa pedida por el operador (compatibilidad de los tipos nuevos): **no hizo falta cambiar la fórmula del
cierre**. El esperado del turno se calcula en dos lugares y ninguno filtra por tipo de operación: el servicio
(`calcularSnapshotEfectivoTurno`: fondo + patas de la cuenta de efectivo de la caja atribuidas al turno) y la función
SQL de compatibilidad del cierre (`set_turno_efectivo_esperado_snapshot`, misma suma). Una pata negativa de egreso
atribuida al turno baja el esperado y entra en el cierre ciego sin tocar ninguna de las dos. Entregas de custodia y
traspasos no cambian (parten del esperado congelado al cierre, que ya incluye los egresos). Los reportes del día
(`resumirCobrosCajaDesde`, desglose de cambios/reintegros) leen ventas, cobros y devoluciones, no el libro: un egreso
no los altera (verificado por prueba). Única vista afectada: el detalle de turno del dueño muestra `salidasEfectivo`
= reintegros + egresos juntos hasta que C1c los separe.

### 13.1 Migración `prisma/migrations/20261118120000_f10_c1a_cash_outflows/migration.sql` (aditiva)

| Objeto | Contenido |
|---|---|
| `negocios.cajaEgresoAvisoUmbralDecimal` | `DECIMAL(12,2)` NULL, CHECK `> 0` (NULL = sin umbral). Única columna nueva en una tabla existente |
| `egresos_caja` | `operacionId` único · `turnoCajaId` + `cajaFisicaId` NOT NULL (FK compuesta a `turnos_caja(id, negocioId, cajaFisicaId)`) · `naturaleza` (`GASTO`/`PAGO_PROVEEDOR`/`RETIRO_DUENO`) · `categoria` (sólo `GASTO`: `INSUMOS`/`SERVICIOS`/`TRANSPORTE`/`MANTENIMIENTO`/`OTRO`) · `medio` = `EFECTIVO` · `importeDecimal` > 0 · `motivo` 1–500 · actor (`NEGOCIO` = negocioId / `EMPLEADO` = empleadoId) · proveedor/CUIT/comprobante opcionales (prohibidos en retiros) · destinatario obligatorio sólo en retiros · confirmación del retiro (`NO_REQUERIDA`/`PENDIENTE`/`CONFIRMADO`/`NO_RECIBIDO`) · `esperadoPrevioDecimal` + `excedeEsperado` exacto · umbral vigente + `superaUmbral` · `justificacion` (obligatoria si el dueño registra con esperado negativo; prohibida al empleado) · revisión vigente · Idempotency-Key + huella (`UNIQUE(negocioId, idempotencyKey)`) |
| `revisiones_egresos_caja` | Historial append-only: `REVISION` (`REVISADO`/`OBSERVADO`) y `CONFIRMACION_RETIRO` (`CONFIRMADO`/`NO_RECIBIDO`); observación obligatoria en `OBSERVADO`/`NO_RECIBIDO`; actor siempre el dueño; índice único parcial: una sola confirmación por retiro |
| `compensaciones_egresos_caja` | Preparada (ejecución en C1c): `egresoId` y `operacionId` únicos (una compensación total por egreso), `momento` `TURNO_ABIERTO` (con turno) / `POSTERIOR_AL_CIERRE` (`turnoCajaId` NULL), importe = el del egreso, motivo, actor dueño |
| Guardas SQL (triggers) | `guard_operacion_egreso_caja`: GASTO/PAGO_PROVEEDOR/RETIRO_DUENO sólo con turno ABIERTO del negocio; REVERSION sólo de un egreso, por el dueño, en su mismo turno abierto o sin turno; operaciones inmutables · `guard_movimiento_egreso_caja`: exactamente UNA pata exacta en una cuenta de efectivo de caja física (negativa y de la caja del turno para el egreso; positiva, mismo importe y misma cuenta para la reversión); patas inmutables · `guard_egreso_caja`: la fila coincide con su operación y su pata, turno ABIERTO, empleado del negocio, **esperado previo recalculado en SQL** (no se puede falsear la marca), nace `SIN_REVISAR`; inmutable salvo revisión/confirmación y éstas exigen su fila de historial · `guard_revision_egreso_caja`: historial inmutable; confirmación sólo de retiros `PENDIENTE` · `guard_compensacion_egreso_caja`: coherencia total con el egreso y su REVERSION; nunca sobre un turno cerrado; inmutable |

Verificado: aplicada sobre `deligo_ci` y `deligo_qa_auto` (54 migraciones); `prisma migrate diff` migraciones→esquema
no muestra deriva nueva (sólo los renombres de nombres truncados preexistentes de F10-B2.2-E/F y chat); archivo LF con
un único salto final. No usa DROP/TRUNCATE/DELETE/UPDATE de datos existentes (contrato estático).

### 13.2 Modelo financiero

| Evento | Libro | Efecto en el turno |
|---|---|---|
| Egreso `GASTO` / `PAGO_PROVEEDOR` / `RETIRO_DUENO` | 1 operación de ese tipo + 1 pata `−importe` en `efectivo_caja_fisica:{caja}`, `turnoCajaId` = turno ABIERTO | Esperado baja en el importe (fórmula existente) |
| Confirmación de retiro / revisión | Ninguno | Ninguno (sólo historial + estado + auditoría) |
| Compensación `TURNO_ABIERTO` (C1c) | `REVERSION` con `revierteOperacionId` (columna única existente) + pata `+importe` en la misma cuenta, mismo turno | Esperado vuelve a subir |
| Compensación `POSTERIOR_AL_CIERRE` (C1c) | `REVERSION` **sin turno** + pata `+importe` en la misma cuenta | Ninguno: cierre, esperado congelado, entregas y revisiones intactos; corrige el saldo de la cuenta (F10-D) |

### 13.3 Endpoints (todos con sesión verificada; las mutaciones usan `Idempotency-Key`)

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /api/negocio/caja/egresos` | Dueño | Registra un egreso en la caja elegida (`cajaFisicaId`) o en la única con turno abierto; puede ser turno propio o de un empleado. `409 JUSTIFICACION_REQUERIDA` (con esperado previo y resultante, sólo al dueño) si deja el esperado negativo sin justificación |
| `GET /api/negocio/caja/egresos` | Dueño | Lista (≤ 200) con filtros `desde`, `hasta`, `cajaFisicaId`, `turnoCajaId`, `naturaleza`, `estadoRevision`, `confirmacionPendiente=true`; incluye alertas, historial y compensación |
| `GET /api/negocio/caja/egresos/[id]` | Dueño | Detalle |
| `POST /api/negocio/caja/egresos/[id]/revision` | Dueño | `{ resultado: REVISADO \| OBSERVADO, observacion }`; agrega historial, nunca mueve dinero |
| `POST /api/negocio/caja/egresos/[id]/confirmacion-retiro` | Dueño | `{ resultado: CONFIRMADO \| NO_RECIBIDO, observacion }`; una sola vez, sólo retiros registrados por un empleado; nunca mueve dinero |
| `GET`/`PATCH /api/negocio/caja/configuracion-egresos` | Dueño | `{ umbralAviso: importe \| null }` (informativo, nunca bloquea) |
| `POST /api/operativo/caja/[slug]/egresos` | Cajero (área caja) | Registra en **su** turno abierto; rechaza `cajaFisicaId` y `justificacion` en el cuerpo; respuesta sin esperado, alertas ni totales |
| `GET /api/operativo/caja/[slug]/egresos` | Cajero | Egresos de **su** turno abierto (importes individuales, quién registró: propio/dueño, estado de confirmación del retiro) |

Cuerpo de registro: `naturaleza`, `categoria` (sólo GASTO), `importe`, `motivo`, `proveedorNombre?`,
`proveedorIdentificacion?`, `comprobanteReferencia?` (no en retiros), `destinatarioTipo` + `destinatarioNombre` (sólo
retiros), `cajaFisicaId?` y `justificacion?` (sólo dueño). Servicio único: `src/lib/caja-egresos-service.ts`; HTTP:
`src/lib/caja-egresos-http.ts`. Las rutas nuevas quedan bajo la protección de origen existente del proxy
(`/api/negocio/caja`, `/api/operativo`).

### 13.4 Reglas de permisos

| Acción | Dueño | Cajero (empleado activo, área caja efectiva, sesión personal) |
|---|---|---|
| Registrar gasto / pago a proveedor / retiro | Sí, en cualquier caja con turno ABIERTO (propio o de un empleado) | Sí, sólo en SU turno ABIERTO; sin autorización previa; sin tope |
| Turno obligatorio | Siempre (también en OPCIONAL) | Siempre (también en OPCIONAL) |
| Ver egresos | Todo el negocio, con alertas y esperado previo | Sólo los de su turno abierto, sin alertas, esperado ni totales |
| Revisar / confirmar retiro / configurar umbral | Sí | No (401: no tiene sesión de dueño) |
| Compensar | C1c (sólo dueño) | No |
| Otro negocio | 404 / lista vacía | La sesión no sirve para otro `slug` |

### 13.5 Resultados de pruebas (ejecutadas en esta tarea, entorno local)

| Suite | Base | Resultado |
|---|---|---|
| `src/lib/f10-c1a-egresos.integration.test.ts` (nueva) | `deligo_ci` | **21/21** |
| idem | `deligo_qa_auto` | **21/21** |
| `src/lib/f10-c1a-egresos-r1.integration.test.ts` (nueva, mock de auditoría JS y SQL) | `deligo_ci` y `deligo_qa_auto` | **6/6** y **6/6** |
| `src/lib/f10-c1a-static-contract.test.ts` (nueva) | — | **7/7** |
| Carrera egreso vs cierre (20 carreras por corrida, desfase aleatorio) | `deligo_ci` ×4 + `deligo_qa_auto` ×1 | 100 carreras: egreso primero 78 · cierre primero 22 · invariantes 100/100 |
| Suite QA `qa-auto-negocios-turnos` | `deligo_qa_auto` | **25/25** |
| Batería CI (35 suites; 32 previas + 3 nuevas) | `deligo_ci` | 602 pass / 6 fail → tras ajustar 1 contrato y reejecutar 1 suite: **sólo las 4 fallas preexistentes conocidas** (2 controles LF/CRLF de migraciones en el worktree Windows, lista de escritores de `stockCantidad` R3A, JSON desactualizado de f10-b2-0-money). `f4-c5-intentos` falló por `P1001` (conexión local) y pasó 15/15 al reejecutarla |
| Todos los contratos estáticos y de proxy (53 archivos) | — | 753 pass / 8 fail: las 8 leen archivos que C1a no modifica (3 LF/CRLF de migraciones/R3A ya conocidas + chat V6, ruta de venta del cajero F10-B1, mozo O2, rehash y cookies de sesión: comparaciones de texto con CRLF en este worktree) → **ninguna** causada por C1a |
| Typecheck (`tsc --noEmit`) | — | 0 errores en archivos nuevos o modificados (41 en total, todos preexistentes; 33 sin `prisma/seed.ts` y `scripts/`) |
| ESLint (archivos nuevos y modificados) | — | Limpio |

Contratos existentes actualizados (con comentario de autorización): `f10-b0-static-contract` (escritores de
operaciones y cuentas del libro: + servicio de egresos), `f10-b2-1-static-contract` (atribución al turno abierto:
+ servicio de egresos), `f10-b2-0-static-contract` (escritores de columnas de dinero exacto: + servicio de egresos).

### 13.6 Casos de fallo, rollback e idempotencia (cubiertos por pruebas)

| Caso | Resultado |
|---|---|
| Sin turno abierto (cajero; dueño sin caja abierta o con caja elegida sin turno; turno de otro empleado) | `409 TURNO_REQUERIDO`, cero escrituras |
| Varias cajas abiertas y el dueño no elige | `409 CAJA_SELECCION_REQUERIDA` |
| Datos inválidos (motivo vacío, importe 0/negativo/3 decimales/no numérico/fuera de rango, naturaleza desconocida — incluida `TRANSFERENCIA_INTERNA` —, gasto sin categoría, categoría en pago/retiro, retiro sin destinatario o con proveedor, destinatario en un gasto, cajero que envía caja o justificación, sin Idempotency-Key) | `400` con código, cero escrituras |
| Replay exacto (misma clave y datos, mayúsculas o no) | `200` + `Idempotency-Replayed`, el egreso original, aun después del cierre; nada nuevo |
| Clave reusada con otros datos o por otro actor | `409 IDEMPOTENCY_KEY_REUSED`, nada nuevo |
| Doble clic (6 pedidos simultáneos, misma clave) | 1 egreso, 1 operación, 1 pata, 1 aviso, 1 auditoría |
| 5 egresos simultáneos con claves distintas | 5 egresos con esperados previos exactos y distintos (la guarda SQL lo recalcula) |
| Egreso vs cierre en paralelo | O entra antes y el cierre lo incluye (esperado congelado = libro), o recibe `409` sin escribir; nunca un egreso en un turno cerrado |
| Falla de auditoría (JS o SQL real) en egreso de cajero/dueño, revisión, confirmación o umbral | `500`; rollback total (operación, pata, egreso, aviso, historial, estado, umbral, auditoría); el reintento con la misma clave aplica una sola vez |
| Confirmación repetida u opuesta de un retiro | `409 CONFIRMACION_YA_REGISTRADA`; retiro del dueño o gasto: `409 CONFIRMACION_NO_REQUERIDA` |
| Revisiones concurrentes del mismo egreso | Serializadas por bloqueo de fila: 5 de 5 con historial completo; estado vigente = la última |
| Escritura directa en SQL (defensa en profundidad) | Rechazadas: editar importe/motivo, cambiar revisión o confirmación sin historial, modificar la pata o la operación, segunda pata, pata positiva en un egreso, egreso sin pata coherente, esperado previo falseado, marca de esperado incoherente, operación de egreso en turno cerrado, reversión parcial, segunda reversión, reversión en turno cerrado o en otro turno, compensación incoherente, editar una compensación |

### 13.7 Compensación después del cierre: cómo se resolverá antes de Production y restricciones mientras tanto

**Resolución (C1c, requiere autorización):** servicio único `compensarEgresoCaja` del dueño (motivo obligatorio,
Idempotency-Key, Serializable, bloqueo de la fila de la caja como en el cierre, auditoría `caja.egreso_compensado`
en la misma transacción). El momento lo decide el servidor, nunca el cuerpo: turno original ABIERTO →
`TURNO_ABIERTO` (misma caja y turno; el esperado vuelve a subir); turno CERRADO → `POSTERIOR_AL_CIERRE` (REVERSION
sin turno; el cierre, su esperado, sus entregas y sus revisiones no cambian; el detalle del turno cerrado mostrará la
compensación como explicación informativa del sobrante). Sólo compensación **total**; el importe correcto se registra
como un egreso nuevo. La base de datos ya garantiza (probado en C1a): una sola compensación por egreso, mismo importe
y cuenta, nunca atribuida a un turno cerrado ni a otro turno. F10-D usará esas operaciones sin turno para el saldo de
la cuenta de la caja.

**Restricciones mientras C1c no exista:** no hay API ni interfaz para compensar (contrato estático: ningún código
productivo escribe `compensaciones_egresos_caja` ni operaciones `REVERSION`). Un egreso registrado por error sólo se
puede marcar `OBSERVADO` con su observación; sigue contando en el esperado de su turno (si el efectivo no salió, el
cierre mostrará un sobrante explicado por la observación). **Recomendación de gate:** no promover F10-C1 a Production
sin C1c (compensación ejecutable y certificada). Una eventual prueba en TESTING de C1a/C1b sólo con esta restricción
explícita.

### 13.8 Riesgos restantes

- C1a es sólo API: ningún usuario lo ve hasta C1b (cajero) / C1c (dueño).
- El detalle de turno del dueño suma reintegros y egresos en `salidasEfectivo` hasta C1c.
- `deligo_dev` (base de la app local en `:3000`) no está migrada: antes de reiniciar esa app hace falta
  `deligo-dev.ps1 migrate` (aditivo); con el cliente Prisma nuevo y la base vieja, las lecturas de `negocios` fallarían.
- Los avisos al dueño incluyen texto libre del cajero (motivo, destinatario); sólo los ve el dueño.
- Contención Serializable en cajas muy activas: mismo esquema de reintentos acotados (8) que devoluciones.
- Intermitencia local `P1001` (entorno) observada una vez en la batería; no relacionada con C1a.
- Nada certificado en Railway TESTING (no autorizado); el modo OBLIGATORIO no cambia nada para egresos (siempre exigen
  turno) pero no se probó en TESTING.
- R2/R3/R4 siguen abiertos.
- Artefactos locales ajenos a C1a en el worktree: `next-env.d.ts` (modificado por Next) y `tsconfig.tsbuildinfo`;
  no forman parte de un eventual commit.

### 13.9 Alcance propuesto de C1b y C1c (no autorizados)

- **C1b — interfaz del cajero:** botón «Registrar salida de efectivo» sólo con turno abierto; formulario por naturaleza
  (gasto con categoría; pago a proveedor con proveedor/comprobante opcionales; retiro con destinatario obligatorio);
  paso de confirmación explícito; diálogo de éxito accesible en castellano (no repetir E7); lista de los egresos del
  turno con importes individuales y estado de confirmación del retiro, **sin totales ni señales del esperado**;
  375 px; extensión de los contratos estáticos del cierre ciego a los componentes nuevos.
- **C1c — dueño:** lista con filtros y bandeja de prioridad (retiros pendientes, esperado negativo, umbral), detalle
  con historial, Revisado/Observado, confirmación de retiros, configuración del umbral, separación por naturaleza en el
  detalle del turno («salidas por reintegros» vs gastos / pagos a proveedores / retiros) y en el resumen del día, y la
  **compensación** de §13.7 (servicio + API + interfaz).
- **Fuera de F10-C1:** recepciones de mercadería (C2), transferencias entre cuentas propias (F10-E), cuentas por pagar y
  catálogo de proveedores (F5), certificación en TESTING (C3).

### 13.10 Archivos de C1a (worktree `deligo-dev-local`, sin commit)

Nuevos: `prisma/migrations/20261118120000_f10_c1a_cash_outflows/migration.sql`, `src/lib/caja-egresos-service.ts`,
`src/lib/caja-egresos-http.ts`, `src/app/api/negocio/caja/egresos/route.ts`, `…/egresos/[id]/route.ts`,
`…/egresos/[id]/revision/route.ts`, `…/egresos/[id]/confirmacion-retiro/route.ts`,
`src/app/api/negocio/caja/configuracion-egresos/route.ts`, `src/app/api/operativo/caja/[slug]/egresos/route.ts`,
`src/lib/f10-c1a-egresos.integration.test.ts`, `src/lib/f10-c1a-egresos-r1.integration.test.ts`,
`src/lib/f10-c1a-static-contract.test.ts`. Modificados: `prisma/schema.prisma` (+3 modelos, +1 columna, relaciones),
`src/lib/f10-b0-static-contract.test.ts`, `src/lib/f10-b2-0-static-contract.test.ts`,
`src/lib/f10-b2-1-static-contract.test.ts`.

## 14. F10-C1b — interfaz del cajero, implementación LOCAL (2026-11-18)

`F10_C1B_STATUS=IMPLEMENTED_LOCAL_TESTS_PASS_NOT_COMMITTED` · mismo worktree `deligo-dev-local` (sin commit) · Railway
TESTING, Production y `paola-vinal` sin tocar · C1c **no** iniciado · el motor C1a (servicio, API, migración, guardas
SQL) **no** se modificó para C1b.

### 14.1 Qué hay en Operaciones → Caja

Sección «Salidas de Caja» debajo de «Caja y turno» (`src/components/business/caja-salidas-cajero.tsx`), sólo contra
`GET/POST /api/operativo/caja/[slug]/egresos`:

- **Botón «Registrar salida de Caja»**: habilitado sólo con turno abierto propio; sin turno, deshabilitado y con la
  explicación «Para registrar una salida de Caja necesitás tener un turno abierto…» (asociada por `aria-describedby`).
- **Formulario**: tipo (Gasto · Pago a proveedor · Retiro del dueño, radios con nombre accesible corto y la explicación
  como descripción) · categoría sólo para Gasto · importe en pesos con validación exacta de centavos sin pasar por
  float (coma o punto decimal, sin separador de miles, > 0, ≤ NUMERIC(12,2)) · motivo obligatorio (contador 0/500) ·
  proveedor y número de comprobante opcionales (CUIT sólo en Pago a proveedor) · destinatario obligatorio en Retiro
  (el dueño / persona autorizada por el dueño + nombre; «Vos quedás registrado como quien entrega el efectivo») ·
  medio fijo «Efectivo de la caja».
- **Confirmación** previa con el resumen y «Una vez registrada, la salida no se puede borrar ni editar».
- **Comprobante**: tipo, importe, medio, fecha y hora, referencia corta (`S-XXXXXXXX`), identificador completo, motivo,
  proveedor/comprobante o quien recibió; aviso explícito si fue una repetición («no se registró otra vez»).
- **Historial del turno**: salidas individuales del turno abierto propio (tipo, motivo, hora, referencia, quién la
  registró: vos / el responsable del negocio), **sin totales**.
- **No** se muestra ni se anuncia ninguna confirmación del dueño (C1c no existe todavía).

### 14.2 Seguridad y cierre ciego

- El cuerpo enviado lo arma sólo `validarSalida` (nunca `cajaFisicaId`, `turnoCajaId`, `justificacion`, ids de actor).
- Ningún texto del servidor se muestra: los rechazos se traducen a mensajes fijos por código (`mensajeErrorSalida`),
  así ni un importe ni un saldo pueden filtrarse; ninguna palabra de esperado/saldo/diferencia/insuficiente/umbral en la
  pantalla (prueba de interfaz + contrato estático).
- Fondos insuficientes: la pantalla no valida nada contra el efectivo; respeta C1a (nunca bloquea, nunca avisa al
  cajero).
- 401/403 → el mismo manejo de sesión que el resto de la Caja del cajero.

### 14.3 Doble clic, reintentos e idempotencia

- Una `Idempotency-Key` por contenido exacto (sessionStorage + memoria, alcance negocio + empleado): se **conserva**
  ante corte de conexión o 5xx (el reintento repite, nunca duplica) y se **renueva** tras un éxito o un rechazo 4xx.
- Guarda de envío + botón deshabilitado: doble/triple clic → **un** POST (prueba de interfaz y doble clic real en el
  navegador).
- **Intento incierto** (corte / 5xx): «Volver a editar» queda bloqueado hasta que un reintento con la misma clave lo
  resuelva, para que el cajero no cambie el importe y registre dos veces lo mismo.
- Turno cerrado mientras tanto (409): mensaje claro, vuelve al estado cerrado y relee; nada dice «registrada».

### 14.4 Decisiones visuales y de convivencia con elementos flotantes

- Mismo estilo que «Caja y turno» (tarjeta, botones de 48 px de alto, foco visible, verde para el comprobante, ámbar
  para mensajes). Móvil primero; 3 columnas de tipos desde `sm`.
- **Aviso «Instalar la app» (PWA)**: en Android sin `beforeinstallprompt` (p. ej. HTTP local) la guía manual ocupa
  ~465 px de 812 y tapaba el botón. Corrección mínima en `install-prompt.tsx`, **sin cambiar el flujo de instalación**:
  cada aviso inferior publica su altura viva en `--deligo-install-prompt-h` (se quita al cerrarlo) y lleva la clase
  `deligo-install-prompt`. La Caja del cajero reserva ese espacio debajo del último control (`max(7rem, altura + 1rem)`
  + zona segura), así todo se puede desplazar por encima del aviso; y mientras el formulario, la confirmación o el
  comprobante están abiertos, el aviso y el chat flotante se apartan (`body[data-caja-salida-activa]`, regla CSS) y
  vuelven al cerrarlo. Cerrar el aviso no afecta el formulario (estado independiente; verificado en el navegador).
- **Chat flotante**: misma regla. En esta pantalla, con sesión de cajero (y aun con sesión de dueño en el mismo
  navegador) el chat no se renderiza; la regla se verificó en vivo con un elemento de prueba de la misma clase
  (visible → oculto con el formulario abierto → visible al cerrarlo).
- **Foco**: al abrir, primera opción de tipo; con errores, el primer campo a corregir; en la confirmación, el resumen;
  al registrar, el comprobante; al cerrar el formulario o el comprobante, vuelve a «Registrar salida de Caja».
- **Una sola lectura del historial al cargar** (antes, dos): la sección no lee hasta que el panel de turno conoce el
  turno abierto (`turnoKey` indefinido = desconocido).

### 14.5 Revisión en navegador (app local `:3000`, `deligo_dev`, datos ficticios)

| Ancho | Resultado |
|---|---|
| Escritorio (≈1018 px) | Formulario, confirmación, comprobante e historial correctos; doble clic real → 1 POST (201); sin desborde |
| 375×812 (móvil, Android) | Aviso de instalación visible (465 px): la página reserva 481 px; con desplazamiento el botón queda libre y pulsable (verificado con `elementFromPoint` y toque real); al abrir el formulario el aviso se aparta (`visibility:hidden`, `pointer-events:none`); confirmación y comprobante pulsables y legibles; foco correcto; sin desborde (375 = 375); cerrar el aviso con el formulario abierto conserva lo cargado y libera el espacio (padding vuelve a 112 px) |
| 320×640 | Sin desborde horizontal en cerrado, pago a proveedor, retiro y errores; foco al primer error |
| 412×915 | Sin desborde; foco vuelve al botón al cancelar |
| 768×1024 | Sin desborde; tipos en 3 columnas |

Operaciones financieras creadas en la base local para estas revisiones (ficticias, `almacen-sintetico-uno`, turno
abierto por la prueba de humo de C1a): gasto $123,45 (humo C1a), retiro $3.000,50 (escritorio C1b) y gasto $1,00
(comprobante en móvil). Nada más se registró.

Notas del entorno: (a) en la emulación móvil del panel del navegador el desplazamiento por JavaScript no tiene efecto;
se verificó con desplazamiento real; (b) Turbopack mantuvo en caché una versión vieja de `globals.css`: la caché de
desarrollo (`.next/dev/cache`, generada) se movió a la carpeta temporal de la sesión y se regeneró.

### 14.6 Pruebas (ejecutadas en esta tarea)

| Suite | Base | Resultado |
|---|---|---|
| `src/components/business/caja-salidas-cajero.test.tsx` (nueva, happy-dom): validación pura, cuerpo exacto por tipo, confirmación previa, doble clic → 1 POST, clave conservada en corte/5xx y renovada en 4xx/éxito, intento incierto bloquea la edición, turno cerrado (409), rechazos con textos fijos sin cifras, comprobante, historial sin totales, lectura única, foco por paso, nombres accesibles cortos, sin palabras de esperado/saldo | — | **16/16** |
| `src/lib/f10-c1b-static-contract.test.ts` (nuevo): sólo endpoint del cajero, sin caja/turno/justificación, sin vocabulario reservado, errores sin texto del servidor, claves de intento, sin confirmación del dueño anunciada, cableado de la página, reserva de espacio y regla CSS, aviso PWA sin cambios de flujo | — | **8/8** |
| Página del cajero (`page.test.tsx`, + caso «una sola lectura del historial») · panel de turno | — | **6/6** · **13/13** |
| Aviso de instalación PWA y contratos relacionados (`install-prompt.test.ts`, `android-install-status-static-contract`, `push-manual-optout`) | — | **38/38** (46/46 con el contrato C1b) |
| C1a: `f10-c1a-egresos` · `f10-c1a-egresos-r1` · `f10-c1a-static-contract` | `deligo_ci` | **21/21** · **6/6** · **7/7** (carrera egreso/cierre 17/3) |
| C1a: `f10-c1a-egresos` · `f10-c1a-egresos-r1` | `deligo_qa_auto` | **21/21** (carrera 17/3) · **6/6** |
| Suite QA `qa-auto-negocios-turnos` | `deligo_qa_auto` | **25/25** |
| Batería de Caja, ventas, devoluciones, cambios y turnos (40 suites: las 35 de C1a + 5 de C1b) | `deligo_ci` | 684 pass / 5 fail → **sólo las 4 fallas preexistentes** (2 LF/CRLF de migraciones en el worktree Windows, escritores de `stockCantidad` R3A, JSON de f10-b2-0-money), idénticas a las de la base `4294123` comparada en un worktree temporal; la 5.ª fue el *timeout* intermitente conocido de `f4-c5-static-contract` (5 s bajo carga): reejecutado solo, 6/6 dos veces en ~0,5 s |
| Contratos estáticos y de proxy (comparación con la base) | — | Las mismas 8 fallas en la base `4294123` y en el código con C1a → ninguna regresión (comparación previa a C1b; C1b no toca esos archivos) |
| TypeScript (`tsc --noEmit`) | — | 41 errores, **todos preexistentes** (igual que la base; 0 nuevos tras corregir un tipo en una prueba) |
| ESLint (archivos de C1a y C1b) · `git diff --check` · espacios finales en archivos nuevos | — | Limpio · OK · ninguno |

Datos y migraciones locales: `deligo_dev` 54/54 migraciones aplicadas, 0 incompletas; respaldo previo
`C:\Users\eltig\deligo-dev-db\respaldos\deligo_dev_antes_f10_c1a_20261118-004917.dump`; las tablas existentes sólo
cambiaron por lo registrado a propósito (1 turno abierto para la prueba de humo, 3 salidas ficticias con sus
operaciones, patas, avisos y auditorías).

### 14.7 Archivos de C1b (worktree `deligo-dev-local`, sin commit)

Nuevos: `src/components/business/caja-salidas-cajero.tsx`, `src/components/business/caja-salidas-cajero.test.tsx`,
`src/lib/f10-c1b-static-contract.test.ts`. Modificados: `src/app/operaciones/mi-panel/[slug]/caja/page.tsx` (sección
nueva, espacio inferior), `src/app/operaciones/mi-panel/[slug]/caja/page.test.tsx` (+1 caso),
`src/components/business/operational-shift-panel.tsx` (`onTurnoChange`, opcional), `src/components/shared/install-prompt.tsx`
(altura publicada + clase; flujo intacto), `src/app/globals.css` (regla `data-caja-salida-activa`),
`src/lib/f10-c1a-egresos.integration.test.ts` (sólo tipos de parámetros de prueba). Fuera del commit: `next-env.d.ts`,
`tsconfig.tsbuildinfo` (generados).

### 14.8 Pendientes y preparación para C1c

- *(2026-11-18: C1c autorizado e implementado en local — ver §15; este punto se conserva como estaba.)*
- **C1c (no iniciado, requiere autorización)**: panel del dueño (lista, filtros, bandeja de prioridad, detalle con
  historial), Revisado/Observado, confirmación de retiros, configuración del umbral, separación por naturaleza en el
  detalle del turno y el resumen del día, y la compensación ejecutable (§13.7). Las APIs del dueño ya existen (C1a).
- Mostrar al cajero el estado de confirmación de un retiro: deliberadamente fuera de C1b (el dueño no tiene interfaz
  todavía); decidirlo en C1c.
- Verificar en un teléfono real (Android con HTTPS en TESTING, iOS Safari) el aviso de instalación nativo y el
  teclado virtual; la emulación local cubre la guía manual de Android sobre HTTP.
- El chat flotante no aparece en Operaciones con las sesiones probadas; si en el futuro se habilita allí, la regla ya
  lo aparta mientras el formulario está abierto.
- **Integración con C1c**: C1b no depende de C1c y C1c no necesita cambios en C1b; ambos usan las mismas APIs de C1a.
  Antes de Production sigue vigente el gate de §13.7 (compensación ejecutable en C1c).

## 15. F10-C1c — panel del dueño, supervisión, compensaciones y reportes, implementación LOCAL (2026-11-18)

Autorización del operador (2026-11-18): F10-C1c **sólo en desarrollo local**, sobre el estado de C1a + C1b del worktree
`deligo-dev-local` (rama `dev/local-f4c` = `4294123` + cambios sin commit). Sin commit, push ni despliegue; Railway
TESTING, Production y `paola-vinal` no se tocaron; sin reset ni seed; no se implementó F10-C2, F10-D/E ni F5.
Estado: `F10_C1C_STATUS=IMPLEMENTED_LOCAL_TESTS_PASS_NOT_COMMITTED` ·
`F10_C1C_POST_CLOSE_COMPENSATION=BLOCKED_PENDING_F10_D` (no está terminada: depende de otra fase).

### 15.1 Qué hay en Caja → «Egresos» (dueño)

- Pestaña nueva **Egresos** en la Caja del dueño (`owner-caja-egresos.tsx`), junto a Vender / Cajas y turnos / Resumen.
- **Supervisión visible**: banda «N salidas requieren supervisión (X retiros por confirmar · Y sin revisar)» con botón
  «Ver pendientes»; cada fila pendiente lleva borde y etiqueta «Requiere supervisión». Regla única (servidor):
  retiro de un empleado sin confirmar, **o** salida sin revisar registrada por un empleado / que dejó el esperado
  negativo / que alcanzó el umbral; una salida compensada ya no espera (la compensación fue la decisión).
- **Registrar egreso**: la caja se elige **siempre** explícitamente (aunque haya una sola abierta; sólo se listan
  cajas activas con turno abierto: «Caja — turno de <responsable>»). El cuerpo envía `cajaFisicaId` **y** el
  `turnoCajaId` que el dueño vio: si esa caja cerró y reabrió turno mientras tanto, el servidor responde
  `409 TURNO_CAMBIO` sin escribir y la interfaz vuelve al formulario con la caja vacía. Paso de confirmación con caja,
  responsable, tipo, importe y motivo. Si la salida deja el esperado negativo, el servidor responde
  `409 JUSTIFICACION_REQUERIDA` con las cifras (sólo al dueño) y la interfaz pide la justificación (contenido nuevo →
  clave nueva).
- **Historial con filtros**: desde/hasta (día local inclusive), caja, registrado por (dueño o cada empleado, por nombre
  visible), tipo, categoría (sólo gastos), estado de revisión, «sólo las que requieren supervisión» (la API también
  acepta `compensado=true|false`). Cada fila: tipo con color **y** ícono **y** texto (Gasto operativo / Pago a
  proveedor / Retiro del dueño), categoría, alertas (Esperado negativo, Supera el umbral), «Compensado» (importe
  tachado), motivo, fecha, caja, responsable, referencia `S-XXXXXXXX`.
- **Detalle**: importe, tipo, fecha, caja (turno abierto/cerrado), responsable, destinatario o proveedor/CUIT,
  comprobante, revisión, recepción del retiro, motivo, alertas con cifras y justificación, notas por naturaleza
  («un pago a proveedor no se suma como gasto de rentabilidad», «un retiro no es un gasto») e **historial
  cronológico** (registro, cada revisión, la recepción, la compensación con su motivo).
- **Acciones** (cada una en su propio formulario, con clave de idempotencia por contenido exacto conservada ante
  error de red/5xx — reintento = replay —, renovada ante 4xx/éxito, y bloqueo de doble clic):
  - *Revisar / Agregar revisión*: Revisado u Observado (observación obligatoria). «No modifica dinero».
  - *Confirmar recepción del retiro* (sólo retiros de empleados pendientes y no compensados): Sí lo recibí / No lo
    recibí (observación obligatoria). Una sola vez. «No genera otro movimiento».
  - *Corregir con compensación* (sólo si el turno de la salida sigue abierto): motivo obligatorio + casilla «Confirmo
    que $X de esta salida están físicamente en <caja>» + segunda confirmación explícita («No se puede deshacer y se
    hace una sola vez»). Después ofrece «Registrar la salida correcta» (formulario precargado, misma caja) para
    corregir importe o tipo.
  - Turno cerrado: no hay botón de compensación; aviso explícito de bloqueo y la revisión sigue disponible.
- **Aviso por importe (umbral)**: campo opcional al pie del panel (vacío = sin umbral), usa la API de C1a; no bloquea.
- **Convivencia con elementos flotantes** (misma regla que C1b): el panel reserva al pie la altura publicada por el
  aviso de instalación (`--deligo-install-prompt-h`) y, mientras un formulario financiero está abierto, marca
  `body[data-caja-salida-activa]` para apartar el aviso y el chat flotante; vuelven al cerrarlo.

### 15.2 Flujo completo cajero → dueño

1. El cajero registra la salida en su turno abierto (C1b). El efectivo sale en ese momento (pata negativa en la cuenta
   de efectivo de la caja, atribuida al turno). Si es de un empleado, se crea **un** aviso al dueño dentro de la misma
   transacción (prioridad ALTA si es retiro, deja el esperado negativo o alcanza el umbral).
2. El dueño ve la salida en Caja → Egresos marcada «Requiere supervisión» y el aviso en su campana.
3. El dueño la revisa (Revisado/Observado), confirma la recepción del retiro (Confirmado/No recibido) o, si el
   efectivo nunca salió o volvió a la caja **con el turno todavía abierto**, la compensa. Nada de esto, salvo la
   compensación, mueve dinero.
4. El cajero ve en su historial, sólo lectura, el estado de **sus** salidas: Pendiente / Confirmado / Observado para
   retiros (No recibido u Observado se muestran como «Observado», sin el texto del dueño) y «Anulada por el dueño»
   para una salida propia compensada (ese efectivo se espera en el cajón). Nunca ve esperado, alertas, umbral ni
   observaciones, y no puede cambiar ningún estado.
5. Al cierre ciego, el esperado (fórmula de siempre: fondo + patas del turno) ya incluye la salida y, si la hubo, su
   compensación. El detalle del turno muestra el desglose por tipo y que cuadra con el libro.

### 15.3 Reglas contables y compensaciones

- **Naturalezas separadas** (sin cambios): GASTO (gasto operativo, con categoría), PAGO_PROVEEDOR (cancela compras: no
  es gasto de rentabilidad, F5 lo vinculará a la recepción), RETIRO_DUENO (no es gasto). Ningún reporte las suma en
  una cifra única de «gastos».
- **Observar / revisar / confirmar no mueven dinero**: sólo agregan una fila de historial y actualizan el estado;
  probado contra las patas del libro (idénticas antes y después) y el esperado.
- **Compensación (sólo dueño, total, una vez)**: una operación `REVERSION` (`revierteOperacionId` = la del egreso,
  único) con **una** pata positiva del mismo importe en **la misma cuenta** de efectivo de la caja, atribuida al **mismo
  turno todavía abierto**; fila `compensaciones_egresos_caja` con `momento=TURNO_ABIERTO`; motivo obligatorio;
  `Idempotency-Key` + huella; auditoría `caja.egreso_compensado` en la **misma transacción** (R1, probado por `xmin`).
  La fila del egreso, su operación y su pata **nunca se modifican** (probado campo por campo). Orden de bloqueo:
  fila de la caja (el mismo candado que el cierre) y luego la fila del egreso; una compensación que compite con el
  cierre o gana (y el cierre congelado la incluye) o pierde y responde `409 COMPENSACION_POSTERIOR_BLOQUEADA` sin
  escribir (12 iteraciones, ambos órdenes observados en `deligo_ci` y `deligo_qa_auto`). Una compensación hace
  imposible confirmar la recepción de ese retiro (`409 EGRESO_COMPENSADO`); la revisión sigue posible.
- **D-C1c-1 — compensación posterior al cierre: análisis y decisión (BLOQUEADA)**. Cómo se registra hoy el efectivo
  real: el cierre congela declarado, esperado y diferencia; la entrega a custodia (`EntregaCustodiaTurnoCaja`) **no**
  es un movimiento del libro; la cuenta de efectivo de cada caja es un flujo por turno, no un saldo físico. Por eso:
  - una `REVERSION` sin turno sumaría efectivo a la cuenta de la caja que ningún cajón tiene → **dinero ficticio**;
  - si la salida fue un error de carga (el efectivo nunca salió), ese efectivo ya apareció como **sobrante** del
    cierre y se fue con la entrega: corregirlo es **conciliar la diferencia del turno cerrado**, no mover dinero;
  - si el efectivo salió de verdad y **volvió después** (p. ej. devolución de un proveedor), es un **ingreso nuevo** en
    el turno/cuenta donde entra físicamente, vinculado al egreso original.
  Ambos casos necesitan la conciliación de cierres y las cuentas de custodia de **F10-D**. En C1c quedan **bloqueados
  explícitamente**: la API responde `409 COMPENSACION_POSTERIOR_BLOQUEADA` («No se modificó nada»), y la migración
  aditiva `20261118150000_f10_c1c_block_post_close_compensation` reemplaza dos funciones de guarda para que la base
  rechace una `REVERSION` sin turno y cualquier fila `POSTERIOR_AL_CIERRE` (el valor sigue en el CHECK como reserva de
  diseño para F10-D). El turno cerrado queda intacto (probado: estado, esperado, contado, fondo, cierre). La
  observación administrativa sigue disponible. **Diseño propuesto para F10-D** (no implementado): (a) «conciliación de
  error de egreso» que enlace el egreso observado con la diferencia del cierre y la entrega, sin movimiento de dinero
  o con un par de patas en una cuenta de ajuste/custodia; (b) «recupero de egreso» como ingreso en el turno abierto
  que recibe el efectivo, con referencia al egreso. Límite: hasta F10-D una salida mal cargada en un turno ya cerrado
  sólo se puede observar.

### 15.4 Alertas y avisos

- Avisos al dueño (tabla `notificaciones`, tipo `caja_egreso`) **sólo** en la transacción del registro de una salida
  de empleado: retiro (ALTA), esperado negativo (ALTA), umbral alcanzado (ALTA), resto NORMAL. Un replay, una ráfaga
  con la misma clave o un reintento no crean otro aviso (probado: 5 en paralelo + 3 replays → 1 aviso). Revisar,
  confirmar o compensar no crean avisos ni movimientos.
- «Movimientos pendientes de revisión»: se muestran como banda y filtro en el panel (contadores calculados en el
  servidor, independientes de los filtros); no se generan avisos periódicos para no duplicar.
- El dueño que registra su propia salida no recibe aviso; si deja el esperado negativo la justifica y queda pendiente
  de revisión.
- El cajero nunca recibe esperado, saldos ni alertas: su respuesta y su lista se verifican contra un patrón de
  palabras privadas en cada prueba.

### 15.5 Reportes y detalle de turnos

- `GET /api/negocio/caja/turnos/[id]` y `GET /api/negocio/caja/turnos/cerrados` agregan `desgloseEfectivo`: fondo
  inicial, ventas en efectivo, reintegros, gastos operativos, pagos a proveedores, retiros del dueño, compensaciones
  (también por naturaleza), otros ingresos/salidas si existieran, `esperadoCalculado` y `cuadra` (contra el esperado
  vivo o el **congelado** del cierre). Se calcula con las **mismas patas** que el esperado (cuenta de efectivo de la
  caja, operaciones del turno) agrupadas por tipo de operación; la fórmula del cierre no cambió.
- Interfaz: el detalle de un turno cerrado (Cajas y turnos → Ver detalle) muestra «Efectivo del turno por tipo» y
  «Coincide con el libro financiero» (o un aviso si no coincidiera). Los turnos abiertos siguen sin datos de
  recaudación en la tarjeta (decisión previa).
- `GET /api/negocio/caja/ventas` agrega `egresosHoy` (clave nueva; `resumenHoy` sin cambios): por naturaleza
  cantidad, importe, compensaciones y compensado, y gastos por categoría. El Resumen del dueño muestra tres tarjetas
  separadas (Gastos operativos / Pagos a proveedores «no se cuentan como gasto de rentabilidad» / Retiros del dueño
  «no es un gasto») y las compensaciones aparte.
- En `deligo_dev` los 3 turnos cerrados preexistentes (con ventas y reintegros del seed) dan `cuadra=true`.

### 15.6 Cambios de contrato respecto de C1a/C1b

- Cajero: la vista de egreso ya no trae `confirmacionRetiroEstado` crudo; trae `estadoAdministrativo`
  (`PENDIENTE | CONFIRMADO | OBSERVADO | ANULADO | null`, sólo en salidas propias). Se actualizaron la prueba de C1a
  que lo esperaba y el contrato estático de C1b.
- Dueño: `turnoCajaId` opcional en el registro (exige `cajaFisicaId`; un cajero que lo envía → 400
  `CAMPOS_NO_PERMITIDOS`); se agrega a la huella **sólo si viene**, así las huellas de C1a no cambian. La vista del
  dueño suma `compensacion` completa, `turnoAbierto`, `compensacionDisponible`, `compensacionBloqueada`,
  `pendienteSupervision` y `pendiente`. La lista suma `pendientes` y `responsables`.
- Prueba de C1a «prepared compensations» actualizada: la parte posterior al cierre ahora espera el rechazo de la base.
- Contratos estáticos actualizados: C1a (un solo escritor de compensaciones y de `revierteOperacionId`; 4 auditorías
  R1), C1b (el cajero sólo lee estados fijos) y B2.1 (el panel del dueño `owner-caja-egresos.tsx` queda fuera de la
  lista «código de cajero», con su propio contrato en `f10-c1c-static-contract.test.ts`).

### 15.7 Pruebas (ejecutadas en esta tarea)

| Suite | Resultado |
|---|---|
| `f10-c1c-egresos.integration.test.ts` (nueva) en `deligo_ci` | 12/12 (carrera: 3 compensación primero / 9 cierre primero) |
| ídem en `deligo_qa_auto` | 12/12 (carrera: 4 / 8) |
| `f10-c1a-egresos.integration.test.ts` + `-r1` en `deligo_ci` y `deligo_qa_auto` | 21/21 + 6/6 en ambas |
| `f10-c1c-static-contract.test.ts` (nueva) | 10/10 |
| `owner-caja-egresos.test.tsx` (nueva, happy-dom) | 11/11 |
| `caja-salidas-cajero.test.tsx` (C1b + estado administrativo) | 17/17 |
| Contratos C1a 7/7, C1b 8/8, B0/B2.0/B2.1 + página del cajero 6/6 + revisiones del dueño 9/9 | todo verde salvo las 2 fallas preexistentes de bytes CRLF en migraciones antiguas |
| Batería CI de Caja (26 suites) | 500 pasan / 3 fallan, todas preexistentes |
| 6 suites adicionales de la batería de C1b + 16 suites relacionadas | 227 pasan / 3 fallan, todas preexistentes |
| `tsc --noEmit` | 41 errores, los mismos preexistentes (0 nuevos) |
| ESLint (archivos tocados) · `git diff --check` | limpios |

Cubre: permisos (cajero 401 en rutas del dueño, otro negocio 404, sin clave 400), revisión, confirmación, alertas,
importes, compensaciones (movimientos correctos, original intacto, una sola vez, ráfagas con clave igual y distinta),
doble clic (UI y API), idempotencia (replay, clave reutilizada), concurrencia con el cierre, auditoría en la misma
transacción, turno cerrado intacto, aislamiento entre negocios, reintentos sin duplicar movimientos ni avisos, y
reportes que cuadran con el libro.

Fallas preexistentes (idénticas a la base `4294123`, ajenas a C1c): bytes CRLF de las migraciones B2.0 y B2.1 en el
checkout de Windows; I3 «escritores de stockCantidad»; F10-B2.0 `resumenHoy` sin `totalDevuelto/totalNeto` (cambio de
F4-A); F10-B1 regex de la ruta de venta del cajero (auditoría R1). Una falla nueva propia apareció y se corrigió: tipos
del helper `click` en la prueba de componente del dueño.

### 15.8 Revisión en navegador (app local `:3000`, `deligo_dev`, datos ficticios)

| Caso | Resultado |
|---|---|
| Escritorio: panel, banda de pendientes, tres naturalezas diferenciadas | OK |
| Confirmación de recepción del retiro de $3.000,50 | 201; historial + aviso «No se generó otro movimiento»; contador 1→0 |
| Revisión «Revisado» del gasto de $123,45 | 201; «No modificó dinero»; pendientes 3→2 |
| Compensación del gasto de prueba de $1,00 (motivo + casilla + segunda confirmación) | 201; REVERSION +1,00 en el mismo turno abierto; original conservado; «Registrar la salida correcta» ofrecido |
| Registro del dueño (pago a proveedor $2,00), caja nunca preseleccionada, **doble clic** en confirmar | un solo POST 201, un solo egreso |
| Desglose del turno abierto y resumen del día (APIs reales) | 5000 − 124,45 − 2 − 3000,50 + 1 = 1874,05 = esperado; `cuadra=true`; 3 turnos cerrados `cuadra=true` |
| Detalle de turno cerrado en la interfaz | «Efectivo del turno por tipo» + «Coincide con el libro financiero» |
| Celular 375×812 con la guía manual de instalación (465 px) | el panel reserva 481 px; «Registrar egreso» queda libre al desplazar; al abrir el formulario se apartan aviso y chat (visibility hidden), foco en el título, botones visibles; al cancelar vuelven |
| 320 / 412 / 768 px (lista y formulario) | sin desplazamiento horizontal |
| Historial del cajero | «Anulada por el dueño», «Confirmado»; sin datos privados |
| Consola / servidor | 401 sólo de sondeos preexistentes del panel (`/api/notificaciones?feed=cuenta`, `/api/destacado-solicitud`); todos los endpoints de egresos 200/201 |

Datos locales: respaldo previo `C:\Users\eltig\deligo-dev-db\respaldos\deligo_dev_antes_f10_c1c_20261118-124247.dump`
(y uno posterior a la migración); `migrate deploy` aplicó sólo `20261118150000` (55/55); los conteos de filas
preexistentes no cambiaron. Filas nuevas, intencionales y ficticias: 1 compensación (+$1,00), 1 pago a proveedor del
dueño ($2,00), 1 confirmación de retiro, 1 revisión, y sus auditorías. `deligo_ci` y `deligo_qa_auto` recibieron la
misma migración.

### 15.9 Archivos de C1c (worktree `deligo-dev-local`, sin commit)

Nuevos: `prisma/migrations/20261118150000_f10_c1c_block_post_close_compensation/migration.sql` ·
`src/app/api/negocio/caja/egresos/[id]/compensacion/route.ts` · `src/components/business/owner-caja-egresos.tsx` (+
`.test.tsx`) · `src/components/business/owner-caja-desglose-turno.tsx` · `src/lib/f10-c1c-egresos.integration.test.ts`
· `src/lib/f10-c1c-static-contract.test.ts`. Modificados: `src/lib/caja-egresos-service.ts` · `caja-egresos-http.ts` ·
`caja-turnos-admin.ts` · rutas `turnos/[id]`, `turnos/cerrados`, `ventas` (GET) · `caja-tab.tsx` ·
`owner-caja-revisiones.tsx` · `caja-salidas-cajero.tsx` (+ test) · contratos C1a/C1b/B2.1 · prueba de integración de
C1a. Generados que no se incluyen: `next-env.d.ts`, `tsconfig.tsbuildinfo`.

### 15.10 Pendientes y qué falta para certificar F10-C1 en Railway TESTING

- **Compensación posterior al cierre**: bloqueada; depende de F10-D (diseño en §15.3). No se declara terminada.
- Observación lateral: `caja-tab.tsx` también se usa en la página del cajero (selector de productos), así que el
  código del panel del dueño viaja en ese paquete JS (igual que ya pasaba con `owner-caja-turnos`/`revisiones`). No
  expone datos (todas las rutas del dueño exigen sesión de dueño); se puede cargar en diferido si se quiere separar.
- Para certificar F10-C1 (C1a + C1b + C1c) en TESTING hace falta, en este orden y con autorización explícita:
  1. revisión del operador y commit local (C1a + C1b + C1c, sin `next-env.d.ts` ni `tsconfig.tsbuildinfo`);
  2. integración en `testing-codex`, CI verde (PostgreSQL efímero) y push;
  3. despliegue en TESTING con las **dos** migraciones (`20261118120000` y `20261118150000`) y verificación del
     `commitHash`;
  4. certificación autenticada en TESTING con datos ficticios: registro del cajero y del dueño, doble clic, intentos
     inciertos, confirmación, revisión, compensación con turno abierto, bloqueo posterior al cierre, cierre ciego con
     egresos y compensación, desglose `cuadra`, resumen del día, aislamiento entre negocios, auditorías R1;
  5. prueba en teléfono real (Android HTTPS con el banner nativo y teclado; iOS Safari) del cajero y del dueño;
  6. Production sigue fuera de alcance (requiere autorización separada); antes de Production conviene decidir si la
     compensación posterior al cierre (F10-D) es condición.

## 16. Cierre formal de F10-C1 (C1a + C1b + C1c) — certificación F10-C3 en Railway TESTING (2026-11-19)

Estado: `F10_C1_STATUS=CLOSED_TESTING_CERTIFIED` (funcional: API real + libro + reconciliación SQL y auditoría; sólo
TESTING; **no** es autorización de Production) · `F10_C1_POST_CLOSE_COMPENSATION=BLOCKED_PENDING_F10_D` ·
`F10_C1_PHYSICAL_DEVICE_CHECK=PENDING` (no forma parte de esta certificación).

### 16.1 Evidencia

| Elemento | Valor |
|---|---|
| Commit certificado | `testing-codex` `bfaba2ae3cfef4820c14b1fef5ce9144e277bdac` (`4575857` → `ae6a3df` → `bfaba2a`) |
| Despliegue | DeliGO Copy / TESTING `db49cadf-aa1e-418a-b20e-9d916c05519e` SUCCESS, `commitHash` exacto; migraciones `20261118120000` y `20261118150000` aplicadas (55/55, 0 fallidas) |
| CI | `44377138529` SUCCESS (intento 1; suites F10-C1 sobre PostgreSQL 16 + build) |
| Respaldo previo | `deligo-testing-pre-f10-c1-20261118T190358Z.dump`, SHA-256 `e2549d96d1231ce290d9e3775df78f74e4c0bdad0b96448f01fc7176c40b1e2c` (verificado) |
| Verificación posterior (SQL) | PASS: esquema, triggers, bloqueo SQL posterior al cierre, 0 egresos previos, turno antiguo ABIERTO con huella `85721fc4117779fa64b353669895e4e0` |
| Batería C3 (operador, credenciales ocultas) | 2026-11-19 17:34:21–17:34:51 UTC · negocio `paola-vinal` · QA Caja A · turno QA `cmwnty0h50009l30ale83o05c` · **14 PASS / 0 FAIL / 1 NOT_RUN deliberado** (C3-09B) · autoprueba de la guarda de escrituras 21/21 antes de escribir · SHA `bfaba2a` verificado dinámicamente en cada fase |
| Reconciliación SQL (solo lectura) | **PASS**, modo TESTING, 0 fallas (`reconciliacion-c3.json`, 2026-11-19 17:35:55 UTC) |
| Production | DeliGO `ccc2184a`, chat `898bf9d9`, Review Moderation Expiry `d22d6077`, Mesa Cron `861b79f1`: SUCCESS en `42ca500`, idénticos antes y después; `origin/main` `42ca500` |

### 16.2 Qué quedó certificado en TESTING

- **Cierre ciego**: QA Caja A cerrada por el cajero declarando $3.539,51; esperado congelado $3.539,51 = fondo + patas
  del libro ($5.000 + $1.000 − $1.460,48 − $1.200 − $800 + $999,99); COINCIDE; desglose `cuadra=true`; el cajero no
  recibió importes del sistema.
- **Movimientos**: 8 operaciones exactas en el turno (1 VENTA_COBRO +1.000, 4 GASTO −1.460,48, 1 PAGO_PROVEEDOR
  −1.200, 1 RETIRO_DUENO −800, 1 REVERSION +999,99), una pata exacta por operación en la cuenta de efectivo de QA Caja A.
- **Auditoría transaccional (R1)**: cada egreso con su auditoría `caja.egreso_registrado` en la misma transacción que
  su pata (xmin); la compensación con `caja.egreso_compensado` en la misma transacción; una auditoría por cada
  revisión/confirmación.
- **Idempotencia**: ráfaga de 5 con la misma clave → 1 egreso (1×201 + 4 replays), replay tardío 200, clave reusada
  409, sin clave 400; 0 claves repetidas; 5 avisos en total (uno por salida de empleado, ninguno por replays ni por la
  salida del dueño); replays de revisión, confirmación y compensación 200 sin duplicar.
- **Revisión y confirmación sin dinero**: Revisado/Observado y la confirmación del retiro no agregaron operaciones;
  segunda confirmación 409; observación vacía 400.
- **Compensación con turno abierto**: REVERSION total, misma cuenta y turno, una sola vez (segunda 409), original
  intacto, el cajero ve «Anulada por el dueño»; salida correcta del dueño registrada en la caja y turno elegidos.
- **Compensación posterior al cierre**: 409 `COMPENSACION_POSTERIOR_BLOQUEADA`, turno cerrado sin cambios, 0
  reversiones sin turno y 0 compensaciones posteriores en toda la base; la observación sigue disponible.
- **Permisos y cierre ciego**: el cajero 401 en todas las rutas del dueño (lista, detalle, compensación, turno,
  resumen); campos no permitidos 400; lista del cajero sin datos privados.
- **Aislamiento**: sin egresos de otros negocios en toda la base; ninguna escritura fuera de `paola-vinal` (guarda
  técnica + sólo POST a sus rutas); lectura del cajero sobre un negocio no vinculado (`burgerking`) 403/403.
- **Reportes**: desglose del turno y `egresosHoy` por naturaleza; los 14 turnos cerrados previos de `paola-vinal`
  siguen conciliando con el libro.
- **Turno histórico** `cmw2sjtoj002do40aqaq0i1hu`: ABIERTO, esperado $15.500 (ventas $17.000 − reintegros $1.500),
  huella `85721fc4117779fa64b353669895e4e0` idéntica a la del respaldo previo.

### 16.3 Qué está probado sólo en local / CI (no certificado en TESTING)

- **Escritura entre negocios** (C3-09B, NOT_RUN deliberado en TESTING): cubierta con escrituras reales en `deligo_ci`
  / `deligo_qa_auto` y en CI (suites de integración F10-C1a y F10-C1c).
- **Avisos por umbral y por esperado negativo**, justificación obligatoria del dueño, carreras egreso/cierre y
  compensación/cierre en ambos órdenes, guardas SQL directas (inmutabilidad, una pata, esperado previo exacto): CI +
  `deligo_ci` / `deligo_qa_auto`.
- **Interfaz** (cajero C1b y dueño C1c, escritorio y 320/375/412/768 px, aviso de instalación y chat flotante):
  revisada en el navegador local con datos ficticios; en TESTING se certificaron las APIs que la interfaz usa, no la
  interfaz en un dispositivo.

### 16.4 Pendiente (separado de este cierre)

- **F10-D**: compensación/corrección posterior al cierre (conciliación de la diferencia del turno cerrado o recupero
  como ingreso nuevo), sigue BLOQUEADA y documentada (§15.3).
- **Prueba física** en teléfono real (Android HTTPS con banner nativo y teclado; iOS Safari) del cajero y del dueño.
- **Entrega a custodia** del turno QA `cmwnty0h50009l30ale83o05c`: queda pendiente a propósito (la batería no la
  registra); no se limpiaron datos QA.
- **Production**: sin promoción; requiere autorización propia (y decidir si F10-D es condición previa).
  *(2026-11-19: el operador registra que F10-C1 NO está autorizado para Production y que F10-D debe resolver los
  errores de egresos posteriores al cierre antes de habilitar egresos en negocios reales; propuesta F10-D1 acotado en
  `F10_C2_F5_COMPRAS_RECEPCION_DISENO.md` §9.)*
- **Herramientas QA** (`scripts/qa/*`, no versionadas): runner con guarda de escrituras, respaldo, verificación
  posterior y reconciliación; decidir si se versionan.
