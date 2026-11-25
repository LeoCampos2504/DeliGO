# F10-C2 + F5 (alcance mínimo) — Compras, recepción de mercadería y proveedores · PROPUESTA DE DISEÑO

Estado: `F10_C2_F5_STATUS=DESIGN_PROPOSED_NOT_APPROVED` · sin implementación, sin migraciones, sin commits ni despliegues.
Fecha: 2026-11-19. Base analizada: `testing-codex` `bfaba2a` (F10-C1 `CLOSED_TESTING_CERTIFIED`, sin autorización de
Production). Este documento no reabre F10-C1 ni modifica sus reglas; sólo define cómo se le conectan F10-C2 y F5.

---

## 0. Resumen ejecutivo

- **Un solo circuito, cuatro dueños de la verdad:**
  - **F10-C1** es la única fuente del **efectivo que sale de Caja** (ya certificado). F5 no copia esos pagos: los referencia.
  - **F10-C2** es la única fuente de la **mercadería que entra** (recepción → stock por la autoridad R3A + costo real).
  - **F5** es la única fuente de la **deuda con el proveedor** (ficha del proveedor, cuenta corriente append-only,
    aplicación de pagos a compras).
  - **F10-D/E** concilia cuentas, transferencias y errores posteriores al cierre (no se implementa acá).
- **La deuda nace de lo recibido y aprobado**, no del pedido: «debo lo que entró».
- **Nada confirmado se edita**: toda corrección es un documento o movimiento nuevo (devolución, ajuste, reversión).
- **Para el cajero, un solo trámite**: «Recibir mercadería» (escanear, cantidades, mercadería dañada, número del
  comprobante) y, si pagó en el momento, el pago en efectivo que ya existe en F10-C1, enlazado a esa recepción.
- **Para el dueño, una bandeja**: aprobar recepciones (stock + costo + deuda en un paso), ver saldos por proveedor
  y asignar pagos.

---

## 1. Lo que existe hoy (análisis del código)

| Pieza | Estado actual | Consecuencia para el diseño |
|---|---|---|
| `Producto` / `ProductoVariante` | `costo Float?` (un solo valor, sin historia), `stockCantidad Float`, `controlStock` | El costo histórico real tiene que vivir en las líneas de recepción; `costo` queda como «último costo» de referencia |
| `MovimientoInventario` | `tipo` ENTRADA · SALIDA · AJUSTE · VENTA · PEDIDO · DEVOLUCION · CORRECCION_*; sin costo; referencias a venta / corrección / pedido | Se agregan tipos y referencias de recepción y devolución al proveedor (columnas nuevas, aditivas) |
| Autoridad de stock R3A (`src/lib/stock-lifecycle.ts`) | `runStockSerializable` + `planificarMovimientoManual` / `registrarMovimientoManual`; contrato estático: **sólo la autoridad escribe `stockCantidad`** | La recepción NO escribe stock: llama a una función nueva de la misma autoridad (ENTRADA siempre permitida; SALIDA respeta reservas ACTIVA) |
| Movimientos manuales de inventario | Sólo el dueño; sin Idempotency-Key ni auditoría transaccional | La recepción agrega idempotencia y auditoría R1 (no se toca el flujo manual existente) |
| Áreas operativas | `mozo`, `salon`, `pyr`, `caja` | El cajero (área `caja`) puede preparar recepciones; un área «depósito» queda como opción (D-12) |
| Libro financiero | Cuentas sólo `EFECTIVO` por caja; transferencias de venta = `CobroVenta` declarado, sin pata | Un pago por transferencia al proveedor hoy no tiene cuenta: se registra como **pago declarado** hasta F10-D (D-6) |
| F10-C1 `EgresoCaja` `PAGO_PROVEEDOR` | Proveedor en texto libre; la fila es **inmutable** por trigger SQL | El vínculo con el proveedor y la compra va en una tabla de F5 (la fila del egreso nunca se toca) |
| Almacenamiento privado | `src/lib/private-evidence-storage.ts` (Cloudinary `authenticated`, descarga firmada de 60 s) | Reutilizable para fotos de comprobantes si se aprueba (decisión #12) |

---

## 2. Separación de responsabilidades

| Módulo | Es dueño de | Lee (sin duplicar) | Nunca hace |
|---|---|---|---|
| **F10-C1** (certificado) | Salidas de efectivo de Caja: gasto, **pago a proveedor**, retiro; compensación con turno abierto | — | Saber qué compra paga; mover stock |
| **F10-C2** | Recepción física: líneas recibidas / aceptadas / rechazadas, costo real por unidad, ingreso de stock **por la autoridad R3A**, devoluciones físicas al proveedor | Productos/variantes, compras de F5 | Registrar dinero; calcular deuda por su cuenta |
| **F5** (mínimo) | Proveedores, compras (documento), **cuenta corriente del proveedor** (deuda, notas de crédito, pagos aplicados), pagos declarados no-Caja, aplicación de pagos a compras | Recepciones aprobadas (C2), egresos `PAGO_PROVEEDOR` (C1) | Mover efectivo; mover stock |
| **F10-D/E** (futuro) | Cuentas no-efectivo, conciliación (transferencias / Mercado Pago), corrección de egresos posterior al cierre, transferencias entre cuentas propias | Todo lo anterior | — |

**Regla anti-paralelismo:** cada hecho se registra una sola vez y en un solo lugar. Una recepción aprobada genera, en la
**misma transacción**, su movimiento de stock (C2), sus costos (C2) y su asiento de deuda (F5). Un pago en efectivo es
el egreso de C1 y F5 sólo lo *referencia*.

---

## 3. Modelo de datos propuesto (todo aditivo, por negocio, montos `Decimal`)

Convenciones heredadas de F10-C1: `negocioId` en todas las filas; FKs compuestas `(id, negocioId)`; dinero en
`Decimal(12,2)`; costo unitario en `Decimal(14,4)`; cantidades en `Decimal(14,3)` (admiten kg/litro, se convierten al
`Float` de stock sólo dentro de la autoridad); `Idempotency-Key` + huella por acción; filas confirmadas inmutables
por trigger; auditoría R1 en la misma transacción.

### 3.1 F5 — proveedores y deuda

| Tabla | Campos clave | Reglas |
|---|---|---|
| `proveedores` | nombre, nombreNormalizado, cuit?, telefono?, email?, notas?, activo, creadoPor | Único por negocio: `cuit` (si existe) y `nombreNormalizado`; nunca se borra (sólo `activo=false`) |
| `compras` | proveedorId, numero (secuencial por negocio), origen `PEDIDO`/`DIRECTA`, estado, notas, creadoPor, fecha | Documento comercial; no mueve dinero ni stock |
| `compra_lineas` | compraId, productoId, productoVarianteId?, cantidadPedida, costoUnitarioAcordado? | Sólo para compras `PEDIDO`; la recepción las va cumpliendo |
| `cuenta_proveedor_movimientos` | proveedorId, tipo, importe (con signo: deuda `+`, pago/crédito `−`), compraId?, recepcionId?, egresoCajaId? (único), pagoDeclaradoId? (único), devolucionId?, revierteId? (único), motivo, actor, idempotencia | **Append-only**; saldo del proveedor = suma; una corrección es otra fila (nunca un UPDATE) |
| `pagos_declarados_proveedor` | proveedorId, medio `TRANSFERENCIA`/`MERCADO_PAGO`/`OTRO`, importe, fecha, referencia, estado `DECLARADO` (F10-D: `VERIFICADO`/`OBSERVADO`) | Pago que NO salió de Caja; sin pata en el libro hasta F10-D (mismo criterio que el cobro por transferencia declarado) |
| `aplicaciones_pago` | movimientoPagoId, compraId, importe | Reparte un pago entre compras; suma ≤ pago; lo no aplicado es **anticipo / saldo a favor**; se revierte con una fila de reversión |

Tipos de `cuenta_proveedor_movimientos`: `DEUDA_RECEPCION` · `CARGO_COMPRA` (flete u otros cargos) ·
`AJUSTE_DEUDA` (dueño, con motivo) · `NOTA_CREDITO_DEVOLUCION` · `PAGO_CAJA` (referencia a un egreso de C1) ·
`PAGO_DECLARADO` · `REVERSION` (anula exactamente una fila anterior, una sola vez).

### 3.2 F10-C2 — recepción y stock

| Tabla | Campos clave | Reglas |
|---|---|---|
| `recepciones` | compraId, proveedorId, estado, preparadaPor (actor), enviadaEn, aprobadaPor/En, rechazadaPor/En + motivo, comprobante (tipo, número, fecha), version | Una recepción = una entrega física |
| `recepcion_lineas` | recepcionId, compraLineaId?, productoId, productoVarianteId?, cantidadRecibida, cantidadAceptada, cantidadRechazada, motivoRechazo?, costoUnitario, movimientoInventarioId? (único) | `aceptada + rechazada = recibida`; sólo la aceptada entra al stock y a la deuda |
| `devoluciones_proveedor` (+ líneas) | recepcionId?, proveedorId, estado, motivo, cantidades, costoUnitario (el de la recepción) | Salida física por la autoridad (respeta reservas) + nota de crédito en F5 |
| `movimientos_inventario` (existente) | **+** `recepcionLineaId` (único), `devolucionProveedorLineaId` (único); tipos nuevos `RECEPCION`, `DEVOLUCION_PROVEEDOR` | Un movimiento por línea aceptada, imposible de duplicar por índice único |

Estados:

```text
Compra (PEDIDO):  BORRADOR → CONFIRMADA → PARCIALMENTE_RECIBIDA → RECIBIDA
                                         ↘ CERRADA_CON_FALTANTE (el dueño cierra el resto)   · ANULADA (sólo sin recepciones aprobadas)
Compra (DIRECTA): se crea junto con su primera recepción (el cajero no ve «compras»)
Recepción:        BORRADOR → PENDIENTE_APROBACION → APROBADA   (stock + costo + deuda, atómico)
                                                  ↘ RECHAZADA  (nada se mueve; queda en el historial)
                  BORRADOR → DESCARTADA (antes de enviarla)
Devolución:       BORRADOR → APROBADA (stock sale + nota de crédito) · RECHAZADA
```

El estado «recibido» del pedido del operador corresponde a `APROBADA` en la recepción y a `RECIBIDA` /
`PARCIALMENTE_RECIBIDA` en la compra.

---

## 4. Flujos

### 4.1 Recepción con pago en el momento (el caso más común)

1. **Cajero** (Operaciones → «Recibir mercadería»): elige el proveedor (o escribe un nombre nuevo, que el dueño
   confirma), escanea o busca productos (mismo selector de Caja), carga cantidades, marca unidades dañadas, carga el
   costo por unidad del comprobante y su número, y envía → `PENDIENTE_APROBACION`. No ve saldos ni deudas.
2. Si pagó en efectivo: en la misma pantalla «¿Pagaste al proveedor?» abre el **pago a proveedor de F10-C1** (mismo
   motor certificado, su turno abierto) con el proveedor y la recepción ya elegidos. El egreso queda vinculado
   (D-7).
3. **Dueño** (bandeja «Recepciones por aprobar»): revisa líneas, diferencias de cantidad y de costo resaltadas, y
   aprueba. En **una transacción Serializable**: CAS `PENDIENTE_APROBACION → APROBADA`, un movimiento `RECEPCION` por
   línea aceptada por la autoridad R3A, actualización del «último costo» (D-4), `DEUDA_RECEPCION` por el total
   aceptado en la cuenta del proveedor, aplicación automática del pago vinculado, auditoría.
4. Resultado: stock arriba, costo registrado, deuda 0 si pagó todo.

### 4.2 Los casos pedidos

| Caso | Cómo se resuelve | Sin modificar nada confirmado |
|---|---|---|
| Pagada totalmente al recibir | Deuda `+T` al aprobar y pago `PAGO_CAJA −T` aplicado a esa compra | Sí: dos filas nuevas |
| Parcialmente pagada | Deuda `+T`, pago `−P` aplicado; saldo `T−P` | Sí |
| A crédito (sin pago) | Deuda `+T`; saldo pendiente `T` | Sí |
| Pago anticipado | Pago `−P` sin compra (o asignado a una compra `CONFIRMADA` sin recepciones) → saldo a favor; al aprobar la recepción, aplicación automática (FIFO) | Sí: la aplicación es una fila nueva |
| Recepciones parciales | Varias recepciones contra la misma compra; cada una aprobada suma su deuda; la compra pasa a `PARCIALMENTE_RECIBIDA` | Sí |
| Cantidad pedida ≠ recibida | Se recibe lo que llegó; el resto queda pendiente; el dueño puede `CERRAR_CON_FALTANTE` | Sí |
| Dañados o rechazados | `cantidadRechazada` + motivo en la línea; no entran al stock ni a la deuda | Sí (en la misma recepción, antes de aprobar) |
| Diferencia de precio o costo | La línea guarda el costo real; si difiere del acordado (o del último costo) más allá de un umbral, la aprobación lo muestra y exige confirmarlo | Sí |
| Corrección posterior a una recepción aprobada | **Cantidad**: `DEVOLUCION_PROVEEDOR` (sale stock) o una recepción complementaria. **Costo/deuda**: `AJUSTE_DEUDA` con motivo. Nunca se edita la recepción | Sí: documentos nuevos |
| Comprobante duplicado | Único por `(negocio, proveedor, tipo, número)`; el mismo número en otro proveedor → advertencia | No aplica (bloqueo previo) |
| Pago de Caja sin compra (C1 ya registrado) | El dueño lo **asigna** a un proveedor (fila `PAGO_CAJA` con `egresoCajaId` único) y opcionalmente a compras; la fila del egreso queda intacta | Sí |
| Pago por transferencia / MP | `PAGO_DECLARADO` (estado declarado); F10-D lo verificará contra la cuenta real | Sí |
| Anulación de una recepción | Antes de aprobar: `DESCARTADA` / `RECHAZADA`. Después: devolución + reversión de deuda (nota de crédito) | Sí |
| Devolución al proveedor | Stock `SALIDA` por la autoridad (rechazada si dejaría reservas de pedidos en déficit) + `NOTA_CREDITO_DEVOLUCION`; reembolso en efectivo → F10-D/E (ingreso nuevo en un turno abierto) | Sí |

---

## 5. Integración financiera (sin tocar F10-C1)

- **La deuda no es dinero**: `cuenta_proveedor_movimientos` no tiene patas en el libro financiero. El dinero real sólo
  se mueve por F10-C1 (efectivo) y, más adelante, F10-D (otras cuentas).
- **Pagos de Caja existentes**: se vinculan por referencia (`egresoCajaId` único) → un egreso no puede asignarse dos
  veces ni a dos proveedores. Si el egreso fue compensado en F10-C1, no se puede asignar. Si ya estaba asignado y el
  dueño quiere compensarlo, primero revierte la asignación (D-8), para que la cuenta del proveedor nunca muestre un
  pago que el libro anuló.
- **Reportes**: un pago a proveedor sigue sin contarse como gasto de rentabilidad (regla de F10-C1). El costo de la
  mercadería aparece cuando se **vende** (costo de lo vendido, fase de reportes), no cuando se paga ni cuando se
  recibe.
- **Saldo por proveedor** = suma de su cuenta corriente: positivo = le debemos; negativo = saldo a favor.
- **Errores después del cierre**: un pago de Caja mal cargado y ya cerrado sigue la regla de F10-C1 (observación
  hasta F10-D). En F5 el dueño puede corregir la deuda con `AJUSTE_DEUDA`, pero el efectivo lo corrige F10-D.

---

## 6. Seguridad, stock e idempotencia

- **Autoridad de stock**: función nueva `registrarEntradaRecepcion` / `registrarSalidaDevolucionProveedor` dentro de
  `stock-lifecycle.ts`, con `runStockSerializable`; el contrato estático que lista los escritores de `stockCantidad` se
  amplía sólo con esas funciones. ENTRADA siempre; SALIDA rechazada si deja reservas ACTIVA en déficit.
- **Doble ingreso de stock imposible**:
  1. CAS de estado (`PENDIENTE_APROBACION → APROBADA`) dentro de la transacción, con candado de la fila de la recepción;
  2. `Idempotency-Key` + huella por aprobación (replay 200, clave reutilizada 409);
  3. índice único `movimientos_inventario.recepcionLineaId` y `cuenta_proveedor_movimientos.recepcionId` para
     `DEUDA_RECEPCION`;
  4. trigger: una recepción `APROBADA` es inmutable.
- **Concurrencia con ventas**: misma transacción Serializable que las ventas (reintento acotado); una venta y una
  recepción simultáneas de un mismo producto se ordenan.
- **Auditoría R1**: `recepcion.enviada`, `recepcion.aprobada`, `recepcion.rechazada`, `compra.*`, `proveedor.*`,
  `cuenta_proveedor.movimiento`, `pago_proveedor.asignado`, `devolucion_proveedor.aprobada`, en la misma transacción.
- **Aislamiento**: todo filtrado por `negocioId` derivado de la sesión; FKs compuestas; contratos estáticos y pruebas
  de otro negocio (lectura y escritura) en `deligo_ci` / `deligo_qa_auto`.

### 6.1 Permisos

| Acción | Dueño | Cajero (área `caja`) | Otros empleados |
|---|---|---|---|
| Crear / editar proveedores | Sí | Proponer nombre nuevo (pendiente de confirmación) | No |
| Preparar y enviar recepción (borrador) | Sí | Sí | No (salvo D-12) |
| Ver costos de la recepción que carga | Sí | Sí, los de su comprobante | — |
| Aprobar / rechazar recepción | **Sí (único)** | No | No |
| Ver saldos y deudas de proveedores | Sí | **No** | No |
| Pago en efectivo desde Caja | Sí | Sí (F10-C1, su turno) | No |
| Asignar pagos, pagos declarados, ajustes de deuda, cerrar compra | **Sí (único)** | No | No |
| Devolución al proveedor | Aprobar | Preparar (borrador) | No |

---

## 7. Decisiones que requieren tu aprobación

Cada una con alternativas y recomendación (★).

**D-1 · Catálogo de proveedores (roadmap #10)**
(a) texto libre como hoy · ★(b) **ficha mínima** (nombre, CUIT opcional, teléfono, email, notas, activo; duplicados por
CUIT y nombre normalizado) · (c) ficha completa (condiciones de pago, listas de precios, productos por proveedor).

**D-2 · Cuándo nace la deuda (roadmap #10)**
(a) al confirmar el pedido · ★(b) **al aprobar la recepción** (se debe lo que entró y se aceptó) · (c) al cargar la
factura, aparte de la recepción.

**D-3 · Cuentas por pagar y pagos parciales (roadmap #10)**
★(a) **cuenta corriente append-only por proveedor + aplicación de pagos** (FIFO automática, el dueño puede reasignar;
lo no aplicado es saldo a favor) · (b) sólo saldo total sin aplicación a compras · (c) cuentas por pagar con
vencimientos y antigüedad desde el inicio (más complejo; queda para una fase posterior).

**D-4 · Costo del producto**
★(a) **costo real por línea de recepción (historia) + `costo` del producto = último costo aprobado** · (b) costo
promedio ponderado (requiere valuación de stock histórica) · (c) no tocar `costo`. El promedio puede agregarse después
sin migrar datos, porque la historia queda en las líneas.

**D-5 · Comprobantes (roadmap #12)**
★(a) **sólo datos del comprobante** (tipo, número, fecha) con control de duplicados, ahora · (b) además una foto
opcional en el almacenamiento privado ya existente (Cloudinary `authenticated`, descarga firmada), en una fase
posterior · (c) foto obligatoria.

**D-6 · Pagos que no salen de Caja**
(a) esperar a F10-D · ★(b) **pago declarado** (transferencia / MP / otro) que baja la deuda y queda «declarado, no
conciliado» hasta F10-D, sin pata en el libro · (c) crear ya cuentas bancarias (adelanta F10-D).

**D-7 · Vínculo del pago en efectivo con el proveedor**
★(a) **al registrar el pago desde «Recibir mercadería»** se crea la asignación en la misma transacción del egreso
(campo nuevo opcional en la creación, nunca editable) y, para los pagos ya registrados, asignación posterior por el
dueño · (b) sólo asignación posterior por el dueño.

**D-8 · Compensar un egreso ya asignado a un proveedor**
★(a) **bloquear la compensación hasta revertir la asignación** (dos pasos explícitos) · (b) la compensación revierte
la asignación automáticamente (toca el motor certificado de F10-C1).

**D-9 · Cuándo entra el stock**
★(a) **al aprobar el dueño** (control; el dueño aprueba desde el celular en segundos) · (b) al enviar el cajero, y la
aprobación sólo confirma costo y deuda · (c) configurable por negocio, (a) por defecto.

**D-10 · Otros cargos (flete, descuentos del comprobante)**
★(a) **cargo o descuento de compra en la cuenta del proveedor, sin alterar el costo unitario** · (b) prorratearlos en
el costo de cada línea.

**D-11 · Productos sin control de stock e insumos sin producto**
★(a) **líneas de productos sin `controlStock` registran costo y deuda pero no stock**; los insumos que no son
productos van como gasto de F10-C1 o cargo de compra · (b) exigir `controlStock` en toda línea.

**D-12 · Quién prepara recepciones**
★(a) **dueño y cajeros (área `caja`)** · (b) área nueva «depósito» · (c) sólo el dueño.

**D-13 · Reembolso en efectivo de un proveedor**
★(a) **nota de crédito contra la deuda ahora; reembolso en efectivo con F10-D/E** (ingreso nuevo en el turno que lo
recibe) · (b) ingreso de Caja nuevo ya en esta etapa.

---

## 8. División en fases (cada una con autorización propia, pruebas, CI y certificación en TESTING)

| Fase | Contenido | Por qué en este orden |
|---|---|---|
| **F5-A** — Proveedores y cuenta corriente | Ficha mínima; cuenta corriente append-only; asignación de los `PAGO_PROVEEDOR` de F10-C1 ya registrados; pagos declarados; saldo por proveedor; panel del dueño | Da valor inmediato a lo ya certificado (los pagos de Caja dejan de ser texto libre) sin tocar stock |
| **F10-C2a** — Compras y recepciones (motor) | Compra directa y por pedido; recepción con estados; aprobación atómica (stock por la autoridad + costo + deuda); recepciones parciales; rechazados; diferencias de costo; comprobantes sin duplicados | Núcleo de stock y costo, apoyado en F5-A |
| **F10-C2b** — Interfaz del cajero | «Recibir mercadería» en Operaciones (escáner, cantidades, dañados, comprobante) + pago en efectivo vinculado (D-7) | Lo que usa el negocio todos los días |
| **F5-B** — Aplicación de pagos y anticipos | FIFO + reasignación manual; anticipos; cerrar compra con faltante; estado de cuenta por proveedor y por compra | Precisión contable una vez que hay compras reales |
| **F10-C2c** — Devoluciones y correcciones | Devolución al proveedor (salida respetando reservas) + nota de crédito; ajustes de deuda; recepción complementaria | Casos menos frecuentes, con reglas de stock delicadas |
| **F10-D1** — Corrección posterior al cierre (ver §9) | Conciliación del error de egreso contra la diferencia del turno cerrado y recupero como ingreso nuevo; levanta el bloqueo SQL de F10-C1 de forma controlada | Condición para habilitar egresos en negocios reales |
| Posteriores | Fotos de comprobantes (D-5 b), vencimientos y antigüedad de deuda, costo promedio, costo de lo vendido y margen, alertas de reposición (F6) | — |

Cada fase reutiliza el patrón ya certificado: servicio único, Serializable con candado, Idempotency-Key + huella,
auditoría en la misma transacción, triggers de inmutabilidad, contratos estáticos, integración en `deligo_ci`,
ensayo en `deligo_qa_auto`, batería en TESTING con guarda de escrituras y reconciliación SQL.

---

## 9. Production y la dependencia con F10-D

- **Estado registrado**: F10-C1 está `CLOSED_TESTING_CERTIFIED` (2026-11-19, `bfaba2a`) y **no autorizado para
  Production**. Production sigue en `42ca500`.
- **Criterio provisional del operador (registrado)**: F10-D debe resolver de forma segura los errores de egresos
  descubiertos después del cierre **antes** de habilitar egresos en negocios reales.
- **Análisis**:
  - Sin F10-D, un egreso mal cargado en un turno cerrado sólo puede **observarse**: el libro, el resumen por
    naturaleza y (con F5) el saldo del proveedor quedarían mostrando un movimiento equivocado sin forma de
    conciliarlo. En un negocio real eso aparece pronto (un importe tipeado mal, un retiro que no se hizo).
  - F5 agrega otro motivo: si un pago de Caja asignado a un proveedor resulta equivocado después del cierre, la deuda
    se puede ajustar en F5, pero el efectivo no. F10-D es quien cierra esa brecha.
  - Por eso el criterio es correcto, con una precisión: **no hace falta F10-D completo** (cuentas bancarias,
    Mercado Pago, transferencias). Alcanza con un **F10-D1 acotado** a la corrección posterior al cierre: (1) la
    conciliación de un egreso erróneo contra la diferencia del turno cerrado y la entrega a custodia, sin crear dinero,
    y (2) el recupero real de efectivo como ingreso nuevo en el turno abierto que lo recibe.
- **Orden recomendado**: F5-A → F10-C2a → F10-C2b → **F10-D1** → decisión de Production del paquete (F10-C1 + C2 +
  F5 + D1), y luego F5-B / F10-C2c. Si querés llegar antes a Production con F10-C1 solo, F10-D1 puede adelantarse
  inmediatamente después de F5-A; no depende de C2.
- **Cualquier promoción a Production** sigue requiriendo autorización propia, respaldo y su propia verificación.

---

## 10. Riesgos y cómo se evitan

| Riesgo | Mitigación |
|---|---|
| Stock duplicado por doble clic / replay / concurrencia | CAS de estado + idempotencia + índice único por línea + trigger de inmutabilidad + Serializable |
| Deuda o pago duplicado | Índices únicos (`recepcionId` para la deuda, `egresoCajaId` / `pagoDeclaradoId` para pagos, `revierteId` para reversiones) |
| Sistema de compras paralelo | Una sola tabla de compras (directas y por pedido); la deuda sólo en la cuenta corriente; el efectivo sólo en F10-C1 |
| El cajero ve información del dueño | Saldos, deudas y diferencias de costo sólo en rutas del dueño; contratos estáticos como en F10-C1 |
| Costo mal cargado afecta márgenes | La línea guarda el costo real; el «último costo» del producto se actualiza sólo al aprobar; aviso de diferencia |
| Devolución que deja pedidos sin stock | La salida pasa por la autoridad: rechazo si dejaría reservas ACTIVA en déficit |
| Complejidad para negocios chicos | Compra directa implícita; el cajero no ve «compras»; aprobación en un paso; FIFO automático |
