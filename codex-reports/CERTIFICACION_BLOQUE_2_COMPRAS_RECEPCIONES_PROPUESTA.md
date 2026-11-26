# Certificación manual — Bloque 2: Compras y recepciones de mercadería · PROPUESTA (no ejecutada)

> **SUPERADA (2026-11-25):** el operador aprobó el bloque; la versión definitiva es `codex-reports/CERTIFICACION_BLOQUE_2_COMPRAS_RECEPCIONES.md`. Este archivo queda como antecedente.


Fecha: 2026-11-25 · Estado: **PROPUESTA PARA REVISIÓN** (operador / ChatGPT). No se ejecuta hasta cerrar el Bloque 1
(`M11240504`, conciliación pendiente del verificador) y autorizar este bloque.
Entorno: Railway TESTING (`testing-codex` = `327d6c73`), negocio QA `paola-vinal`. Production intacta.
Metodología: `DEVELOPMENT_WORKFLOW.md` — pruebas funcionales del operador en TESTING, verificación interna de Claude
con SQL de sólo lectura; sin pruebas locales ni herramientas nuevas innecesarias.

## 1. Alcance

Incluye (F10-C2a/b + F5 mínimo): pedido de compra a un proveedor; «Recibir mercadería» del cajero (borrador → envío);
revisión y aprobación del dueño (stock por la autoridad única R3A, último costo, obligación en la cuenta del proveedor,
auditoría, todo en una transacción); recepción parcial con rechazo de unidades; cierre de pedido con faltante; recepción
sin pedido devuelta o rechazada sin efectos; privacidad del cajero (sin costos, saldos ni deuda) y límites de su permiso.

Queda FUERA (bloques posteriores): pagos a proveedores y cuenta corriente (D-7 efectivo desde el turno, transferencias,
asignaciones FIFO, anticipos E1–E3), etiquetas de góndola y precios de venta, importación masiva.

Riesgo: **ALTO** (stock y deuda). Controles: transacción única de aprobación, idempotencia, un movimiento de stock por
renglón aceptado con control de stock, una obligación por recepción, sin movimientos financieros ni de Caja.

## 2. Datos QA (reutilizar, no duplicar)

| Dato | Origen | Uso en el Bloque 2 |
|---|---|---|
| Proveedor «QA B1 Proveedor Alfa M11240504» (`cmwvonba6000gk60atvght1h3`) | Bloque 1 | pedido y recepción principal |
| Proveedor «QA B1 Proveedor Beta M11240504» (`cmwvong4e000jk60a0fl0euem`) | Bloque 1 | recepción sin pedido (devuelta / rechazada) |
| «QA B1 Producto A M11240504» (sin control de stock) | Bloque 1 | renglón sin stock: sólo costo y deuda |
| «QA B1 Producto B M11240504», Variante 1 y 2 | Bloque 1 | variante obligatoria en la recepción |
| **Nuevo:** «QA B2 Producto Stock <etiqueta>» con **control de stock, stock inicial 0** | preparación B2 | única forma de comprobar el movimiento `RECEPCION` sin alterar productos ya certificados |
| Cajero QA `cmuq91zhp0008ka0ab4fqenuj` («TEST_T44_R1D_CUENTA_4135EA7A») | existente | «Recibir mercadería» (área caja) |

No se modifican los productos certificados en el Bloque 1 (sus precios, costos y control de stock quedan como están; la
aprobación sí actualiza su **último costo**, que es el efecto a certificar y queda en la línea base).

## 3. Escenarios (operador, en la interfaz de TESTING)

| Id | Escenario | Resultado esperado visible |
|---|---|---|
| B2-E1 | Dueño: Caja → Compras → Pedidos → nuevo pedido a Alfa: Producto A × 2, Producto B Variante 1 × 3, Producto Stock × 5, con costos acordados | pedido abierto con 3 renglones y avance 0 |
| B2-E2 | Cajero (Operaciones → Caja → «Recibir mercadería»): recepción del pedido; Producto Stock recibido 5 / aceptado 4 / rechazado 1 («dañado»); A y B completos; guardar borrador, retomar y enviar | enviada al dueño; el cajero no ve costos, saldos ni deuda |
| B2-E3 | Dueño: «Por aprobar» → revisar vista previa (costos, impuestos, deuda) → confirmar importes → aprobar | recepción APROBADA; stock de Producto Stock = 4; cuenta de Alfa con una deuda por el total aprobado |
| B2-E4 | Dueño: cerrar el pedido con faltante (motivo) | pedido `CERRADA_CON_FALTANTE`; desaparece de «Pedidos por recibir» del cajero |
| B2-E5 | Cajero: recepción SIN pedido a Beta (Producto A × 1) y enviar; dueño la DEVUELVE con motivo; cajero la corrige y reenvía; dueño la RECHAZA con motivo | sin stock, sin costo nuevo, sin deuda para Beta |
| B2-E6 | Límites del cajero: intentar aprobar / rechazar desde Operaciones (no hay acción) y ver que el detalle no muestra importes de aprobación | sin acción disponible; sin datos financieros |

## 4. Verificación interna (Claude, SQL de sólo lectura, limitado a la etiqueta y al intervalo)

- Pedido y renglones (`compras`, `compra_lineas`): cantidades, costos acordados, estado final `CERRADA_CON_FALTANTE`.
- Recepciones (`recepciones`, `recepcion_lineas`): estados, versiones, eventos (envío, devolución, rechazo, aprobación),
  quién preparó y quién aprobó; ninguna recepción duplicada por reintentos (Idempotency-Key).
- Stock: **un** movimiento `RECEPCION` de +4 para Producto Stock; **ninguno** para A (sin control), B (sin control) ni por
  la recepción rechazada; stock final = línea base + 4.
- Costos: último costo de A, B (variante) y Producto Stock actualizado sólo por la recepción aprobada (`costos_vigentes`);
  precios de venta sin cambios salvo que el producto tenga recargo configurado (se informa, no se asume).
- Cuenta del proveedor (F5): **una** obligación `RECEPCION` para Alfa por el total aprobado; Beta sin obligaciones.
- Dinero: ningún movimiento financiero ni egreso de Caja en el intervalo para los proveedores QA.
- Auditoría: eventos del dueño y del cajero en orden; nada del cajero después del envío salvo la corrección pedida.
- Logs: sin 5xx ni errores relacionados; 403 del cajero sólo si intenta acciones del dueño (correlacionado por ruta/tiempo).

## 5. Herramientas (mínimas)

Reutilizar el patrón del Bloque 1 (`b1-manual-preparar.ps1` / `b1-manual-verificar.ps1`): mismo ejecutor de sólo lectura,
mismas protecciones (commit esperado, SHA-256 del SQL, sesión read-only, negocio fijo), con:
- un SQL nuevo `b2-manual.sql` (secciones del §4) y su comparador `b2-comparar.mjs` (checks del §4 + observaciones B2-E1…E6);
- preparación: verifica despliegue, crea sólo el «QA B2 Producto Stock» (stock 0, control de stock) por la API del dueño,
  registra línea base (stock, costos y cuentas de Alfa/Beta) e imprime instrucciones con nombres y rutas exactos.
Sin simulaciones locales ni baterías: sólo el control técnico mínimo del SQL nuevo contra el esquema (como en B1).

## 6. Preguntas para decidir antes de ejecutar

1. ¿Se acepta crear un único producto QA nuevo con control de stock (recomendado) o se habilita el control de stock en
   un producto del Bloque 1 (altera un dato ya certificado)?
2. ¿«Recibir mercadería» del cajero requiere turno abierto en paola-vinal? Si sí, la preparación lo informa y el operador
   lo abre (sin movimientos de dinero).
3. ¿Se incluye el cierre con faltante (B2-E4) o se deja el pedido abierto para el bloque de pagos?
