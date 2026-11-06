# F4-C — Cambios de productos y ventas adicionales vinculadas (Caja)

```text
F4_C_STATUS=DESIGN_APPROVED_NOT_STARTED
F4_C_STAGE=F4-C0 (documentación) guardada (commit y push autorizados 2026-11-06, rama codex/f4-b-justified-prices); F4-C1 NO iniciada ni autorizada
DESIGN_APPROVED_BY=operador, 2026-11-06 (auditoría READ-ONLY 2026-11-05 + diseño revisado 2026-11-05)
DOC_BASE=edcc8ef (rama codex/f4-b-justified-prices = testing-codex 2bc0a93 + docs)
PREVIOUS_PLAN=6cb3d92 (rama local codex/f4-c-roadmap-plan) y 3613091 (codex/f4-b-owner-sale-corrections): NO fusionados; contenido vigente recuperado aquí (ver §0)
IMPLEMENTATION_AUTHORIZED=NO — cada etapa (C1…C6) requiere autorización explícita del operador
PRODUCTION=no autorizado; TESTING tampoco hasta autorización por etapa
SCOPE=sólo Caja de negocios genéricos (rubro GENERIC); restaurantes fuera de alcance
```

## 0. Fuentes y reconciliación con el plan anterior

El plan original de F4-C (commit `6cb3d92`, 2026-11-04) quedó en una rama de documentación aparte y **no** se fusiona:
se apoyaba en una regla de precios de F4-B que el operador revirtió ese mismo día. Este documento parte de `edcc8ef` y
recupera sólo el contenido vigente.

| Contenido de `6cb3d92` | Estado |
|---|---|
| Objetivo (cambiar, agregar, quitar con reintegro, mayor/menor valor, cambios sucesivos) | **Vigente** |
| Empleados y dueño sin autorización previa; sin flujo de solicitud/aprobación | **Vigente** (D2) |
| Seguridad por validaciones, permisos, registro, conciliación y auditoría (reduce riesgos, no garantiza) | **Vigente** |
| Precios vigentes al momento del cambio; precio aplicado guardado en cada operación | **Vigente** |
| Sin saldos a favor hasta F2 | **Vigente** (D14) |
| Aviso al dueño cuando un empleado devuelve dinero | **Ampliado**: aviso por todo cambio y toda venta adicional vinculada de empleados (D8) |
| Eventos inmutables con idempotencia y protección de concurrencia | **Vigente** |
| Casos A–E, auditoría mínima, requisitos de inventario/caja/turnos, compatibilidad | **Vigentes** (§12, §10, §11) |
| Párrafo «F4-B — precio confirmado: el reemplazo hereda el precio cobrado» | **Obsoleto** — regla revertida 2026-11-04; F4-B exige MISMO_PRODUCTO, MISMA_VENTA o PRECIO_CATALOGO_ACTUAL (`codex-reports/F4_B_JUSTIFIED_PRICES.md`) |
| F4-B «AWAITING_TESTING_MANUAL_CERTIFICATION» | **Obsoleto** — F4-B CLOSED_TESTING_CERTIFIED (funcional, sólo TESTING) |
| «F4-C no se combina con F4-B» | **Reemplazado** por las reglas de interacción de §11 |
| Cuestiones pendientes 1–10 | **Resueltas** por D1–D14 y T1–T9 (tabla en §16) |

## 1. Qué es y qué no es

F4-C es una **operación comercial posventa** de Caja: el cliente cambia productos de una compra ya hecha, o agrega
productos, y la diferencia de dinero se cobra o se reintegra. No edita la venta original.

- **Cambio** = devolución de lo que sale (motor F4-A) + **venta vinculada** con lo que entra (motor de ventas de Caja)
  + liquidación de la diferencia, en **una única transacción atómica**.
- **Venta adicional vinculada** (agregar productos) = venta normal ligada a la venta origen, **sin devolución
  ficticia** y sin crédito.
- **No es F4-B**: F4-B corrige errores de carga del dueño sin mover dinero (total y precio cobrados se conservan).
- **No es F4-A pura**: una devolución sin productos que entren sigue siendo F4-A.

## 2. Decisiones del operador (aprobadas 2026-11-06)

| # | Decisión |
|---|---|
| D1 | Arquitectura: devolución de productos + venta vinculada + liquidación de la diferencia, dentro de una única transacción atómica. |
| D2 | Empleados habilitados para Caja (sesión operativa del área caja) y dueño realizan cambios sin autorización previa. |
| D3 | Las diferencias positivas se cobran **completas** al confirmar. Inicialmente, **un único medio de pago real**. |
| D4 | Las diferencias negativas se reintegran en el acto o quedan **PENDIENTES**; el cambio de productos se completa igual. |
| D5 | El reintegro puede ser en efectivo, transferencia u otro medio, independientemente del pago original. |
| D6 | Las líneas con precio heredado (correcciones F4-B con la regla anterior) reconocen lo **efectivamente cobrado**, con advertencia y auditoría. El mismo criterio rige en **F4-A** (no se bloquean). |
| D7 | Sin límites fijos de días ni de cantidad de cambios sucesivos; se conservan trazabilidad y advertencias. |
| D8 | Se notifica al dueño **todo cambio y toda venta adicional vinculada** realizados por empleados; las ventas normales no se notifican. |
| D9 | El crédito interno no genera ingresos ni movimientos financieros. |
| D10 | Los reportes separan ingresos reales, devoluciones, créditos y operaciones comerciales. |
| D11 | Las operaciones se atribuyen al responsable y a la fecha del cambio; los datos originales quedan intactos. |
| D12 | El stock devuelto se reutiliza sólo si vuelve en condiciones aptas y existe disponibilidad real después de considerar las reservas. |
| D13 | Modo OPCIONAL: se conservan las reglas actuales de Caja y devoluciones sin turno. Modo OBLIGATORIO: se respetan sus restricciones. |
| D14 | Sin saldos a favor ni cuentas corrientes en F4-C. |

## 3. Decisiones técnicas aprobadas (T1–T9)

| # | Decisión |
|---|---|
| T1 | Medio resumen (`Venta.metodoPago`) de la venta vinculada por cambio = valor nuevo **`CAMBIO`**; el detalle real vive en sus `CobroVenta`. La venta adicional vinculada usa su medio normal. |
| T2 | Diferencia positiva con **un solo medio real** en la primera versión (pagos mixtos sólo en una etapa futura, D7 de F10). |
| T3 | Medio del reintegro libre entre EFECTIVO / TRANSFERENCIA / OTRO (D5); sin límites de importe para empleados en la primera versión. |
| T4 | Reportes: ventas y devoluciones brutas con desglose «por cambios» + dinero real por medio leído desde los cobros y reintegros. |
| T5 | La venta vinculada se atribuye a la fecha, turno y actor del cambio, no al vendedor original. |
| T6 | Aviso al dueño también por ventas adicionales vinculadas de empleados (D8). |
| T7 | Cambio por el mismo producto: lo devuelto **apto** reingresa antes de planificar lo que entra, así puede volver a salir si hay disponibilidad real (D12). |
| T8 | Cadenas de cambios sin límite de cantidad; advertencias por antigüedad en lugar de un plazo máximo (D7). |
| T9 | Modo OPCIONAL sin turno abierto: igual que hoy (venta y reintegro con `turnoCajaId` NULL, efectivo en `efectivo_caja_sin_asignar`) (D13). |

## 4. Garantías indispensables (condiciones del operador)

1. Los cierres históricos no se modifican (los snapshots congelados `efectivoEsperadoDecimal` no se recalculan).
2. Sin cobros, reintegros, créditos ni movimientos de stock duplicados.
3. Idempotencia y protección ante concurrencia.
4. Los reportes contables necesarios se corrigen **antes** de certificar F4-C (no se difieren a una fase posterior).
5. F4-A, F4-B y F10 conservan su funcionamiento certificado (regresión completa en cada etapa).

## 5. Modelo contable (punto A — separación de importes)

Cada cambio guarda cinco importes exactos (NUMERIC(12,2), ROUND_HALF_UP a centavos, `src/lib/money.ts`):

| Importe | Definición |
|---|---|
| **V_sal** — importe devuelto (comercial) | Suma de las líneas que salen, valoradas por lo efectivamente cobrado: línea vigente (F4-B) y regla proporcional acumulada de F4-A (`importeDevolucionLinea`). |
| **V_ent** — valor de entrada | Total de la venta vinculada, a precio de catálogo actual (producto o variante; Caja no tiene descuentos ni promociones). |
| **C** — crédito aplicado | `min(V_sal, V_ent)` |
| **D+** — diferencia cobrada | `max(0, V_ent − V_sal)` |
| **D−** — diferencia a reintegrar | `max(0, V_sal − V_ent)` |

Invariantes (CHECK en la base de datos, además del servicio):

- `V_sal = C + D−` y `V_ent = C + D+`
- `D+ > 0` y `D− > 0` nunca a la vez; todos los importes `≥ 0`
- `liquidacion` = `SIN_DIFERENCIA` (D+ = D− = 0) | `COBRO` (D+ > 0) | `REINTEGRO` (D− > 0), coherente con los importes
- Un cambio requiere al menos una unidad que sale **y** al menos una línea que entra.

## 6. Representación de datos (propuesta para F4-C3; migración aditiva)

- **`CambioVenta`** (tabla nueva, inmutable): `negocioId`, `ventaOrigenId`, `devolucionId` (único), `ventaNuevaId`
  (único), los cinco importes, `liquidacion`, `actorTipo`/`actorId`/`empleadoId` (de la sesión), `turnoCajaId`,
  `motivo` (obligatorio), `idempotencyKey` + `idempotencyFingerprint` (`@@unique([negocioId, idempotencyKey])`),
  advertencias registradas (precio heredado, antigüedad) con su detalle, `createdAt`.
- **`DevolucionVenta`**: campo nuevo `importeCompensadoDecimal` (default 0). Importe reintegrable =
  `importeDecimal − importeCompensadoDecimal`. En F4-A puro el compensado es 0: comportamiento idéntico al actual.
- **`Venta`**: campos nuevos `ventaOrigenId` (nullable) y `vinculoTipo` (`CAMBIO` | `ADICIONAL`, nullable); valor nuevo
  `CAMBIO` en `metodoPago` (T1).
- **`CobroVenta`**: método nuevo `CREDITO_CAMBIO` + `cambioVentaId` (único, nullable).
- Ninguna fila existente se reescribe; los datos históricos quedan con los campos nuevos en NULL / 0.

## 7. Cobros (punto B — crédito de cambio + medio adicional)

La venta vinculada por cambio tiene **dos cobros** (primer uso real de D7 de F10):

1. `CobroVenta` `CREDITO_CAMBIO` por **C**, `estadoConciliacion` NO_APLICA, ligado 1:1 a su `CambioVenta`.
2. `CobroVenta` real por **D+**, sólo si D+ > 0: EFECTIVO genera la operación `VENTA_COBRO` de siempre en el turno
   abierto; TRANSFERENCIA nace DECLARADO; OTRO sin libro.

Garantías en SQL:

- Trigger: ninguna `OperacionFinanciera` puede referir a un cobro `CREDITO_CAMBIO` (el crédito nunca toca el libro, D9).
- Trigger diferido: suma de cobros de la venta vinculada = `Venta.total`.
- `CREDITO_CAMBIO` sólo existe con su `CambioVenta` y sólo en ventas `vinculoTipo = CAMBIO`.
- Cada cobro real genera a lo sumo una operación (`OperacionFinanciera.cobroVentaId @unique`, ya vigente).

## 8. Reportes, turnos y cierres (punto C — el crédito nunca es dinero)

Regla única: **el dinero se lee de los cobros reales y de los reintegros realizados; el volumen comercial, de ventas y
devoluciones.**

| Cifra | Fuente | Crédito interno |
|---|---|---|
| Cobrado por medio | `CobroVenta` excepto `CREDITO_CAMBIO`; ventas anteriores a F10-B0 sin cobros: respaldo por `Venta.metodoPago` (`resolveCobrosVenta`) | excluido |
| Reintegrado por medio | Reintegros REALIZADOS por su importe reintegrable, por `reintegroMedio`; los PENDIENTES aparte | excluido |
| Ventas brutas / devuelto bruto | `Venta.total` / `DevolucionVenta.importeDecimal`, con la línea «de los cuales por cambios» | informado como compensación interna |
| Neto comercial | brutas − devuelto (con cambios da D+ − D−) | se cancela solo |
| Efectivo esperado del turno y cierre | libro financiero (`src/lib/caja-turnos-snapshot.ts`, sin cambios) | sin movimiento, no entra |
| Resumen del turno por medio | igual que «cobrado por medio» | excluido |

Puntos de código afectados (verificados 2026-11-05):

- `src/app/api/negocio/caja/ventas/route.ts` (resumen diario del dueño): hoy suma `Venta.total` por `Venta.metodoPago`.
- `src/lib/caja-turnos-admin.ts` `resumenVentasTurno`: misma lógica por turno.
- Antes de C2 se inventarían todos los lectores de `Venta.metodoPago` de Caja (resumen, turnos, historial del cajero en
  `src/lib/operativo-caja.ts`, etiquetas de la UI, snapshot `DevolucionVenta.metodoPagoVenta`).

Cierre ciego: el cajero sigue sin ver efectivo esperado, diferencias ni totales; sólo ve la diferencia de su propia
operación.

## 9. Sin reutilizar créditos ni reintegrar dos veces (punto D)

- **El crédito no es un saldo**: nace y se consume en la misma transacción, 1:1 con su `CambioVenta`
  (`devolucionId`, `ventaNuevaId` y `CobroVenta.cambioVentaId` únicos). D− se reintegra o queda PENDIENTE; nunca queda
  como saldo (D14).
- **Unidades de la venta original**: las que salen en un cambio cuentan en los topes SQL de F4-A (cantidad e importe ≤
  lo vendido); un segundo cambio o una devolución de esas mismas unidades se rechaza.
- **Venta vinculada**: es una venta con topes propios, valorada por lo cobrado en ella. Su devolución posterior
  reintegra dinero real hasta su total, porque ese crédito provino de dinero real pagado en la venta original.
  Ejemplo (caso D): entran $2.000 (venta original) + $1.500 (D+) = $3.500 reales; si luego se devuelve todo lo nuevo se
  reintegran $3.500, que es el neto real de la cadena.
- **Reintegro PENDIENTE de D−**: pasa a REALIZADO una sola vez (endpoint y `reintegroIdempotencyKey` existentes,
  transición protegida), por el importe reintegrable.
- **Cadenas**: cada cambio es una operación propia sobre la venta que corresponda (original o vinculada).

## 10. Atomicidad, idempotencia, concurrencia, auditoría y reservas (punto E)

- **Transacción**: una sola, Serializable, con reintentos; antes se unifican los ejecutores actuales (`runSerializable`
  del motor de ventas y `runStockSerializable`).
- **Orden de bloqueo fijo**: (1) fila de la venta origen (no-op UPDATE, como F4-A); (2) caja/turno; (3) stock, en el
  orden del motor de ventas. Reintentos ante 40001/40P01; agotados → 409 sin efectos.
- **Idempotencia**: `CambioVenta @@unique([negocioId, idempotencyKey])` + fingerprint. Reenvío exacto → mismo resultado
  sin efectos; misma clave con otro contenido → 409. Claves internas de la devolución y de la venta derivadas con
  UUIDv5 de la clave principal (sin choque con claves de clientes).
- **Stock**: lo que entra se planifica contra stock físico − reservas ACTIVA (`planificarStockVentaCaja`); lo que sale
  sigue la decisión por línea de F4-A (REINGRESADO | NO_REINGRESA | SIN_CONTROL_STOCK | PRODUCTO_NO_DISPONIBLE); las
  reservas no se tocan; productos eliminados o desactivados no pueden entrar; lo apto reingresa antes de planificar (T7).
- **Turnos**: el dinero va al turno abierto en el momento del cambio (D11). Empleado → su propio turno; dueño con varias
  cajas abiertas → `CAJA_SELECCION_REQUERIDA`; OBLIGATORIO sin turno → el cambio completo se rechaza
  (`TURNO_REQUERIDO`); OPCIONAL sin turno → reglas actuales (T9).
- **Auditoría y avisos**: `CambioVenta` + `auditLog` + aviso persistente al dueño, creado en la misma transacción, por
  cada cambio y cada venta adicional vinculada de un empleado (D8), con las advertencias registradas.
- **Precio heredado (D6)**: se acredita lo cobrado; la interfaz muestra el precio de catálogo actual como referencia;
  la advertencia se guarda en `CambioVenta`. En F4-A la advertencia ya existe en la interfaz
  (`src/components/business/caja-devoluciones.tsx`); su **registro de auditoría explícito** se agrega en F4-C4 sin
  cambiar importes.

### Auditoría mínima por operación (del plan anterior, vigente)

Venta original · identificador de la operación · negocio · usuario autenticado (de la sesión) · fecha y hora · motivo ·
productos y cantidades que salen y que entran · precios aplicados · V_sal, V_ent, C, D+, D− · cobro adicional o
reintegro y su medio · turno del movimiento financiero · movimientos de inventario vinculados · advertencias · cadena
completa de cambios sucesivos.

## 11. Interacción con F4-A, F4-B y F10

| Situación | Regla |
|---|---|
| F4-C sobre una venta con correcciones F4-B | Permitido; usa la línea vigente (`lineaVigente`), como F4-A. |
| F4-B sobre la venta original después de un cambio | Bloqueado (la venta ya tiene devolución: `VENTA_CON_DEVOLUCIONES`). |
| F4-B sobre la venta vinculada | Permitido mientras no tenga devoluciones (F4-B conserva el total, no altera C). |
| F4-A sobre la venta original después de un cambio | Sólo las unidades restantes; la anulación devuelve sólo lo restante. |
| F4-A / F4-C sobre la venta vinculada | Permitido; es una venta con topes propios. |
| Venta de un turno ya cerrado | Permitido; el dinero va al turno abierto actual; el cierre no cambia. |
| Efectivo esperado del turno | Sin cambios de cálculo: entra el cobro en efectivo de D+ y sale el reintegro en efectivo de D−. |

## 12. Casos de referencia

| Caso | Venta original | Operación | V_sal | V_ent | C | D+ | D− | Dinero real |
|---|---|---|---|---|---|---|---|---|
| A — mismo valor | 1 Saphirus $2.000 | por 2 Redmi a $1.000 | 2.000 | 2.000 | 2.000 | 0 | 0 | ninguno |
| B — agregar | 1 Saphirus $2.000 | venta adicional vinculada: 1 Redmi | — | 1.000 | — | — | — | cobro normal $1.000 |
| C — más barato | 1 Saphirus $2.000 | por 1 Redmi $1.000 | 2.000 | 1.000 | 1.000 | 0 | 1.000 | reintegro $1.000 (en el acto o PENDIENTE) |
| D — más caro | 1 Saphirus $2.000 | por productos de $3.500 | 2.000 | 3.500 | 2.000 | 1.500 | 0 | cobro $1.500 (un medio) |
| E — sucesivos | cualquiera | varios cambios en el tiempo | cada cambio es una operación propia; nunca borra ni sobrescribe las anteriores | | | | | |

## 13. Etapas de implementación (cada una con autorización propia)

| Etapa | Contenido | Comportamiento visible | Gate |
|---|---|---|---|
| **C0** | Esta documentación | ninguno | revisión del operador |
| **C1** | Refactor: núcleos de venta y devolución ejecutables dentro de una transacción compartida; ejecutor Serializable unificado; corregir el comentario obsoleto de `CorreccionVenta` en `prisma/schema.prisma` | ninguno | regresión completa F10, F4-A, F4-B, reservas e idempotencia; CI |
| **C2** | Reportes y turnos leídos desde cobros (resumen diario del dueño, resumen de turno) + inventario de lectores de `Venta.metodoPago` | ninguno | pruebas de equivalencia con datos existentes (total por cobros = total por `metodoPago`); CI |
| **C3** | Migración aditiva (§6) + triggers y CHECK de §5, §7 y §9; reintegro de F4-A por importe reintegrable (hoy = total) | ninguno | pruebas SQL de invariantes en PostgreSQL real; regresión F4-A; CI |
| **C4** | Servicio y API de cambio (casos A, C, D, E) y de venta adicional vinculada (B), para dueño y cajero; avisos; auditoría de precio heredado en F4-A | nuevo (API) | integración con base real: concurrencia, reservas, idempotencia, cadenas, reintegros pendientes, OPCIONAL/OBLIGATORIO; CI |
| **C5** | Interfaz de dueño y cajero; desglose «por cambios» y «compensación interna» en reportes; historial vinculado | nuevo | pruebas de UI; privacidad del cierre ciego; CI |
| **C6** | Certificación manual en TESTING con controles contables explícitos (efectivo esperado, resumen por medio, neto, cadenas, reintegro pendiente, cierres históricos intactos) | — | autorización de deploy TESTING aparte; Production en su propio flujo |
| Posterior | Comprobantes (F11), alertas de operaciones inusuales, estadísticas avanzadas, pagos mixtos en D+ | — | fuera de F4-C esencial |

Los cambios contables esenciales (C2 y C3) quedan **antes** de la certificación (garantía 4).

## 14. Fuera de alcance

Saldos a favor y cuentas corrientes (F2) · comprobantes (F11) · redondeo con cantidades fraccionarias (decisión
pendiente #16) · restaurantes (Caja es sólo para negocios genéricos) · pagos mixtos en la diferencia positiva (T2).

## 15. Detalles a cerrar en etapas posteriores (no bloquean C1)

- **P1 (antes de C4):** contenido y umbrales de las advertencias de D7/T8 (p. ej. antigüedad de la venta, largo de la
  cadena). Criterio del operador (2026-11-06): advertencias **informativas**, nunca bloquean un cambio automáticamente;
  quedan por definir sólo su contenido y umbrales.
- **P2 (antes de C4):** ¿se admite una venta adicional vinculada a una venta origen ANULADA? Criterio recomendado por
  el operador (2026-11-06): **rechazarla**. Sigue `PENDING_CONFIRMATION` hasta confirmarlo antes de implementar C4.

## 16. Cuestiones pendientes del plan anterior → resolución

| # (`6cb3d92`) | Resolución |
|---|---|
| 1 Interacción F4-A/F4-B/F4-C | §11 |
| 2 Modelo de la venta tras un cambio; informes | Venta vinculada (D1); reportes §8 (D10, T4, T5) |
| 3 Precios al momento del cambio | Catálogo actual del producto o variante; Caja no tiene descuentos ni promociones; precio heredado → D6; redondeo #16 fuera de alcance |
| 4 Diferencia a favor del cliente | Reintegro en el acto o PENDIENTE (D4), medio libre (D5), sin saldo (D14) |
| 5 Cobro adicional | Completo al confirmar, un solo medio real (D3, T2) |
| 6 Medio del reintegro, turno, modo OBLIGATORIO | D5, D11, D13, T9 |
| 7 Stock | D12, T7, §10 |
| 8 Límites y controles; avisos | Sin límites fijos (D7, T8); avisos D8; umbrales P1 |
| 9 Comprobantes | F11, posterior |
| 10 Numeración y etapas | §13 |

## 17. Hallazgos laterales (no se corrigen en C0)

- `prisma/schema.prisma`, comentario del modelo `CorreccionVenta`: todavía dice «el reemplazo hereda ese precio» (regla
  revertida). Corrección prevista en C1 (sólo comentario).
