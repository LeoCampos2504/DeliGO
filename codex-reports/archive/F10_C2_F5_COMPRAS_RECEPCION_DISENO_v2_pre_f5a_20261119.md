# F10-C2 + F5 (alcance mínimo) — Compras, recepción de mercadería y proveedores · DISEÑO v2

Estado: `F10_C2_F5_STATUS=DESIGN_V2_DECISIONS_FINAL_PENDING_F5A_AUTHORIZATION` · sin implementación, sin migraciones,
sin commits ni despliegues. Fecha: 2026-11-19. Base analizada: `testing-codex` `bfaba2a`.
Versión anterior (propuesta v1) archivada sin cambios en
`codex-reports/archive/F10_C2_F5_COMPRAS_RECEPCION_DISENO_v1_20261119.md`.

Cambios respecto de v1 (operador, 2026-11-19): aprobadas D-2, D-5, D-7, D-8, D-9, D-11, D-12, D-13; ajustadas D-1,
D-3, D-4, D-6, D-10; **un único motor de cuenta corriente y asignaciones** (se elimina la superposición F5-A / F5-B);
pagos declarados sin efecto sobre la deuda exigible hasta su confirmación; F10-D1 obligatorio antes de habilitar
egresos en Production.

F10-C1 no se reabre: sigue `CLOSED_TESTING_CERTIFIED` y **no autorizado para Production**. El único contacto con su
código es una guarda nueva y aditiva (D-8, §5.4), con sus suites de regresión.

---

## 1. Lo que existe hoy (sin cambios respecto de v1)

| Pieza | Estado | Consecuencia |
|---|---|---|
| `Producto` / `ProductoVariante` | `costo Float?` sin historia; `stockCantidad Float` | El valor histórico de una compra vive en tablas nuevas con `Decimal`; `costo` queda como «último costo» de referencia |
| `MovimientoInventario` | sin costo; tipos ENTRADA · SALIDA · AJUSTE · VENTA · PEDIDO · DEVOLUCION · CORRECCION_* | F10-C2 agrega tipos y referencias únicas (aditivo) |
| Autoridad R3A (`stock-lifecycle.ts`) | única que escribe `stockCantidad` (contrato estático) | Recepción y devolución usan funciones nuevas de la misma autoridad |
| Libro financiero | sólo cuentas `EFECTIVO` por caja | Sin fuente bancaria confiable hasta F10-D → pagos por transferencia quedan **declarados** |
| `EgresoCaja` `PAGO_PROVEEDOR` (F10-C1) | proveedor en texto libre; fila inmutable por trigger | F5 lo **referencia** desde su propia tabla; la fila nunca se toca |
| Almacenamiento privado (`private-evidence-storage.ts`) | Cloudinary `authenticated`, descarga firmada | Fotos de comprobantes en una fase posterior (D-5) |
| Auth del dueño (`requireNegocioCajaGenerico`) | sesión `negocio`, rubro genérico | Mismo guard para F5 |

---

## 2. Separación de responsabilidades

| Módulo | Dueño único de | Referencia sin duplicar | Nunca |
|---|---|---|---|
| **F10-C1** (certificado) | Efectivo que sale de Caja (gasto, pago a proveedor, retiro) | — | Saber de compras o deudas |
| **F10-C2** | Recepción física, cantidades aceptadas/rechazadas, costo histórico por línea, ingreso de stock por R3A, devolución física | Proveedores y compras de F5 | Registrar dinero o calcular deuda por su cuenta |
| **F5** | Proveedores, compras (documento), **motor único de cuenta corriente**: obligaciones, créditos y asignaciones | Recepciones aprobadas (C2), egresos `PAGO_PROVEEDOR` (C1) | Mover efectivo o stock |
| **F10-D1** | Corrección de egresos descubiertos después del cierre | Turnos, entregas, egresos | — |
| **F10-D/E** (resto) | Cuentas no-efectivo, conciliación bancaria / MP, transferencias entre cuentas propias | Créditos declarados de F5 | — |

---

## 3. Decisiones definitivas

| # | Decisión | Estado |
|---|---|---|
| **D-1** | **Proveedores**: ficha mínima (nombre, CUIT opcional, teléfono, email, notas, activo). CUIT **validado** cuando existe (11 dígitos + dígito verificador módulo 11, prefijos válidos); **único por negocio** (índice parcial `(negocioId, cuit)`); el mismo CUIT puede existir en otro negocio (aislamiento estricto). Nombre coincidente (normalizado: minúsculas, sin tildes, espacios simples) → **advertencia** con los coincidentes; se crea al confirmar (`confirmoNombreSimilar: true`), nunca bloqueo. Nunca se borra (`activo=false`) | Ajustada y definitiva |
| **D-2** | La deuda nace al **aprobar la recepción** | Aprobada |
| **D-3** | **Motor único de cuenta corriente** (§4): obligaciones (deben) y créditos (pagos y notas de crédito); **asignaciones** append-only de créditos a obligaciones: asignar, dividir, desafectar y reasignar, con auditoría e idempotencia. **FIFO es sólo una sugerencia** (lectura); el dueño decide. Lo no asignado de un crédito efectivo es **anticipo / saldo a favor**. El egreso de F10-C1 nunca se modifica | Ajustada y definitiva |
| **D-4** | **Costos** (§6): costo histórico real por línea de recepción en `Decimal`; cantidades `Decimal(14,3)`; costo unitario `Decimal(14,4)`; importes `Decimal(12,2)`. El «último costo» del producto se actualiza sólo con la recepción más reciente por fecha y nunca reescribe recepciones anteriores. Descuentos e impuestos con tratamiento explícito | Ajustada y definitiva |
| **D-5** | Comprobantes: sólo datos (tipo, número, fecha) con control de duplicados; foto opcional en fase posterior | Aprobada |
| **D-6** | **Pagos declarados** (transferencia, Mercado Pago, otro) **no reducen la deuda exigible** mientras no estén confirmados. Estados §5.2. Sin fuente bancaria confiable, se mantienen pendientes y separados de los pagos de Caja; el dueño puede confirmarlos explícitamente (auditado) y F10-D los conciliará | Ajustada y definitiva |
| **D-7** | Pago en efectivo vinculado desde «Recibir mercadería» (F10-C2b) + asignación posterior de pagos ya registrados (F5-A) | Aprobada |
| **D-8** | Un egreso de Caja asignado como crédito **no puede compensarse** hasta desvincularlo | Aprobada |
| **D-9** | El stock entra al **aprobar el dueño** | Aprobada |
| **D-10** | **Costos accesorios** (§6.3): atribuibles a la mercadería (flete, seguro, carga de esa compra) → se **distribuyen** en el costo unitario de inventario; no atribuibles (fletes generales, gastos del local) → **gasto operativo**, nunca inventario. Cada peso se cuenta una sola vez | Ajustada y definitiva |
| **D-11** | Líneas sin `controlStock`: costo y deuda sin stock | Aprobada |
| **D-12** | Preparan recepciones: dueño y cajeros (área `caja`) | Aprobada |
| **D-13** | Reembolso del proveedor: nota de crédito ahora; efectivo con F10-D/E | Aprobada |

---

## 4. Motor único de cuenta corriente (F5)

Un solo motor, construido completo en su primera versión (F5-A); las fases siguientes sólo le agregan **orígenes**
nuevos (recepciones, cargos accesorios, notas de crédito) o **lecturas** (vencimientos, antigüedad, reportes). No hay
un segundo circuito de aplicación de pagos.

### 4.1 Documentos

```text
OBLIGACIÓN (le debemos al proveedor; importe > 0, inmutable)
  origen: SALDO_INICIAL (F5-A) · AJUSTE_DEUDA (F5-A, dueño, motivo) · RECEPCION (F10-C2a, una por recepción aprobada)
          · CARGO_ACCESORIO (F10-C2a, uno por cargo)
  estado: VIGENTE → ANULADA (sólo si no tiene asignaciones vigentes; evento con motivo)

CRÉDITO (reduce lo que le debemos; importe > 0, inmutable)
  origen: PAGO_CAJA (F5-A, referencia única a un egreso PAGO_PROVEEDOR de F10-C1)
          · PAGO_DECLARADO (F5-A, transferencia / Mercado Pago / otro)
          · AJUSTE_A_FAVOR (F5-A, dueño, motivo, no es dinero)
          · NOTA_CREDITO (F10-C2c, una por devolución aprobada)
  efectivo = cuenta para la deuda exigible (ver §5.2)

ASIGNACIÓN (atribuye parte de un crédito efectivo a una obligación vigente; append-only)
  tipo: ASIGNACION · DESAFECTACION (anula exactamente una asignación, una sola vez)
  agrupadas en una OPERACIÓN DE ASIGNACIÓN (ASIGNAR · DESAFECTAR · REASIGNAR) con Idempotency-Key, huella, motivo y
  auditoría: una reasignación = desafectaciones + asignaciones nuevas en UNA transacción
```

### 4.2 Cálculos (todos derivados, nunca guardados como saldo editable)

```text
asignado_vigente(x)   = Σ ASIGNACION de x − Σ DESAFECTACION que las anulan
pendiente(obligación) = importe − asignado_vigente(obligación)
disponible(crédito)   = importe − asignado_vigente(crédito)          (sólo créditos efectivos)
DEUDA EXIGIBLE        = Σ obligaciones VIGENTES − Σ créditos EFECTIVOS
ANTICIPO / A FAVOR    = Σ disponible(créditos efectivos)
PAGOS POR CONFIRMAR   = Σ créditos PAGO_DECLARADO en estado DECLARADO   (se muestran aparte, no restan)
Identidad: DEUDA EXIGIBLE = Σ pendiente(obligaciones vigentes) − ANTICIPO
```

Las asignaciones **no cambian la deuda exigible**: sólo dicen qué crédito cubre qué obligación (estado de cuenta por
compra, antigüedad, comprobantes pagados).

### 4.3 Sugerencia FIFO

Endpoint de sólo lectura: dado un crédito con disponible, propone repartirlo entre las obligaciones vigentes del mismo
proveedor con pendiente, de la más antigua a la más reciente (desempate por id). El dueño la acepta tal cual, la
modifica, la divide o deja el crédito como anticipo. Nada se asigna sin su operación explícita.

### 4.4 Anticipos y compras a crédito sin duplicados

| Caso | Documentos | Por qué no se duplica |
|---|---|---|
| Pago antes de recibir | Crédito efectivo sin asignar (anticipo); puede llevar una referencia **no vinculante** a la compra | La deuda no existe hasta la aprobación; el crédito existe una sola vez (`egresoCajaId` / id único) |
| Recepción aprobada con anticipo | Obligación `RECEPCION` (única por recepción) + en la misma aprobación, si el dueño lo confirma, una asignación del anticipo | La obligación es única por recepción; la asignación respeta los topes |
| Compra a crédito | Obligación al aprobar; ningún crédito | — |
| Recepción parcial | Una obligación por cada recepción aprobada, por lo aceptado en ella | Índice único `obligaciones.recepcionId`; nunca se crea deuda por lo pedido |
| Pago que cubre varias recepciones | Un crédito, varias asignaciones | Σ asignaciones ≤ crédito |
| Pago mayor a la deuda | El excedente queda como anticipo | Σ asignaciones ≤ obligación |

---

## 5. Integración financiera

### 5.1 Pagos de Caja (F10-C1)

- El dueño **vincula** un egreso `PAGO_PROVEEDOR` a un proveedor → crédito `PAGO_CAJA` (efectivo inmediato: el
  efectivo ya salió y está en el libro certificado).
- Requisitos: mismo negocio, naturaleza `PAGO_PROVEEDOR`, **sin compensación**, no vinculado antes (índice único
  `egresoCajaId`); importe = importe exacto del egreso.
- **Desvincular**: sólo sin asignaciones vigentes (primero se desafectan); deja el crédito `DESVINCULADO` (evento con
  motivo). Podría volver a vincularse como un crédito nuevo.
- Un pago en efectivo nunca es gasto de rentabilidad (regla F10-C1) y aparece una sola vez en el libro y a lo sumo una
  vez como crédito vigente.

### 5.2 Pagos declarados (D-6)

```text
DECLARADO           → no reduce la deuda exigible; no se puede asignar; se muestra en «pagos por confirmar»
   │ confirmación del dueño (motivo opcional, auditada; «confirmo que el pago salió de mi cuenta»)
   ▼
CONFIRMADO_DUENO    → efectivo: reduce la deuda exigible y se puede asignar
   │ F10-D (futuro): conciliación contra la cuenta real
   ▼
CONCILIADO / OBSERVADO
DECLARADO o CONFIRMADO_DUENO (sin asignaciones vigentes) → ANULADO (evento con motivo)
```

- Columnas preparadas para F10-D (nulas en F5-A): `medio`, `referencia`, `fechaPago`, `cuentaOrigenDeclarada`,
  `conciliacionEstado`, `conciliadoEn`, `conciliacionRef`.
- Nunca tienen pata en el libro financiero en F5-A; son la contraparte que F10-D conciliará.

### 5.3 Rentabilidad y no duplicación (D-4 / D-10)

- Pagos (Caja o declarados) **nunca** son gasto de rentabilidad: cancelan obligaciones.
- El costo de la mercadería se reconoce al **venderla** (costo de lo vendido; reportes posteriores), no al pagar ni al
  recibir.
- Cargo accesorio atribuible → entra al costo de inventario (no es gasto). No atribuible → gasto operativo. Nunca ambos.
- Un gasto operativo pagado en efectivo sigue siendo un `GASTO` de F10-C1; si en cambio queda adeudado a un proveedor,
  es una obligación `CARGO_ACCESORIO` marcada «no atribuible» (gasto), y su pago posterior es un crédito que la cancela
  (no un segundo gasto).

### 5.4 Contacto con F10-C1 (D-8) — único cambio en su perímetro

- Trigger **nuevo** `BEFORE INSERT` en `compensaciones_egresos_caja` (no reemplaza ninguna función de F10-C1): rechaza
  la compensación si el egreso tiene un crédito `PAGO_CAJA` no desvinculado.
- Una línea en `mapEgresoDbError` para devolver `409 PAGO_ASIGNADO_A_PROVEEDOR` («Desvinculá el pago del proveedor antes
  de compensarlo») y el texto en la interfaz del dueño.
- La vinculación toma el mismo orden de candados que la compensación (fila de la caja, luego fila del egreso), así
  vincular y compensar en simultáneo resuelve uno primero y el otro rechaza sin escribir.
- Se re-ejecutan las suites de F10-C1 (integración, contratos, interfaz) como regresión.

---

## 6. Costos, descuentos, impuestos y cargos accesorios (definido aquí, implementado en F10-C2a)

### 6.1 Precisión

| Magnitud | Tipo | Nota |
|---|---|---|
| Cantidad | `Decimal(14,3)` | kg / litro; se convierte al `Float` de stock sólo dentro de la autoridad R3A |
| Costo unitario | `Decimal(14,4)` | el redondeo a 2 decimales ocurre sólo en importes |
| Importes | `Decimal(12,2)` | `importeLinea = round2(cantidadAceptada × costoUnitario)` (HALF_UP) |
| `Producto.costo` (Float) | referencia | sólo «último costo»; nunca fuente del valor histórico |

### 6.2 Descuentos e impuestos

- **Descuento de línea** (bonificación del comprobante en ese renglón): reduce el costo unitario de esa línea.
- **Descuento global del comprobante**: se distribuye entre las líneas **por valor** antes de impuestos; reduce costo
  de inventario y deuda.
- **Impuestos** (IVA y otros): la línea guarda `neto` e `impuestos` por separado; la **deuda** es neto + impuestos −
  descuentos. Para el **costo de inventario**, configuración por negocio:
  - `IMPUESTOS_INTEGRAN_COSTO` (por defecto; monotributo / consumidor final: el impuesto no se recupera);
  - `IMPUESTOS_RECUPERABLES` (responsable inscripto: el IVA no integra el costo; queda informado por separado).
- Percepciones / retenciones: se registran como impuestos del comprobante (no recuperables por defecto); su tratamiento
  fiscal fino queda fuera del alcance.

### 6.3 Cargos accesorios (D-10)

| Tipo | Ejemplo | Costo de inventario | Deuda | Gasto |
|---|---|---|---|---|
| Atribuible, cobrado por el mismo proveedor | flete en la factura de la mercadería | **Sí**: se distribuye en las líneas de esa recepción (por valor por defecto; por cantidad opcional) | En la obligación de la recepción | No |
| Atribuible, cobrado por otro proveedor | transportista | **Sí**, distribuido igual | Obligación `CARGO_ACCESORIO` del transportista | No |
| No atribuible | flete mensual, gastos del local | No | Obligación `CARGO_ACCESORIO` «no atribuible» si se adeuda | **Sí** (gasto operativo) |

La distribución se calcula **una vez al aprobar** y queda congelada en cada línea (`costoUnitarioInventario`); un cargo
que llega después de aprobada la recepción se registra como cargo nuevo con su propia distribución sobre las mismas
líneas (sin reescribir la aprobación) y actualiza el último costo sólo si sigue siendo la recepción vigente.

### 6.4 Último costo del producto

Al aprobar una recepción, para cada línea aceptada con producto: se actualiza `costo` del producto/variante con su
`costoUnitarioInventario` **sólo si** la fecha de esa recepción es igual o posterior a la de la recepción que lo fijó la
última vez (tabla `costos_vigentes` por clave de stock con `recepcionLineaId` y fecha). Una recepción atrasada nunca
pisa un costo más nuevo. Un cambio manual del dueño en Inventario sigue permitido y queda como fuente «MANUAL» hasta la
próxima recepción más reciente.

---

## 7. Invariantes financieras y de stock

| # | Invariante | Garantía |
|---|---|---|
| I-1 | Cada pago en efectivo existe una vez en el libro (F10-C1) y, a lo sumo, una vez como crédito vigente | índice único `creditos.egresoCajaId` + trigger |
| I-2 | Una obligación nace sólo de: saldo inicial, ajuste, recepción aprobada (única por recepción), cargo accesorio (único por cargo) | CHECK de origen + índices únicos |
| I-3 | Σ asignaciones vigentes de un crédito ≤ su importe; de una obligación ≤ su importe | trigger con candado de ambas filas + servicio |
| I-4 | Sólo créditos efectivos y obligaciones vigentes del **mismo proveedor y negocio** se asignan | trigger |
| I-5 | Deuda exigible = Σ obligaciones vigentes − Σ créditos efectivos; las asignaciones no la cambian | cálculo único en el servicio; prueba de propiedad |
| I-6 | Un pago declarado no reduce la deuda exigible hasta `CONFIRMADO_DUENO` | definición de «efectivo» |
| I-7 | Nada confirmado se edita: anulaciones, desafectaciones y desvinculaciones son filas nuevas con evento | triggers de inmutabilidad + filas de evento |
| I-8 | Un egreso compensado no puede ser crédito; un egreso con crédito vigente no puede compensarse | triggers en ambas tablas + mismo orden de candados |
| I-9 | Pagos nunca son gasto; costo de inventario al vender; cada cargo accesorio se cuenta una vez (inventario **o** gasto) | reglas de reporte + tipo de cargo |
| I-10 | El stock entra sólo por la autoridad R3A al aprobar, una vez por línea | CAS de estado + índice único `movimientos_inventario.recepcionLineaId` |
| I-11 | Aislamiento: toda fila, FK y lectura acotada por el negocio de la sesión | FKs compuestas `(id, negocioId)` + guards |
| I-12 | Auditoría en la misma transacción para toda escritura | `auditLogWithClient(tx)` (R1) |

---

## 8. Flujos (recordatorio, sin cambios de fondo respecto de v1)

- **Cajero** (F10-C2b): «Recibir mercadería» → borrador → enviar; pago en efectivo opcional vinculado (D-7).
- **Dueño**: aprueba la recepción (stock + costo + obligación + anticipo propuesto, en una transacción) o la rechaza.
- **Dueño**: vincula pagos de Caja, registra y confirma pagos declarados, asigna / divide / desafecta / reasigna con
  sugerencia FIFO, registra saldos iniciales y ajustes, ve la deuda exigible, los anticipos y los pagos por confirmar.
- Los 14 casos excepcionales de v1 (§4.2 de la versión archivada) se mantienen; cambian sólo: pago declarado (ahora
  pendiente hasta confirmación), asignaciones (manuales con sugerencia) y cargos accesorios (§6.3).

---

## 9. Fases (orden nuevo, un solo motor)

| Fase | Contenido | Depende de |
|---|---|---|
| **F5-A** | Proveedores (D-1) + **motor completo** de cuenta corriente: obligaciones `SALDO_INICIAL` / `AJUSTE_DEUDA`; créditos `PAGO_CAJA` / `PAGO_DECLARADO` / `AJUSTE_A_FAVOR`; asignar, dividir, desafectar, reasignar; sugerencia FIFO; anticipos; guarda D-8; panel del dueño | F10-C1 (en TESTING) |
| **F10-C2a** | Compras (directa / por pedido) + recepciones + aprobación atómica (stock R3A + costos §6 + obligación `RECEPCION` + cargos `CARGO_ACCESORIO` + anticipo propuesto) + comprobantes sin duplicados | F5-A |
| **F10-C2b** | «Recibir mercadería» del cajero + pago en efectivo vinculado al crearlo (D-7) | F10-C2a |
| **F10-D1** | Corrección de egresos posterior al cierre (conciliación del error contra la diferencia del turno cerrado y recupero como ingreso nuevo en un turno abierto); levanta de forma controlada el bloqueo SQL de F10-C1 | F10-C1; independiente de C2 |
| **Production** | Decisión del paquete (F10-C1 + F5-A + C2a/b + D1) con autorización propia, respaldo y verificación | F10-D1 obligatorio |
| **F10-C2c** | Devoluciones al proveedor (salida R3A) → créditos `NOTA_CREDITO` del **mismo motor**; recepción complementaria; ajustes | F10-C2a |
| **F5-B** (extensiones del mismo motor) | Vencimientos y antigüedad de deuda, estado de cuenta exportable, reportes por proveedor; **no** agrega otro circuito de pagos | F5-A |
| Posteriores | Fotos de comprobantes (D-5), costo promedio y costo de lo vendido, F6 reposición, resto de F10-D/E | — |

F10-D1 puede adelantarse a F10-C2a si se prefiere llevar F10-C1 a Production antes; no depende de C2.

---

## 10. Alcance técnico exacto de F5-A (para aprobar su implementación local)

### 10.1 Migración `2026MMDDhhmmss_f5a_suppliers_ledger` (aditiva)

Tablas nuevas (todas con `negocioId`, FK a `negocios` CASCADE, `@@unique([id, negocioId])` para FKs compuestas):

| Tabla | Columnas | Restricciones SQL |
|---|---|---|
| `proveedores` | `id`, `nombre`, `nombreNormalizado`, `cuit?` (11 dígitos), `telefono?`, `email?`, `notas?`, `activo`, `creadoPorTipo/Id`, `createdAt`, `updatedAt` | `UNIQUE (negocioId, cuit) WHERE cuit IS NOT NULL`; `CHECK` de CUIT (dígito verificador en función SQL); longitudes; índice `(negocioId, nombreNormalizado)` no único |
| `proveedor_cambios` | `proveedorId`, `campos` (lista), `actor`, `createdAt` | append-only (cambios de ficha auditables) |
| `obligaciones_proveedor` | `id`, `proveedorId`, `origen` (`SALDO_INICIAL`/`AJUSTE_DEUDA`; C2a agrega `RECEPCION`/`CARGO_ACCESORIO`), `importeDecimal (12,2) > 0`, `fecha`, `descripcion` (1..500), `comprobanteTipo/Numero/Fecha?`, `estado` `VIGENTE`/`ANULADA`, `anuladaEn?`, `actor`, `idempotencyKey/Fingerprint`, `createdAt` | `UNIQUE (negocioId, idempotencyKey)`; máximo un `SALDO_INICIAL` vigente por proveedor (índice parcial); inmutable salvo `estado` con su evento |
| `creditos_proveedor` | `id`, `proveedorId`, `origen` (`PAGO_CAJA`/`PAGO_DECLARADO`/`AJUSTE_A_FAVOR`; C2c agrega `NOTA_CREDITO`), `importeDecimal > 0`, `egresoCajaId?` (UNIQUE), `medio?`, `referencia?`, `fechaPago?`, `cuentaOrigenDeclarada?`, `estado`, `conciliacionEstado?`, `conciliadoEn?`, `conciliacionRef?`, `compraReferenciaId?` (reservado C2a), `motivo?`, `actor`, idempotencia, `createdAt` | `PAGO_CAJA` ⇒ `egresoCajaId` NOT NULL e importe = egreso; estados válidos por origen; inmutable salvo transición de estado con evento |
| `eventos_cuenta_proveedor` | `id`, `objetivo` (`OBLIGACION`/`CREDITO`), `obligacionId?`, `creditoId?`, `tipo` (`ANULACION`, `CONFIRMACION`, `DESVINCULACION`), `motivo`, `actor`, idempotencia, `createdAt` | append-only; una transición por tipo y objetivo |
| `operaciones_asignacion` | `id`, `proveedorId`, `tipo` (`ASIGNAR`/`DESAFECTAR`/`REASIGNAR`), `motivo?`, `actor`, idempotencia, `createdAt` | `UNIQUE (negocioId, idempotencyKey)` |
| `asignaciones_pago` | `id`, `operacionId`, `creditoId`, `obligacionId`, `tipo` (`ASIGNACION`/`DESAFECTACION`), `importeDecimal > 0`, `revierteAsignacionId?` (UNIQUE), `createdAt` | `DESAFECTACION` ⇒ revierte una `ASIGNACION` vigente del mismo par por el mismo importe; append-only |

Triggers nuevos:
- `guard_credito_proveedor`: `PAGO_CAJA` sólo de egreso `PAGO_PROVEEDOR` del mismo negocio, sin compensación, importe
  exacto; transiciones de estado sólo con su evento; inmutabilidad del resto.
- `guard_obligacion_proveedor`: inmutabilidad; `ANULADA` sólo sin asignaciones vigentes y con su evento.
- `guard_asignacion_pago`: mismo proveedor y negocio; crédito efectivo; obligación vigente; topes I-3 (con las filas
  bloqueadas por el servicio); desafectación exacta y única.
- `guard_compensacion_egreso_con_credito` (sobre `compensaciones_egresos_caja`, **nuevo**, no reemplaza funciones de
  F10-C1): rechaza si existe crédito `PAGO_CAJA` no desvinculado del egreso.

Sin cambios en `egresos_caja`, `operaciones_financieras`, `movimientos_financieros`, stock ni ventas.

### 10.2 Servicios (servidor)

| Archivo | Responsabilidad |
|---|---|
| `src/lib/cuit.ts` | Normalización y validación de CUIT (pura, con pruebas) |
| `src/lib/proveedores-service.ts` | Alta con advertencia de nombre similar, edición de ficha (con `proveedor_cambios`), activar/desactivar, listado con saldos |
| `src/lib/cuenta-proveedor-service.ts` | Único escritor del motor: obligaciones (saldo inicial, ajuste, anulación), créditos (vincular egreso de Caja, pago declarado, ajuste a favor, confirmar, anular, desvincular), operaciones de asignación (asignar / desafectar / reasignar), cálculos §4.2, sugerencia FIFO, estado de cuenta |
| `src/lib/cuenta-proveedor-http.ts` | Glue HTTP: sesión del dueño, Idempotency-Key, auditoría R1 en la transacción, respuestas |

Patrón: `runSerializable` con candados `FOR UPDATE` (orden fijo: proveedor → obligaciones/créditos por id ascendente;
para vincular un egreso: fila de la caja → fila del egreso, igual que la compensación); idempotencia por acción con
huella; errores de dominio con códigos estables.

### 10.3 APIs (sólo dueño, `requireNegocioCajaGenerico`, `no-store`)

| Método y ruta | Acción |
|---|---|
| `GET /api/negocio/proveedores` | Lista con deuda exigible, anticipo y pagos por confirmar (filtros: activo, búsqueda) |
| `POST /api/negocio/proveedores` | Alta; `409 PROVEEDOR_NOMBRE_SIMILAR` con coincidencias si no viene `confirmoNombreSimilar`; `409 PROVEEDOR_CUIT_DUPLICADO`; `400 CUIT_INVALIDO` |
| `GET / PATCH /api/negocio/proveedores/[id]` | Ficha; edición de datos de contacto y CUIT (mismas validaciones); `activo` |
| `GET /api/negocio/proveedores/[id]/cuenta` | Estado de cuenta: obligaciones con pendiente, créditos con disponible y estado, asignaciones vigentes e historial, totales §4.2 |
| `POST /api/negocio/proveedores/[id]/obligaciones` | `SALDO_INICIAL` o `AJUSTE_DEUDA` (Idempotency-Key) |
| `POST /api/negocio/proveedores/obligaciones/[id]/anulacion` | Anular (motivo; sin asignaciones vigentes) |
| `POST /api/negocio/proveedores/[id]/creditos` | `PAGO_DECLARADO` (medio, referencia, fecha) o `AJUSTE_A_FAVOR` (motivo) |
| `POST /api/negocio/proveedores/[id]/creditos/caja` | Vincular un egreso `PAGO_PROVEEDOR` de F10-C1 |
| `POST /api/negocio/proveedores/creditos/[id]/confirmacion` | Confirmar un pago declarado |
| `POST /api/negocio/proveedores/creditos/[id]/anulacion` | Anular un pago declarado / ajuste (sin asignaciones vigentes) |
| `POST /api/negocio/proveedores/creditos/[id]/desvinculacion` | Desvincular un pago de Caja (sin asignaciones vigentes) |
| `GET /api/negocio/proveedores/[id]/sugerencia?creditoId=` | Sugerencia FIFO (lectura) |
| `POST /api/negocio/proveedores/[id]/asignaciones` | Operación `ASIGNAR` / `DESAFECTAR` / `REASIGNAR` con sus renglones (Idempotency-Key) |
| `GET /api/negocio/caja/egresos?naturaleza=PAGO_PROVEEDOR&vinculado=false` | Pagos de Caja todavía sin proveedor (extensión de lectura del listado existente) |

### 10.4 Permisos

Todo F5-A es **sólo del dueño** del negocio genérico. El cajero no ve ni modifica proveedores, deudas, anticipos ni
asignaciones (401/403 en todas las rutas; contrato estático: ningún código de Operaciones importa los módulos de F5).
El único cambio visible para el cajero es indirecto: el dueño no podrá compensar un pago suyo que esté vinculado (D-8).

### 10.5 Interfaz del dueño (primera versión)

Sección «Proveedores» en la administración: lista con deuda exigible / anticipo / pagos por confirmar; alta con
advertencia de nombre similar; ficha; estado de cuenta; registrar saldo inicial o ajuste; «Pagos de Caja sin
proveedor» → vincular; registrar y confirmar pago declarado; asignar con la sugerencia FIFO precargada (editable,
divisible, dejar como anticipo); desafectar / reasignar. Confirmaciones explícitas en toda acción de dinero, mismas
pautas móviles que F10-C1 (sin desborde, aviso de instalación y chat apartados con formularios abiertos).

### 10.6 Pruebas

| Tipo | Cobertura |
|---|---|
| Unitarias | CUIT (válidos, dígito verificador, prefijos, formatos), normalización de nombres, cálculos §4.2 y sugerencia FIFO (incluida una prueba de propiedad de la identidad de I-5) |
| Integración (`deligo_ci`, `deligo_qa_auto`) | alta / duplicado de CUIT / mismo CUIT en otro negocio / advertencia y confirmación; saldo inicial único; ajuste; anulación con y sin asignaciones; vincular egreso (no `PAGO_PROVEEDOR`, compensado, de otro negocio, dos veces → rechazos); D-8 en ambos órdenes y en carrera; desvincular y luego compensar; pago declarado: no reduce la deuda, no se asigna, confirmación, anulación; asignar, dividir, sobreasignación, doble asignación, desafectar dos veces, reasignación atómica, ráfagas con la misma y distinta clave, concurrencia de dos asignaciones sobre el mismo crédito; anticipo; auditoría en la misma transacción (xmin); aislamiento entre negocios |
| Regresión F10-C1 | suites de integración C1a / C1a-R1 / C1c, contratos C1a/C1b/C1c y componentes (el único cambio es la guarda D-8) |
| Contratos estáticos | un solo escritor de las tablas de F5; F5 no escribe libro financiero, stock, ventas ni egresos; Operaciones no importa F5 |
| Componentes (happy-dom) | panel de proveedores: advertencia, confirmaciones, doble clic, sugerencia editable, estados |
| Navegador local | escritorio y 320/375/412/768 |
| CI | agregar las suites F5-A al workflow existente |

### 10.7 Límites de la primera versión

- No hay compras, recepciones, stock ni costos (llegan en F10-C2a); las únicas obligaciones son saldo inicial y
  ajustes del dueño.
- Pagos declarados confirmados sólo por el dueño; sin conciliación bancaria (F10-D).
- Sin vencimientos, antigüedad de deuda, exportación ni reportes por período (F5-B, mismo motor).
- Sin fotos de comprobantes (D-5).
- Sin interfaz para el cajero (F10-C2b).
- Sin reembolsos en efectivo de proveedores (F10-D/E).
- Sin Production: sigue requiriendo F10-D1 y autorización propia.

---

## 11. Production y F10-D1 (registrado)

- F10-C1: `CLOSED_TESTING_CERTIFIED` (2026-11-19, `bfaba2a`), **no autorizado para Production**.
- Criterio del operador: **F10-D1 es requisito previo** para habilitar egresos en Production; no hace falta F10-D
  completo.
- F10-D1 (alcance a diseñar cuando se autorice): conciliación de un egreso erróneo contra la diferencia del turno
  cerrado y su entrega (sin crear dinero) y recupero real de efectivo como ingreso nuevo en el turno que lo recibe;
  con F5, si el egreso estaba vinculado a un proveedor, el crédito se desvincula o se ajusta por el mismo motor.
