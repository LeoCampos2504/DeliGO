# F10-C2 + F5 (alcance mínimo) — Compras, recepción de mercadería y proveedores · DISEÑO v2

Estado: `F10_C2_F5_STATUS=DESIGN_V2_DECISIONS_FINAL` · **2026-11-20: mejoras de C2b, pagos asociados a la recepción (D-7 v2),
pedidos con total informado, precios de venta al aprobar, cierre de pedidos con pendientes, etiquetas de góndola y precios
protegidos por inicio de venta IMPLEMENTADOS EN LOCAL; validación manual PARCIAL en `deligo_dev` (ver §15.3: qué está
comprobado y qué falta); sin commits ni despliegues** (versión previa archivada en
`codex-reports/archive/F10_C2_F5_COMPRAS_RECEPCION_DISENO_v2_pre_c2c_20261120.md`) · **F5-A y F10-C2a aceptados en desarrollo local; centralización R3A de F4 y
F10-C2b (interfaces + D-7) IMPLEMENTADOS EN LOCAL (2026-11-19), sin commits ni despliegues** (§14; versión previa archivada en
`codex-reports/archive/F10_C2_F5_COMPRAS_RECEPCION_DISENO_v2_pre_c2b_20261119.md`) · **F5-A y F10-C2a IMPLEMENTADOS EN LOCAL
(2026-11-19), sin commits ni despliegues** (§12, §12.7 y §13; versión previa a C2a archivada en
`codex-reports/archive/F10_C2_F5_COMPRAS_RECEPCION_DISENO_v2_pre_c2a_20261119.md`) (ver §12; versión v2 previa a la implementación archivada en
`codex-reports/archive/F10_C2_F5_COMPRAS_RECEPCION_DISENO_v2_pre_f5a_20261119.md`). F10-C2a/b/c, F10-D/E y F5-B sin implementar. Fecha: 2026-11-19. Base analizada: `testing-codex` `bfaba2a`.
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

---

## 12. F5-A — implementación local (2026-11-19)

`F5A_STATUS=IMPLEMENTED_LOCAL_TESTS_PASS · NOT_COMMITTED · NOT_DEPLOYED` · worktree `deligo-dev-local`
(`dev/local-f4c`, base `bfaba2a` = `origin/testing-codex`). Autorización del operador (2026-11-19): sólo desarrollo
local; sin commits, push ni despliegues; sin tocar Railway TESTING, Production ni paola-vinal; sin F10-C2, F10-D/E,
F5-B, stock ni conciliación bancaria. F10-C1 sigue `CLOSED_TESTING_CERTIFIED` y no autorizado para Production.

### 12.1 Modelo y migración

Migración aditiva `20261119180000_f5a_suppliers_ledger` (sólo crea; ningún `DROP`/`RENAME`/`ALTER` de tablas
existentes; LF con un único salto final). Las **7 tablas** del §10.1 sin cambios de alcance:
`proveedores`, `proveedor_cambios`, `obligaciones_proveedor`, `creditos_proveedor`, `eventos_cuenta_proveedor`,
`operaciones_asignacion`, `asignaciones_pago`. Dinero en `Decimal(12, 2)` (ningún `Float`).

En SQL (defensa en profundidad, además del servicio):
- `f5a_cuit_valido` (11 dígitos, prefijos 20/23/24/25/26/27/30/33/34, módulo 11 con pesos 5,4,3,2,7,6,5,4,3,2) en
  `CHECK`; índice único parcial `(negocioId, cuit) WHERE cuit IS NOT NULL` (mismo CUIT permitido en otro negocio).
- Obligaciones: origen `SALDO_INICIAL` | `AJUSTE_DEUDA` (con naturaleza `ERROR_DE_CARGA` | `DIFERENCIA_ACORDADA` |
  `RECARGO` | `OTRO`); un `SALDO_INICIAL` vigente por proveedor (índice parcial); `recepcionId` reservado (NULL en
  F5-A por `CHECK`) con índice único parcial `(negocioId, recepcionId)` ya creado para F10-C2a; inmutables salvo
  `VIGENTE → ANULADA` con su evento y sin asignaciones vigentes.
- Créditos: `PAGO_CAJA` (`VIGENTE → DESVINCULADO`; sólo egreso `PAGO_PROVEEDOR` del mismo negocio, no compensado,
  importe exacto, con la fila del egreso bloqueada `FOR UPDATE`; índice único parcial: un vínculo vigente por egreso),
  `PAGO_DECLARADO` (`DECLARADO → CONFIRMADO_DUENO → ANULADO`, `DECLARADO → RECHAZADO`; medio `TRANSFERENCIA` |
  `MERCADO_PAGO` | `OTRO`), `AJUSTE_A_FAVOR` (`VIGENTE → ANULADO`, naturaleza y motivo obligatorios). Cada transición
  exige su evento con el mismo instante; salir del estado efectivo exige no tener asignaciones vigentes. Columnas de
  conciliación (F10-D) y `compraReferenciaId` (C2a) forzadas a NULL.
- Asignaciones: FKs **compuestas** `(creditoId, proveedorId, negocioId)` y `(obligacionId, proveedorId, negocioId)`
  (asignar entre proveedores o negocios es estructuralmente imposible); trigger con candado crédito → obligación,
  crédito efectivo, obligación vigente y topes (`asignado + nuevo ≤ importe` en ambos lados); `DESAFECTACION`
  revierte exactamente una `ASIGNACION` del mismo par e importe (`revierteAsignacionId` único).
- Append-only: `UPDATE` bloqueado en historial/eventos/operaciones/asignaciones y **`DELETE` bloqueado en las 7
  tablas** (mismo criterio que F4-C3: sólo la cascada al eliminar el negocio completo). Un proveedor no se borra: se
  desactiva.
- D-8 (único contacto con F10-C1, aditivo): trigger nuevo `BEFORE INSERT` sobre `compensaciones_egresos_caja` que
  bloquea la fila del egreso y rechaza la compensación si hay un crédito `PAGO_CAJA` vigente.

Fórmulas (§4.2), calculadas siempre, nunca guardadas: `deudaVigente = Σ obligaciones VIGENTES` ·
`obligacionesPendientes = Σ (importe − asignado)` · `creditosConfirmados = Σ créditos efectivos (VIGENTE |
CONFIRMADO_DUENO)` · `creditosAsignados = Σ asignado de créditos efectivos` · `anticiposDisponibles = confirmados −
asignados` · `pagosDeclaradosPendientes = Σ DECLARADO` (no resta) · `saldoExigible = deudaVigente −
creditosConfirmados`, verificada contra `obligacionesPendientes − anticiposDisponibles` (`identidadOk`). Asignar no
cambia el saldo; una asignación no puede descontar dos veces el mismo dinero (topes + candado por proveedor + SQL).

### 12.2 Servicios, APIs y reglas

| Archivo | Rol |
|---|---|
| `src/lib/cuit.ts` | CUIT puro (misma regla que SQL) y normalización de nombres para advertir similares |
| `src/lib/proveedores-service.ts` | Alta (CUIT validado/único, advertencia de nombre similar en forma compacta, Idempotency-Key), edición con `proveedor_cambios` |
| `src/lib/cuenta-proveedor-service.ts` | **Único escritor** del motor: obligaciones, créditos, eventos, operaciones y asignaciones; estado de cuenta; sugerencia FIFO (sólo lectura); pagos de Caja sin vincular |
| `src/lib/cuenta-proveedor-http.ts` | Glue HTTP del dueño, auditoría R1 dentro de la transacción, `no-store` |

Rutas (todas `requireNegocioCajaGenerico`; el negocio sale de la sesión; Origin protegido en `src/proxy.ts`):
`GET/POST /api/negocio/proveedores` · `GET/PATCH /[id]` · `GET /[id]/cuenta` · `POST /[id]/obligaciones` ·
`POST /[id]/creditos` · `POST /[id]/creditos/caja` · `GET /[id]/sugerencia?creditoId=` · `POST /[id]/asignaciones`
(`ASIGNAR` | `DESAFECTAR` | `REASIGNAR`) · `POST /obligaciones/[id]/anulacion` ·
`POST /creditos/[id]/(confirmacion|rechazo|anulacion|desvinculacion)` · `GET /pagos-caja-sin-vincular`.
Cada escritura económica: Serializable con reintento acotado, Idempotency-Key + huella (replay 200
`Idempotency-Replayed`, clave reutilizada 409), auditoría en la misma transacción; vincular un pago de Caja toma los
candados en el mismo orden que la compensación de F10-C1 (fila de la caja → fila del egreso) y nunca modifica el
egreso.

Contacto con F10-C1 (código): `compensarEgresoCaja` rechaza con `409 PAGO_VINCULADO_A_PROVEEDOR` (nada escrito) si el
egreso está vinculado; `mapEgresoDbError` traduce el trigger; la vista del dueño agrega `vinculoProveedor` y
`compensacionBloqueada = "VINCULADO_A_PROVEEDOR"`; el panel de Egresos muestra el vínculo. Sin cambios en
`egresos_caja`, libro financiero, cierre, stock ni ventas.

Desvíos respecto del §10 (todos más estrictos o equivalentes): FKs compuestas con `proveedorId`; estado `RECHAZADO`
(+ evento `RECHAZO`) para pagos declarados que no se hicieron; pagos de Caja sin vincular por endpoint propio en vez
de extender el listado de F10-C1; guardas `DELETE`; el alta de proveedor usa clave de idempotencia sin columna de
huella (el replay compara nombre + CUIT); `PATCH` de ficha sin Idempotency-Key (no es económico y es idempotente por
contenido); el contrato estático F10-B2.0 suma `cuenta-proveedor-service.ts` como escritor de `importeDecimal` de
sus propias tablas.

### 12.3 Interfaz

Subpestaña **Caja → Proveedores** (`owner-proveedores.tsx`): lista con saldo («Le debés» / «Tenés a favor»),
declarados sin confirmar y aviso de pagos de Caja sin vincular; alta con advertencia de nombre similar y
confirmación; ficha editable con historial; tarjetas de totales con la fórmula a la vista; saldo inicial / ajuste;
pago declarado / ajuste a favor; vincular pago de Caja; confirmar / rechazar / anular / desvincular con motivo;
asignar con sugerencia FIFO editable (centavos enteros, tope por deuda y por pago, anticipo restante); reasignar en
una operación; desafectar; historial. Toda acción de dinero pasa por un paso de confirmación, con clave estable por
contenido (se conserva ante error de red/5xx) y deshabilitada mientras se envía.

Revisión en navegador (local, `deligo_qa_auto`, instancia :3001, dueño QA ficticio): escritorio y 375 px — CUIT
inválido rechazado con mensaje claro, advertencia de nombre similar, saldo inicial 15.000,50, transferencia declarada
6.000 que no resta hasta confirmarla, confirmación (saldo 9.000,50), asignación con sugerencia FIFO; sin desborde
horizontal a 375 px, botones ≥ 44 px; consola sólo con los 401/400/409 esperados; sin errores del servidor. Ajustes
tras la revisión: CUIT formateado en la advertencia, fechas legibles en la confirmación, importes alineados a la
derecha en móvil.

### 12.4 Pruebas y bases

| Suite | Resultado |
|---|---|
| `f5a-cuenta-proveedor.integration.test.ts` | 20/20 en `deligo_ci` y 20/20 en `deligo_qa_auto` |
| `cuit.test.ts` + `f5a-static-contract.test.ts` | 11/11 |
| `owner-proveedores.test.tsx` (happy-dom) | 7/7 |
| Regresión F10-C1: C1a 21/21 · C1a-R1 6/6 · C1c 12/12 · componentes cajero 17/17, dueño 11/11, página cajero 6/6, `caja-tab` 7/7 | PASS |
| Contratos C1a/C1b/C1c + F10-B2.0 + Origin + F5-A | 54 PASS / 1 FAIL **preexistente y sólo local**: «migration file bytes are LF» de F10-B2.0 falla porque `core.autocrlf=true` deja CRLF en la copia de trabajo de esa migración (el blob en Git tiene 0 CR; en CI Linux pasa) |
| `tsc` | 41 diagnósticos = línea base; 0 en archivos de F5-A ni en los tocados |
| ESLint / `git diff --check` | limpio / limpio |

Integración cubre: CUIT válido/inválido/duplicado (también en carrera y con otro formato) y mismo CUIT en otro
negocio; nombre similar y confirmación; doble clic, replays y clave reutilizada; saldo inicial único; ajustes con
naturaleza; anulación con evento; pagos declarados (no restan, no se asignan, confirmados, rechazados, anulados);
pagos parciales y anticipos con todas las fórmulas; topes por crédito y por deuda; dos asignaciones simultáneas del
mismo crédito (una sola gana); desafectar / reasignar atómico; vínculo con Caja sin tocar el egreso ni el libro;
compensación bloqueada (API y SQL) y luego permitida tras desvincular; vincular un compensado; ambos órdenes y 8
rondas en carrera (nunca ambos); auditoría en la transacción y rollback; sólo dueño (cajero 401/403, rubro no genérico
403); aislamiento entre negocios y proveedores (API y FKs); append-only `UPDATE`/`DELETE` con cascada del negocio.
Suites agregadas al workflow `.github/workflows/f10-b2-2-e-testing.yml` (local, sin push).

`deligo_dev`: respaldo previo `C:\Users\eltig\deligo-dev-db\respaldos\deligo_dev_pre-f5a_20261119-160615.dump`; se
aplicó **sólo** `20261119180000_f5a_suppliers_ledger` (sin reset ni seed); conteos idénticos antes y después
(negocios 4, ventas 66, turnos 10, operaciones 35, movimientos 35, egresos 4, revisiones 2, compensaciones 1;
migraciones 55 → 56); respaldo posterior `deligo_dev_post-f5a_20261119-160628.dump`. `deligo_qa_auto` migrado y con
datos QA de la revisión (proveedor «Distribuidora Sur S.A.» del negocio QA).

### 12.5 Riesgos pendientes

- Doble registro humano: un pago hecho en efectivo de Caja y además declarado como «Otro medio» descontaría dos veces;
  el sistema no puede distinguirlos (medio efectivo no se ofrece en pagos declarados y la UI lo advierte). Mitigación
  futura posible: advertencia si existe un pago de Caja sin vincular del mismo importe.
- Copias de trabajo Windows con `core.autocrlf=true` y sin `.gitattributes` para migraciones: la suma de verificación
  de Prisma depende de los bytes; la migración de F5-A está en LF. Riesgo preexistente del repositorio.
- `next-env.d.ts` aparece modificado por `next dev` (no es parte de F5-A; no debe commitearse).
- Listas acotadas (500 proveedores, 200 eventos/operaciones, 200 pagos sin vincular); sin paginación todavía.
- Sin Production (F10-D1 obligatorio), sin conciliación bancaria, sin pruebas físicas en dispositivo.

### 12.6 Preparación para F10-C2a

Listo para recibir obligaciones `RECEPCION`: `recepcionId` reservado con índice único parcial (una obligación por
recepción aprobada); `compraReferenciaId` reservado en créditos para anticipos con referencia no vinculante. F10-C2a
necesitará una migración aditiva que habilite `origen IN ('RECEPCION', 'CARGO_ACCESORIO')` con `recepcionId NOT
NULL` (hoy el `CHECK` lo fuerza a NULL), y crear la obligación dentro de la misma transacción Serializable de la
aprobación de la recepción usando `cuenta-proveedor-service` como único escritor.

### 12.7 Revisión de F5-A (operador, 2026-11-19) — tres ajustes, sin cambio de modelo

**A. Pagos duplicados por carga humana.** El efectivo que salió de Caja tiene una sola fuente: el egreso
`PAGO_PROVEEDOR`, que se **vincula** (crédito `PAGO_CAJA`). Ahora:
- todo pago declarado exige `confirmoNoSalioDeCaja: true` (400 `CONFIRMACION_FUERA_DE_CAJA_REQUERIDA`) y «Otro medio»
  exige decir cuál en la nota (400 `MEDIO_DETALLE_REQUERIDO`);
- al declarar, dentro de la transacción Serializable, se buscan **posibles duplicados**: pagos de Caja `PAGO_PROVEEDOR`
  no compensados del mismo importe en ±3 días (sin vincular, o vinculados a este proveedor; nunca los de otro proveedor
  u otro negocio) y pagos declarados vigentes del mismo proveedor con mismo importe y fecha o con la misma referencia
  normalizada. Si hay, `409 POSIBLE_PAGO_DUPLICADO` con los candidatos y **nada escrito**; el mensaje sugiere vincular el
  pago de Caja en lugar de declararlo;
- al vincular un pago de Caja se advierte igual si existe un pago declarado del mismo proveedor e importe en fechas
  cercanas (la salida correcta es rechazar/anular el declarado y vincular el egreso);
- son **advertencias confirmables** (`confirmoNoDuplicado: true`): dos pagos legítimos del mismo importe no se bloquean;
  la declaración y los candidatos advertidos quedan en la auditoría de la misma transacción.
Sin columnas nuevas (no hizo falta cambiar el modelo).

**B. Saldos.** La API ya no expone un «saldo exigible» con signo. Totales: `saldoNeto` (con signo, para la identidad),
`deudaExigible = max(saldoNeto, 0)` y `saldoAFavor = max(−saldoNeto, 0)` (nunca negativos; uno de los dos es 0), más
`anticiposDisponibles` (pagos confirmados aún sin asignar, que puede coexistir con deuda exigible). La interfaz muestra
«Deuda exigible» o «Saldo a favor» y avisa cuando hay anticipos sin asignar con deuda. No se modificó ningún movimiento.

**C. Migraciones Windows/Linux.** Verificado: en esta copia Windows 53 de 56 migraciones tienen CRLF en disco (el blob
en Git es LF) y las bases locales guardaron checksums de esos bytes CRLF. Con una copia LF de las mismas migraciones,
`prisma migrate status` contra `deligo_ci` dice «up to date» y `migrate deploy` no aplica nada: **Prisma tolera la
diferencia de fin de línea**; sólo fallan los chequeos byte a byte (p. ej. el contrato F10-B2.0). Protección agregada en
`deligo-dev-local`: `.gitattributes` con `prisma/migrations/**/*.sql text eol=lf` (no cambia blobs ni marca archivos
modificados; las próximas copias salen en LF) y contrato estático que exige el atributo, todo blob de migración en LF y
la migración nueva en LF con un salto final. No se tocó ninguna migración aplicada. F5-A (`20261119180000`) y C2a
(`20261119210000`) ordenan después de todo lo que hay en `testing-codex` (`20261118150000`) y `main`: integrarlas no
genera conflicto de historial.

Pruebas de la revisión: integración F5-A 25/25 (5 nuevas: declaración obligatoria, duplicado contra Caja, duplicado al
vincular, pagos legítimos iguales, saldo a favor vs anticipos), panel 10/10, contratos + CUIT 12/12.

---

## 13. F10-C2a — implementación local (2026-11-19)

`F10_C2A_STATUS=IMPLEMENTED_LOCAL_TESTS_PASS · NOT_COMMITTED · NOT_DEPLOYED` · sin interfaz (F10-C2b no autorizado).

### 13.1 Modelo (migración aditiva `20261119210000_f10_c2a_purchases_receptions`)

| Tabla | Rol |
|---|---|
| `configuracion_compras` | `tratamientoImpuestos` del negocio: `IMPUESTOS_INTEGRAN_COSTO` (defecto) / `IMPUESTOS_RECUPERABLES` |
| `compras` + `compra_lineas` | Pedido (documento: no mueve dinero ni stock). Estado `ABIERTA` → `CERRADA_CON_FALTANTE` / `ANULADA` (con evento). Lo recibido se **deriva** de las recepciones aprobadas |
| `recepciones` | Entrega física, directa o contra un pedido del **mismo** proveedor (FK compuesta). `BORRADOR → PENDIENTE_APROBACION → APROBADA / RECHAZADA`, `PENDIENTE → BORRADOR` (devuelta), `BORRADOR → DESCARTADA`. `version` para CAS; instantánea de totales al aprobar |
| `recepcion_lineas` | recibida = aceptada + rechazada (motivo obligatorio: `DANADO`, `VENCIDO`, `NO_PEDIDO`, `ERROR_PROVEEDOR`, `OTRO`); costo unitario `Decimal(14,4)`, descuento % y alícuota %; costos de aprobación congelados |
| `recepcion_cargos` | `ATRIBUIBLE` (por `VALOR` o `CANTIDAD`) / `NO_ATRIBUIBLE`; proveedor que lo cobra |
| `eventos_compra_recepcion` | Historia append-only (envío, devolución, aprobación, rechazo, descarte, cierre, anulación) |
| `costos_vigentes` | «Último costo» por clave de stock con la recepción que lo fijó |

Cambios aditivos en tablas existentes: `movimientos_inventario.recepcionLineaId` (único) y `obligaciones_proveedor.recepcionCargoId`
(único parcial); se reemplazan los dos CHECK que F5-A reservó para C2a (`origen` admite `RECEPCION` / `CARGO_ACCESORIO`;
`RECEPCION` ⇔ `recepcionId`, `CARGO_ACCESORIO` ⇔ `recepcionCargoId`). Productos borrados: las líneas conservan nombre y
costos (`SET NULL`, el único cambio permitido sobre una línea cerrada).

Guardas SQL: transiciones sólo con su evento y subiendo la versión; recepción cerrada inmutable; contenido de líneas y
cargos sólo en `BORRADOR`; instantánea escrita una sola vez y antes de cerrar; producto/variante del negocio; renglón de
pedido del mismo pedido; entrada `RECEPCION` sólo para recepción `APROBADA`, cantidad exacta e inmutable; obligación
`RECEPCION` sólo para recepción aprobada, mismo proveedor e importe exacto; un cargo atribuible del mismo proveedor no
puede tener obligación propia; las obligaciones de recepción no se anulan; comprobante único entre aprobadas del mismo
proveedor; una aprobación por recepción; sólo el dueño aprueba / rechaza / devuelve / cierra / anula (CHECK de actor);
nada se borra salvo la cascada del negocio.

### 13.2 Costos (§6), calculados en `src/lib/compras-calculo.ts` (puro)

`subtotal = round2(aceptada × costo)` → descuento de línea % → descuento global repartido por valor → `neto` →
`impuestos = round2(neto × alícuota)` → percepciones repartidas por valor (integran costo) → cargos atribuibles
repartidos por valor o cantidad → `costoInventario = neto + percepción + cargos + (IVA si integra)`;
`costoUnitarioInventario = costoInventario / aceptada` (4 decimales). Obligación de la recepción = Σ(neto + impuestos) +
percepciones + cargos atribuibles del mismo proveedor. Cargo atribuible de otro proveedor → obligación `CARGO_ACCESORIO`
de ese proveedor; cargo no atribuible → obligación `CARGO_ACCESORIO` (gasto, nunca inventario). Repartos por resto mayor
en centavos (la suma es exacta).

### 13.3 Aprobación atómica (dueño) e integración con R3A y F5

Una transacción Serializable (reintento acotado): candado de la recepción + CAS de estado y **versión vista por el dueño**,
candado del pedido (si hay) y de los proveedores en orden fijo; análisis con el estado actual (productos vigentes,
proveedor activo, pedido abierto, comprobante no repetido); **excedentes** sobre lo pendiente del pedido o productos no
pedidos exigen `confirmoExcedentes`; **diferencias de costo** > 20 % contra lo acordado, la última recepción o el costo del
producto exigen `confirmoDiferenciasCosto`. Luego: instantánea de líneas → evento `APROBACION` → recepción `APROBADA` →
stock por la **autoridad R3A** (`registrarEntradaRecepcion` en `stock-lifecycle.ts`: un movimiento `RECEPCION` por línea
aceptada con control de stock; sin control → sólo costo y deuda) → último costo sólo si la recepción es la más reciente
por `(fechaRecepcion, aprobadaEn, línea)` → **una** obligación `RECEPCION` y las de cargos, por
`crearObligacionDeRecepcionEnTx` del motor único de F5 → anticipos opcionales (`aplicarAnticipos`) por
`operarAsignacionesEnTx` (mismo motor, mismos topes, mismo proveedor y negocio) → auditoría. Cualquier fallo después de
la primera escritura aborta **todo**. Nada toca el libro financiero ni los egresos de Caja.

### 13.4 Endpoints

Dueño (`requireNegocioCajaGenerico`, Origin protegido): `GET/POST /api/negocio/recepciones` · `GET/PUT …/[id]` ·
`GET …/[id]/vista-previa` · `POST …/[id]/aprobacion` · `POST …/[id]/(envio|devolucion|rechazo|descarte)` ·
`GET/POST /api/negocio/compras` · `GET …/compras/[id]` · `POST …/compras/[id]/(cierre|anulacion)` ·
`GET/PATCH /api/negocio/compras/configuracion`. Cajero (área caja): `GET/POST /api/operativo/caja/[slug]/recepciones` ·
`GET/PUT …/[id]` (sólo las suyas) · `POST …/[id]/(envio|descarte)` (devolución/rechazo → 403) ·
`GET …/recepciones-datos` (proveedores activos y pedidos abiertos, sin saldos ni costos acordados).

### 13.5 Pruebas

| Suite | Resultado |
|---|---|
| `f10-c2a-recepciones.integration.test.ts` | 16/16 en `deligo_ci` y 16/16 en `deligo_qa_auto` |
| `compras-calculo.test.ts` + `f10-c2a-static-contract.test.ts` | 13/13 |
| F5-A (integración / puras / panel) | 25/25 · 12/12 · 10/10 |
| F10-C1 (C1a, C1a-R1, C1c, contratos, componentes, `caja-tab`) | 21/21 · 6/6 · 12/12 · 25/25 · 17 + 11 + 6 · 7/7 |
| R3A (`stock-lifecycle*`, `stock-authority`, reservas, modo, inventario) | 201/201 |
| F4-A / F4-B integración, F10-B2.1 turnos, movimientos de inventario | 9/9 · 10/10 · 44/44 · 13/13 + 19/19 |
| Contratos con falla **preexistente** (no causada por C2a) | F10-B2.0 «LF» (CRLF de la copia Windows) · R3A I1 «callers» y I3 «escritores de stockCantidad» (F4-A/F4-B escriben stock directo; ya fallaban en `HEAD`) |
| `tsc` / ESLint / `git diff --check` | 41 = línea base / limpio / limpio |

Cobertura de integración: borradores sin efectos; cajero prepara/edita/envía/descarta sólo lo suyo y no aprueba ni
rechaza; aprobación con stock, costos congelados, último costo, una obligación y auditoría; productos sin control de stock
y con variante; parcial contra pedido con dañados; excedente con confirmación; dos recepciones del mismo pedido aprobadas
en simultáneo (nunca superan lo pendiente sin confirmar); doble clic y replays (una entrada, una deuda); dos aprobaciones
concurrentes con claves distintas; versión vista; fallo de auditoría con rollback total; caso completo de costos (al
centavo) e impuestos recuperables; diferencia de costo; último costo en orden real (una recepción atrasada no lo pisa);
comprobante repetido; pedidos cerrados/anulados; anticipo aplicado y pago parcial; anticipo de otro proveedor revierte
todo; aislamiento entre negocios; guardas SQL (entrada fuera de aprobación, segunda obligación, cargo duplicado);
historia conservada al borrar un producto.

`deligo_dev`: respaldo `deligo_dev_pre-c2a_20261119-195227.dump`, sólo la migración C2a, conteos idénticos (56 → 57),
respaldo posterior `deligo_dev_post-c2a_20261119-195237.dump`.

### 13.6 Riesgos y casos no cubiertos

- Cargos que llegan **después** de aprobada la recepción (§6.3) y correcciones de cantidad/costo posteriores: hoy se
  corrigen con `AJUSTE_DEUDA` (deuda) y no reabren costos; la distribución posterior y las devoluciones son F10-C2c.
- Proveedor nuevo propuesto por el cajero: no implementado (el cajero elige uno existente); queda para C2b.
- El umbral de diferencia de costo es fijo (20 %); no configurable.
- Cantidades decimales en productos por unidad: se aceptan (el stock es `Float`); C2b debería limitar por unidad de medida.
- Pagos en efectivo hechos al recibir: siguen siendo un egreso `PAGO_PROVEEDOR` de F10-C1 que el dueño vincula y asigna;
  el vínculo automático desde la recepción (D-7) es C2b.
- Producción: sin habilitar (F10-D1 obligatorio). Sin prueba en dispositivos.

### 13.7 Qué necesita F10-C2b

Pantalla del cajero «Recibir mercadería» sobre las rutas operativas existentes: elegir proveedor y (opcional) pedido
abierto (`recepciones-datos`), buscar/escanear productos con el selector de Caja (variante obligatoria cuando existe),
cargar recibido / aceptado / rechazado con motivo, costo, descuento e IVA, comprobante, cargos; guardar con
Idempotency-Key y `version`; enviar; ver el estado y el motivo de devolución. Del lado del dueño: bandeja de recepciones
pendientes, vista previa (costos, deuda, excedentes, diferencias, anticipos disponibles) con confirmaciones explícitas,
aprobar / rechazar / devolver, detalle e historial; pedidos (alta, avance, cierre/anulación) y la configuración de
impuestos. Pendientes de producto: proveedor nuevo propuesto por el cajero, pago en efectivo vinculado al recibir (D-7),
pautas móviles de F10-C1.


## 14. Centralización R3A de F4 + F10-C2b (interfaces) + D-7 — implementación local (2026-11-19)

`R3A_F4_CENTRALIZATION=IMPLEMENTED_LOCAL_TESTS_PASS` · `F10_C2B_STATUS=IMPLEMENTED_LOCAL_TESTS_PASS_BROWSER_REVIEWED` ·
`NOT_COMMITTED · NOT_DEPLOYED` · sin migración nueva · F5-A y F10-C2a aceptados por el operador en local. TESTING,
Production y `paola-vinal` sin tocar; `deligo_dev` sin reset ni seed (C2b no necesitó migración).

### 14.1 ETAPA 1 — R3A: un solo escritor de stock

Escritores de `stockCantidad` fuera de R3A encontrados: **dos**, ambos de F4 (ya fallaban en `HEAD` los contratos
`p2-t56-r3a-i1` «callers» e `i2` «escritores»):

| Servicio | Antes | Ahora |
|---|---|---|
| `caja-devoluciones-service.ts` (anulación y devolución) | leía disponibilidad, calculaba `resolveNextStock` y escribía stock + `movimientoInventario` directamente | `reingresarStockDevolucionVenta` (R3A): un movimiento `DEVOLUCION` con `ventaId`; resultados `REINGRESADO` / `SIN_CONTROL_STOCK` / `PRODUCTO_NO_DISPONIBLE` |
| `caja-correcciones-service.ts` (corrección de venta) | `stockKey` de `stock-authority` + `resolveNextStock` + escrituras directas | `planificarStockCorreccionVenta` (agrega por clave de stock y valida cada SALIDA contra lo disponible, **antes** de crear la corrección; mismos mensajes y `STOCK_INSUFICIENTE`) + `registrarStockCorreccionVenta` (`CORRECCION_ENTRADA` / `CORRECCION_SALIDA`) |

Sin rediseño: mismas transacciones, mismos candados, misma idempotencia, mismas auditorías y mismos importes. **No cambia
ningún comportamiento financiero de F4** ni se reabren sus certificaciones; los tipos de movimiento son literalmente las
constantes de F4. Las funciones nuevas no tocan reservas ni leen el modo de stock.

Pruebas nuevas: `r3a-f4-autoridad.integration.test.ts` (5: ciclo completo recepción → venta → corrección → devolución →
anulación con cadena íntegra; corrección sin stock; **doble devolución concurrente** cajero + dueño = un solo reingreso;
devolución + venta + corrección + recepción concurrentes; doble clic de aprobación mezclado con ventas = **un solo
ingreso**) y `r3a-f4-autoridad-static-contract.test.ts` (3). Contratos R3A estáticos: **97/97** (los dos que fallaban
ahora pasan sin tocar los tests ni agregar excepciones).

LF/CRLF (tratado aparte): Prisma tolera CRLF/LF de migraciones aplicadas; `.gitattributes`
(`prisma/migrations/**/*.sql text eol=lf`); ninguna migración histórica ni checksum modificado. Siguen fallando **sólo en
la copia Windows** los chequeos de bytes LF de F10-B2.0 y F10-B2.1 (CRLF del checkout local; en CI con checkout LF pasan).

### 14.2 ETAPA 2 — Cajero: «Recibir mercadería»

Botón «Recibir mercadería» en la cabecera de Caja → `/operaciones/mi-panel/[slug]/recepciones` (sólo rutas
`/api/operativo/caja/[slug]/…`). Grupos «Para completar o enviar», «Enviadas al dueño», «Cerradas».

Editor compartido `recepcion-editor.tsx`: proveedor existente y pedido abierto (precarga lo pendiente); búsqueda con el
buscador de Caja y escáner (`BarcodeScanner` continuo) reutilizados; variante obligatoria; recibido / aceptado /
rechazado con motivo obligatorio; costo, descuento, IVA, comprobante y cargos; **enteros para unidades, decimales sólo
para `kg`, `g`, `litro`, `ml`, `metro`** (también en el servidor: `400 CANTIDAD_ENTERA_REQUERIDA` en recepciones y
pedidos); guardar borrador, retomar, enviar; ve si fue devuelta o rechazada y el motivo. Robustez: botón bloqueado
mientras envía, Idempotency-Key estable por contenido (se conserva ante red/5xx), PUT con `version`, borrador local de
respaldo (recuperable tras un fallo de red). Privacidad: el detalle para el cajero no incluye `totalesAprobacion` (se
quitó en el servidor); nunca ve saldos, anticipos, deuda ni efectivo esperado (contrato estático).

Servidor (aditivo, sin migración): `catalogoRecepcion` sin precios ni costos (`GET /api/negocio/compras/catalogo` y
`recepciones-datos?catalogo=1`), nombres de quien preparó / actores del historial, `ultimaObservacion`, `unidadMedida`.

### 14.3 ETAPA 2 — Dueño: Caja → Compras

Subpestaña «Compras (n)» con pestañas Por aprobar / Recepciones / Pedidos / Impuestos. Bandeja con contador y prioridad
(> 24 h media, > 48 h alta). Revisión: vista previa completa (productos, costos, descuentos, impuestos, cargos, deuda),
avisos de excedente, diferencia de costo > 20 % y comprobante repetido (los problemas bloquean), confirmaciones
explícitas, **confirmación obligatoria de importes**, aprobar (envía la versión vista), rechazar o devolver con motivo,
historial con quién preparó y quién aprobó; tras aprobar, «Ver cuenta del proveedor» (F5, sin duplicar deuda). Pedidos
(alta con enteros por unidad, detalle con avance, cierre / anulación con motivo) y configuración de impuestos.

### 14.4 ETAPA 3 — D-7: pago en efectivo al recibir (sin extender la API)

- La recepción **nunca** mueve dinero.
- El pago real es la salida `PAGO_PROVEEDOR` de F10-C1 (`POST /api/operativo/caja/[slug]/egresos`): turno propio
  abierto, confirmación explícita, permisos e Idempotency-Key; referencia exacta `Recepción N° X` (opcionalmente
  `· comprobante`). No exige que la recepción esté aprobada.
- El dueño lo encuentra en `pagos-caja-sin-vincular` por la referencia exacta (`esReferenciaDeRecepcion`: N° 12 no
  coincide con N° 120) y lo vincula por F5 (`creditos/caja`, sin movimiento financiero); al aprobar lo aplica como anticipo.
- Si la recepción se rechaza, el pago queda registrado y sin vincular; nunca se anula ni se compensa automáticamente.
- Dependencia documentada: el vínculo automático (recepcionId en el egreso) requeriría extender la API de F10-C1; no se
  hizo. Hoy el vínculo es manual del dueño.

### 14.5 ETAPA 4 — Pruebas y revisión visual

| Suite | Resultado (`deligo_ci`) |
|---|---|
| R3A-F4 integración / estático | 5/5 · 3/3 |
| C2a integración (incluye unidades y D-7) | 18/18 |
| C2a puras + estático · C2b estático · C2b interfaz | 13/13 · 5/5 · 7/7 |
| F5-A integración / puras / panel | 25/25 · 12/12 · 10/10 |
| F10-C1: C1a / C1a-R1 / C1c / contratos / salidas cajero / egresos dueño / página cajero / `caja-tab` | 21 · 6 · 12 · 25 · 17 · 11 · 6 · 7 (todo PASS) |
| R3A ciclo de vida 201/201 · contratos R3A 97/97 · movimientos de inventario 13 + 19 | PASS |
| F4: unitarias 38 · F4-A 9 · F4-B 10 · C1 6 · C3 14 · C4 3 · reintegro concurrente 5 · medio 8 · auditoría 6 | PASS |
| F10-B2.1 turnos 44/44 | PASS |
| Fallas **preexistentes, sólo locales** | F10-B2.0 y F10-B2.1 «bytes LF» (CRLF de la copia Windows) · `f10-b1` contrato de la ruta de venta (texto ya presente en `HEAD`, ruta no tocada) |
| `tsc` / ESLint / `git diff --check` | 34 errores, todos en `.next/dev/types/routes.d.ts` generado (0 en código fuente; línea base 41) / limpio / limpio |

Navegador (QA local `deligo_qa_auto`, :3001, credenciales ficticias sólo en localhost): pedido N° 1 (decimal rechazado);
cajero con turno abierto prepara la recepción N° 1 contra el pedido (parcial: 8 aceptadas + 2 `DANADO`, producto no
pedido, comprobante), motivo exigido, paga $3.000 en efectivo y envía; el dueño ve «Compras (1)», revisa (excedente,
costo unitario $629,20, deuda $5.759,60), vincula el pago, lo aplica como anticipo, confirma importes y aprueba; cuenta
del proveedor y costos correctos; la vista cerrada del cajero no muestra deuda, saldo ni anticipo. Sin desbordes ni
controles tapados por el botón de chat o el aviso de instalación en escritorio, 320, 375, 412 y 768 px (se subió la
reserva inferior a `max(9.5rem, aviso + 1rem)`). Sin errores de servidor; los 401 de consola son de
`/api/notificaciones?feed=cuenta` y `/api/destacado-solicitud` (preexistentes, ajenos a C2b).

### 14.6 Riesgos y pendientes

- Proveedor nuevo propuesto por el cajero: no implementado (elige uno existente).
- Cargos tardíos, correcciones posteriores y devoluciones al proveedor: F10-C2c (no autorizado).
- Umbral de diferencia de costo fijo (20 %).
- D-7: vínculo manual por referencia exacta (sin extensión de API).
- Copias CRLF en Windows: no commitear `next-env.d.ts` ni `tsconfig.tsbuildinfo`; verificar LF en un checkout limpio.
- Sin prueba en dispositivos físicos. Production bloqueado (F10-D1 obligatorio).

### 14.7 Qué falta para una integración controlada de F5-A + C2a + C2b en Railway TESTING

1. Autorización explícita del operador (commit en rama técnica + CI; luego push a `testing-codex` y despliegue).
2. Commit por archivos exactos (sin `next-env.d.ts`, `tsconfig.tsbuildinfo`, `.next-*`), CI con PostgreSQL efímero y
   checkout LF (debe resolver las fallas «LF» locales); revisar `f10-b1` sale-route en CI.
3. Respaldo de la base TESTING antes del despliegue; 2 migraciones aditivas (F5-A, C2a) + `.gitattributes`.
4. Verificación SQL posterior y batería QA en `paola-vinal` bajo control del operador (runner equivalente al de F10-C3,
   ampliado a proveedores, recepciones y D-7), más chequeo en dispositivos físicos.
5. Production sigue bloqueado: F10-D1 obligatorio antes de habilitar egresos/compras a negocios reales.

## 15. Ajustes de C2b, D-7 v2, pedidos con total, precios de venta, cierre con pendientes, etiquetas y precios por inicio de venta — implementación local (2026-11-20)

`F10_C2B_IMPROVEMENTS=IMPLEMENTED_LOCAL` · `D7_V2=IMPLEMENTED_LOCAL_MANUAL_TEST_PENDING` ·
`ORDER_REPORTED_TOTAL=IMPLEMENTED_LOCAL_MANUAL_TEST_PENDING` · `SALE_PRICE_UPDATE=VALIDATED_MANUALLY_LOCAL_DEV` ·
`ORDER_CLOSE_WITH_PENDING=IMPLEMENTED_LOCAL_CLOSE_VERIFIED_READONLY` · `SHELF_LABELS=VALIDATED_MANUALLY_LOCAL_DEV` ·
`SALE_START_PRICE_PROTECTION=VALIDATED_MANUALLY_LOCAL_DEV` · `NOT_COMMITTED · NOT_DEPLOYED` · TESTING, Production y
`paola-vinal` sin tocar · `deligo_dev` sin reset ni seed.

Metodología vigente desde 2026-11-19 (`CLAUDE.md`, «Metodología de trabajo vigente»): implementación con revisión técnica
breve, recorrido en navegador local y **prueba manual del operador**, verificada por Claude con consultas de SOLO LECTURA.
«VALIDADO MANUALMENTE EN DESARROLLO LOCAL» significa exactamente eso: el operador hizo el recorrido en
`http://localhost:3000` sobre `deligo_dev` y Claude confirmó los registros. **No es una certificación en Railway TESTING
ni autoriza Production.**

### 15.1 Migraciones (todas aditivas; respaldo de `deligo_dev` antes de cada una)

| Migración | Agrega | Respaldo previo (`C:\Users\eltig\deligo-dev-db\respaldos\`) |
|---|---|---|
| `20261120120000_f5_supplier_products` | `proveedor_productos` (productos/variantes que entrega cada proveedor, N:M) | `deligo_dev_pre-proveedor-productos_20261120-011557.dump` |
| `20261120150000_c2b_reception_payments` | `pagos_recepcion` + guarda (pago de Caja ligado estructuralmente a la recepción) | `deligo_dev_pre-pagos-recepcion_20261120-015148.dump` |
| `20261120180000_c2b_order_reported_total` | `compras.totalInformadoDecimal` / `totalInformadoIva` + CHECK + inmutabilidad | `deligo_dev_pre-total-pedido_20261120-020851.dump` |
| `20261120210000_c2b_sale_price_updates` | `cambios_precio_venta` (historial append-only) | `deligo_dev_pre-precios-venta_20261120-021900.dump` |
| `20261120230000_c2b_order_close_snapshot` | `eventos_compra_recepcion.detalle` (foto de pendientes al cerrar; sólo `CIERRE_COMPRA`) | `deligo_dev_pre-cierre-pedido_20261120-031647.dump` |
| `20261121090000_c2c_price_labels_sale_start` | `etiquetas_precio`, `activaciones_precio_venta`, `inicios_venta` + guardas | `deligo_dev_pre-etiquetas-precio_20261120-151701.dump` |
| `20261121093000_c2c_price_history_product_cascade` | las guardas «nunca se borra» de los historiales de precio admiten también la cascada del producto | `deligo_dev_pre-guardas-cascada_20261120-152307.dump` |

Aplicadas en `deligo_dev`. No se verificó en esta etapa su aplicación en `deligo_ci` ni en `deligo_qa_auto`.

### 15.2 Qué se implementó

1. **Cinco mejoras de la prueba de compras:**
   - «Costo acordado» = costo unitario sin IVA, con subtotales y total del pedido.
   - Productos por proveedor (N:M, `proveedor_productos`; búsqueda del cajero empieza por los del proveedor; se suman al aprobar).
   - «Pedidos por recibir» del cajero (avance por producto, «Recibir lo que falta»).
   - Botón «Enviar recepción».
   - Envío repetido. Causa del 404: índice de rutas viejo del servidor de desarrollo. Además: guardas `RECEPCION_NO_ENVIADA` / `BORRADOR_EXISTENTE` y conciliación del cliente.
2. **D-7 v2 — pago en efectivo desde la recepción:**
   - El egreso F10-C1 y su vínculo `pagos_recepcion` se escriben en la misma transacción (`vincularPagoCajaEnTx`).
   - Al aprobar se aplica solo a la deuda de esa recepción, hasta lo adeudado; el excedente queda como anticipo.
   - «Observar» para casos dudosos; la asignación manual queda sólo para casos especiales.
   - El dinero sale una sola vez.
3. **Pedidos con total informado (modalidad B):**
   - Total del pedido + tratamiento de IVA; costos unitarios al recibir.
   - Comparación del acumulado facturado contra el total; confirmación explícita si se excede (`confirmoTotalPedido`).
   - La modalidad A no cambia.
4. **Precio de venta opcional al aprobar:**
   - Propuesta que conserva el recargo sobre el costo: `costoNuevo × precioActual / costoAnterior`, Decimal, ROUND_HALF_UP al centavo.
   - Casos sin propuesta: sin costo anterior, precio bajo costo, sin precio, costo igual, recepción más reciente.
   - Sólo se aplica lo elegido; nunca toca promociones ni ventas hechas.
5. **«Llegó mercadería sin pedido» abre vacía.**
   - Causa: un respaldo local del navegador con la clave «nueva» que contenía el pedido N° 1, y la recuperación no validaba el modo.
   - Corrección: `borradorLocalCorresponde`, modo `sinPedido`, «Descartar lo recuperado», «Cerrar» descarta el respaldo.
   - El servidor nunca asignó un pedido: `compraId` NULL.
6. **Cerrar pedido con pendientes (dueño):**
   - Motivos tipificados, detalle, confirmación explícita y foto pedido / aceptado / pendiente en `evento.detalle`.
   - Bloqueado con recepciones en borrador o por aprobar; idempotente.
   - Estado «Cerrado con pendientes»; sale de «Pedidos por recibir» (filtro «Completados o cerrados»).
   - Sin movimientos de stock ni dinero.
7. **Etiquetas de góndola:**
   - Lo autorizado al aprobar queda `PENDIENTE` y se sigue cobrando el precio anterior.
   - El empleado (área Caja) o el dueño confirma la etiqueta → `ACTIVADA` + `activaciones_precio_venta`.
   - Sólo el dueño activa sin etiqueta (productos sin etiqueta física / sólo online, también elegible al aprobar) o descarta.
   - Una autorización más nueva o una edición desde el catálogo deja la anterior `REEMPLAZADA`.
   - Lista con búsqueda, filtro pendientes / completadas, conteo y confirmación por lote.
   - Dueño: Caja → Etiquetas. Cajero: `/operaciones/mi-panel/[slug]/etiquetas`.
8. **Precios protegidos por inicio de venta:**
   - El servidor registra `inicios_venta` al agregar el primer producto.
   - Al cobrar, cada producto vale lo vigente al inicio: el `precioAnterior` de la primera activación posterior al inicio, sin copiar el catálogo.
   - Un solo uso; vence a los 30 minutos (la base limita a 2 h).
   - El cliente envía sólo el id y el total mostrado; si no coincide → 409 `PRECIOS_CAMBIARON` sin escribir nada.
   - Las ediciones de precio del catálogo también quedan como activación.

### 15.3 Estado por funcionalidad — implementado / comprobado manualmente / pendiente

| Funcionalidad | Implementado | Comprobado manualmente (evidencia en `deligo_dev`, solo lectura) | Pendiente de certificar |
|---|---|---|---|
| Pedidos y recepciones con pedido | Sí (C2a + C2b + mejoras 15.2-1) | **Usado por el operador**, sin informe formal de validación del circuito completo. Pedido N° 1 → recepción N° 1 (parcial con dañado) aprobada; pedido N° 3 → recepción N° 3 aprobada. Una obligación por recepción; un movimiento de stock por renglón controlado. | Validación formal del circuito; **recepción N° 2** (pedido N° 2) sigue en `PENDIENTE_APROBACION` con pagos de $2.000 y $600 **sin revisar**; TESTING |
| Recepciones sin pedido | Sí | **VALIDADO MANUALMENTE EN DESARROLLO LOCAL.** Recepción N° 4: 4 productos, costos, Yerba +2 (45 → 47), deuda $2.970, sin duplicados. Recepciones N° 5 y N° 6 también con `compraId` NULL. «Sin pedido» abre vacía. | TESTING |
| Cierre de pedidos con pendientes | Sí | **Cierre ejecutado por el operador y verificado en lectura.** Pedido N° 1 `CERRADA_CON_FALTANTE` (2026-11-20 17:54:05), motivo «El proveedor no reemplazará la mercadería dañada», foto 10 / 9 / 1, auditoría `compra.cerrada`, sin movimientos. | Confirmación explícita del operador de la vista del cajero (desaparece de «Pedidos por recibir»); TESTING |
| Asociación de pagos a recepciones (D-7 v2) | Sí | **No validado.** Hay un uso: recepción N° 3, pago `CAJERO_AL_RECIBIR` $200 `ACREDITADO` y aplicado. | **Prueba manual pendiente (próxima)**; revisión de los pagos de $2.000 y $600 de la recepción N° 2; TESTING |
| Pedidos con total informado (modalidad B) | Sí | **No probado**: ningún pedido de `deligo_dev` tiene total informado. | **Prueba manual pendiente (próxima)**; TESTING |
| Actualización de costos y precios de venta | Sí | **VALIDADO MANUALMENTE EN DESARROLLO LOCAL.** Recepción N° 4: Yerba 3.200 → 3.764,71 (recargo 189,59 %), los otros tres productos sin cambio de precio, costos nuevos. Recepciones N° 5 / N° 6: Taza 100 → 302,50 → 375 (recargo 25 %). | TESTING |
| Etiquetas de góndola | Sí | **VALIDADO MANUALMENTE EN DESARROLLO LOCAL** (15.4) | TESTING; dispositivos físicos |
| Protección de precios durante ventas iniciadas | Sí | **VALIDADO MANUALMENTE EN DESARROLLO LOCAL** (15.4) | TESTING; dispositivos físicos |

### 15.4 Verificación final de etiquetas y protección de precios (2026-11-20, solo lectura)

- **Recepción N° 6** (`cmwpd71jr0017ri9kznxrfo2c`):
  - Sin pedido; preparada y enviada por el cajero `sxn1-e1` (19:21:02 / 19:21:03); aprobada por el dueño 19:21:31,545.
  - 1 Taza a $300, IVA 0 %; costo de inventario $300 y costo vigente $300.
  - Una obligación de $300 (`VIGENTE`); sin pagos, asignaciones, créditos ni egresos; Taza no controla stock (sin movimiento).
- **Precio autorizado:**
  - `cambios_precio_venta` 302,50 → **375,00** (costo 242 → 300, recargo 25 %), autorizado por el dueño (`NEGOCIO`, `sxn1`).
  - Auditoría de la aprobación: `modo=ETIQUETA`, `estado=PENDIENTE_ETIQUETA`.
- **Etiqueta** `cmwpd7npb001lri9kwjuj7yyl`:
  - Creada 19:21:31,545 (`PENDIENTE`).
  - Confirmada 19:21:53,929 por **Cajero sintetico 1 (`sxn1-e1`)**: `ACTIVADA` / `ETIQUETA_CONFIRMADA`.
  - Auditoría `precio_venta.etiqueta_confirmada` con `activacionId`.
- **Activación** `cmwpd84yc001rri9kc45vjgju`: 302,50 → 375,00, origen `ETIQUETA`, 19:21:53,929. Catálogo: Taza **$375**, costo $300.
- **Venta protegida** `cmwpd8syq001xri9kn80elpj3`:
  - Inicio `cmwpd6ef90015ri9kq3157bjd` a las **19:20:32,899**, antes de la aprobación y de la activación.
  - Cobrada a las **19:22:25,058**, después de la activación: Remera $100 + **Taza $302,50** = $402,50, efectivo.
  - Un cobro y una operación financiera; inicio usado y ligado a esa venta; la auditoría `venta.creada` incluye `inicioVentaId`.
  - La base no registra en qué momento se agregó Taza al carrito; el operador informa que la agregó después de la activación.
- **Venta nueva:** el dueño la abrió (inicio `NEGOCIO` 19:22:11) y vio Taza a $375; no la cobró. Ese inicio quedó sin usar y vence solo.
- **Duplicados: ninguno.**
  - Un cambio de precio por recepción y producto; una etiqueta por cambio; una activación por etiqueta; 0 etiquetas pendientes.
  - Una obligación por recepción; un cobro y una operación por venta.
  - Sin pagos, asignaciones, créditos, egresos ni movimientos de stock desde 19:00.
- **Prueba previa (recepción N° 5):** Taza 100 → 302,50, confirmada 19:15:37. La venta `cmwpczpce000qri9k43gth9vj` (Remera + Taza a $100, 19:15:20) se cobró **antes** de esa activación, así que no demuestra la protección.

### 15.5 Revisión técnica (sin baterías nuevas)

- `tsc` 41 errores = línea base, ninguno en lo tocado (corrido con el servidor de desarrollo activo). ESLint limpio en todos los archivos tocados.
- Pruebas existentes directamente afectadas: 57/57 (Caja: checkout idempotente, escáner, página del cajero; recepciones C2b; contrato estático C2b; origen F10-B2.0; venta F10-B0). Ninguna eliminada ni debilitada.
- Verificación focalizada de una sola vez, dentro de una transacción revertida: inicio de venta (precio al inicio, uso único, vencido, ajeno, total desactualizado) y guardas de etiquetas. 15/15 OK; quedaron 0 filas. El script no quedó en el repositorio.

### 15.6 Riesgos y pendientes reales

- **Pruebas manuales pendientes:** pagos asociados a la recepción (D-7 v2) y pedidos con total informado (modalidad B).
- **Recepción N° 2:** pagos de $2.000 y $600 sin revisar; no aprobarla hasta revisarlos.
- **Cierre de pedidos:** falta la confirmación explícita del operador de la vista del cajero.
- **Carrito de Caja:** vive en la pestaña; navegar fuera de Caja en la misma pestaña termina la venta (comportamiento previo). El inicio vence a los 30 minutos.
- **Promociones:** Caja sigue sin aplicar descuentos. Activar un precio por etiqueta no recalcula la tabla `promociones` (requisito: no modificar promociones).
- **Fuera de Caja:** cambios comerciales F4-C y ventas adicionales cobran el precio actual (sin inicio de venta).
- **Sin commits ni despliegues:** migraciones sólo en `deligo_dev`; sin CI, TESTING, dispositivos físicos ni Production (F10-D1 obligatorio antes de compras/egresos en Production).
- **Documentación:** `CURRENT_TASK.md` no se reescribió en esta etapa.

### 15.7 Próximo paso

Pruebas manuales del operador de **pagos asociados a la recepción (D-7 v2)** y de **pedidos con total informado**, con
verificación de solo lectura de Claude. Después, decisión del operador sobre commit + CI en rama técnica e integración
controlada en Railway TESTING (respaldo, 7 migraciones nuevas además de F5-A y C2a, verificación SQL y QA en
`paola-vinal`).
