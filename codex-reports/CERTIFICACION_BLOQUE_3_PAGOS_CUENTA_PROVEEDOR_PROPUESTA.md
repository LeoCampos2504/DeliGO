# Certificación manual — Bloque 3: Pagos, anticipos, deudas y cuenta corriente de proveedores · PROPUESTA (no ejecutada)

> **SUPERADA (2026-11-25):** el operador aprobó el bloque con decisiones; versión definitiva:
> `codex-reports/CERTIFICACION_BLOQUE_3_PAGOS_CUENTA_PROVEEDOR.md`.

Fecha: 2026-11-25 · Estado: **PROPUESTA PARA REVISIÓN** (operador / ChatGPT). No se prepara ni se ejecuta hasta cerrar el
Bloque 2 (`M11250631`, verificación con conciliación de logs pendiente) y autorizar este bloque.
Entorno: Railway TESTING (`testing-codex` = `327d6c73`), negocio QA `paola-vinal`. Production intacta.
Metodología: igual que los Bloques 1 y 2 (operador en la interfaz; Claude prepara datos, línea base y verificación de
solo lectura; herramientas adaptadas de `b2-manual`).

## 1. Reglas vigentes revisadas (no se inventan reglas)

Fuentes: `F10_C2_F5_COMPRAS_RECEPCION_DISENO.md` §4–5 (motor F5), §14.4 y §15 (D-7 v2), §16.10–16.12 (pagos E1–E3) y
`DECISIONS_AND_INVARIANTS.md`. Todo está integrado en TESTING desde `e6224a48` (rutas presentes en `327d6c73`).

- **Motor único F5:** obligaciones inmutables (deuda) · créditos (`PAGO_CAJA`, `PAGO_DECLARADO`, `AJUSTE_A_FAVOR`) ·
  asignaciones append-only (asignar / desafectar / reasignar, con motivo, idempotentes, candado por proveedor).
  Deuda exigible = Σ obligaciones vigentes − Σ créditos efectivos; anticipo = Σ disponible de créditos efectivos; las
  transferencias **programadas** (`DECLARADO`) no restan. Estados Pendiente / Parcialmente pagada / Pagada derivados del saldo.
- **Transferencia del dueño:** realizada → nace confirmada (evento `CONFIRMACION`); programada → `DECLARADO` hasta
  «Ya hice esta transferencia» o «No se va a hacer». Nunca mueve Caja.
- **«Pagar deudas seleccionadas»** (`/api/negocio/proveedores/[id]/pagos-deudas`): transferencia realizada + reparto
  sugerido y editable en una sola transacción; nunca supera el pago ni el saldo de cada factura; lo no repartido queda a favor.
- **Efectivo:** sale **sólo** por F10-C1 (`PAGO_PROVEEDOR`) desde un turno abierto; el crédito `PAGO_CAJA` queda ligado.
  El cajero sólo usa su propio turno y necesita el permiso de anticipos con límites (por operación y diario).
- **Anticipos de pedido (E1/E3):** sólo con el pedido ABIERTO; se aplican solos al aprobar recepciones de ese pedido y
  **nunca** a deudas antiguas; el sobrante sigue ligado al pedido. Si el pedido ya tiene una factura aprobada con saldo,
  un anticipo nuevo se rechaza (`PEDIDO_CON_DEUDA_APROBADA`, regla vigente con revisión futura registrada).
- **D-7 v2:** el cajero puede pagar en efectivo al recibir (su turno); al aprobar, se convierte en crédito aplicado a esa deuda.
- **Avisos:** posible pago duplicado (mismo proveedor, importe y fechas ±3 días) con casilla «Es otro pago diferente».
- **Cajero:** nunca ve saldos ni deuda del proveedor; sólo el importe anticipado del pedido que recibe.
- **Fuera de alcance (decisiones abiertas, no implementadas):** devoluciones del proveedor, reintegros al dueño, uso del
  saldo a favor general al aprobar, efectivo del dueño sin turno, vencimientos.

## 2. Datos QA (reutilizar)

| Dato | Uso |
|---|---|
| Deuda de Alfa **$ 6.231,50** (recepción aprobada del Bloque 2; pedido `CERRADA_CON_FALTANTE`) | pagos de deuda existente (parcial, corrección, cancelación) |
| Proveedores Alfa / Beta, productos A / B / «QA B2 Producto Stock M11250631» | pedido nuevo con anticipo (el pedido del Bloque 2 está cerrado: no admite anticipos) |
| Cajero QA (sin turno, sin permiso de anticipos) | límites y anticipo en efectivo (si se incluye E6) |
| Turno del dueño «Caja principal» (abierto desde el 04/11) | sólo si se decide pagar en efectivo desde Caja (ver §5) |

Datos nuevos mínimos: **un** pedido a Alfa (p. ej. Producto Stock × 2 a 500) para los anticipos; ningún producto ni proveedor nuevo.

## 3. Escenarios propuestos

| Id | Escenario (operador) | Resultado esperado (reglas vigentes) |
|---|---|---|
| B3-E1 | Dueño abre la cuenta corriente de Alfa | Deuda $ 6.231,50; recepción del Bloque 2 «Pendiente»; sin anticipos ni transferencias programadas; Beta sin deuda |
| B3-E2 | «Pagar deudas seleccionadas»: transferencia realizada de $ 2.000 aplicada a esa recepción (doble clic incluido) | Un crédito confirmado + una asignación de $ 2.000; saldo $ 4.231,50 «Parcialmente pagada»; sin Caja; un solo registro pese al doble clic |
| B3-E3 | Corrección: desafectar con motivo la asignación de E2 y volver a asignarla | Saldo vuelve a $ 6.231,50 y luego a $ 4.231,50; historial append-only (asignación + desafectación + asignación); deuda exigible sin cambios durante la corrección (el crédito sigue efectivo) |
| B3-E4 | Pago mayor que lo seleccionado: transferencia de $ 5.000 aplicada al saldo de $ 4.231,50 | Factura «Pagada» (saldo 0); $ 768,50 visibles como anticipo / a favor, sin repartirse solos |
| B3-E5 | Pedido nuevo a Alfa con transferencia realizada (anticipo) y una programada; marcar la programada «No se va a hacer»; recepción del cajero y aprobación | Anticipo aplicado sólo a la deuda de ese pedido; la programada no resta y queda anulada con motivo; el a favor general de E4 **no** se aplica solo; el cajero ve sólo «pagado por adelantado» del pedido |
| B3-E6 *(opcional, ver §5)* | Dueño habilita anticipos del cajero con límites; el cajero abre turno, intenta superar el límite, registra un anticipo válido en efectivo y cierra su turno; el dueño restaura los permisos | Rechazo por límite sin escribir nada; una salida `PAGO_PROVEEDOR` + crédito `PAGO_CAJA` ligado al pedido; permisos restaurados |
| B3-E7 | Restricciones y duplicados: aviso de posible pago duplicado; el cajero no ve saldos; no se puede pagar a Beta con un crédito de Alfa | Aviso con casilla obligatoria; sin datos financieros del proveedor para el cajero; sin cruces entre proveedores |

## 4. Verificación interna (SQL de solo lectura, adaptando `b2-manual.sql`)

Obligaciones, créditos (estado, origen, `compraReferenciaId`, `egresoCajaId`), asignaciones y desafectaciones, eventos de
cuenta, operaciones de asignación, deuda exigible y anticipo recalculados por la identidad F5, egresos de Caja y movimientos
financieros (sólo los de E6, si se incluye), turnos, permisos del cajero, auditoría y logs; comparación antes/después con
importes exactos por escenario. Mismas protecciones del ejecutor; recomendación nueva: cerrar las ventanas antes de verificar.

## 5. Decisiones para el operador antes de preparar

1. **Efectivo desde Caja:** ¿se incluye B3-E6 (anticipo del cajero con permiso, límites y su propio turno abierto y
   cerrado en el bloque)? Implica mover dinero real de TESTING en una caja QA y cambiar temporalmente permisos.
   Alternativa: certificar sólo transferencias (E1–E5, E7) y dejar el efectivo para otro bloque.
2. **Turno del dueño «Caja principal»** (abierto desde el 04/11): ¿se mantiene intacto también en el Bloque 3 (recomendado)?
3. **Importes:** ¿se aceptan $ 2.000 y $ 5.000 (dejan la deuda del Bloque 2 pagada y $ 768,50 a favor), o se prefiere dejar
   parte de la deuda abierta para un bloque posterior?
4. **`PEDIDO_CON_DEUDA_APROBADA`:** se certifica tal como está (regla vigente); su revisión futura queda registrada y no se
   prueba como cambio.
