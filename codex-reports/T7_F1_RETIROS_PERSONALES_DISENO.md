# T7-F1 — Retiros personales de mercadería desde Caja (diseño técnico)

Primera funcionalidad del ciclo T7 (operador, 2026-11-27). Rama única: `codex/retiros-personales` (desde
`codex/t7-metodologia` `7a050128`). Riesgo **alto** (stock, permisos, auditoría; sin dinero).

## Contraste con las autoridades existentes (sin incompatibilidades)

| Autoridad | Uso en esta funcionalidad |
|---|---|
| Stock (`stock-lifecycle.ts`, R3A) | funciones NUEVAS dentro de la autoridad: `planificarStockRetiroPersonal`, `registrarStockRetiroPersonal`, `reingresarStockRetiroPersonal`. Mismo criterio que Caja: clave agregada, disponible = físico − reservas ACTIVA, `resolveNextStock`, transacción Serializable de `runStockSerializable`. Ninguna ruta ni componente escribe `stockCantidad` |
| Precios (motor de venta de Caja) | `computeSaleFromAuthoritativeProducts` + `saleAmountsExact` sobre el catálogo del negocio leído en la transacción; el cliente nunca envía precios, costos ni totales (sólo el total que vio, para rechazar si cambió) |
| Dinero (F10, F4, F5, F10-D1) | **sin cambios**: un retiro no crea Venta, VentaItem, CobroVenta, OperacionFinanciera ni MovimientoFinanciero |
| Sesiones / permisos | dueño: sesión de negocio + rubro genérico (`requireNegocioCajaGenerico`); cajero: `resolveOperativoAreaForSlug(…, "caja")` + `empleados.retiroPersonalHabilitado` releído DENTRO de la transacción (la revocación vale para sesiones abiertas) |
| Auditoría | `auditLogWithClient` en la misma transacción |
| Notificaciones | `notificacion.create` en la misma transacción (patrón de egresos F10-C1a), sólo cuando registra un empleado |

## Modelo de datos (migración aditiva `20261127200000_t7_retiros_personales`)

- `empleados.retiroPersonalHabilitado BOOLEAN NOT NULL DEFAULT false` — nadie queda habilitado automáticamente.
- `familiares_retiro` — familiares frecuentes por negocio; `nombreNormalizado` único por negocio (sin acentos,
  minúsculas, espacios colapsados) para evitar duplicados accidentales; no requiere cuenta de DeliGO. **Un nombre
  igual a uno registrado nunca se asume como la misma persona**: el servidor responde 409
  `FAMILIAR_NOMBRE_EXISTENTE` (con el familiar existente) y el formulario pide elegirlo explícitamente o escribir un
  nombre que los distinga (apellido o parentesco). Dos altas simultáneas del mismo nombre: una sola se crea.
- `retiros_personales` — tipo de beneficiario (EMPLEADO | FAMILIAR | DUENO) con su referencia real (empleado,
  familiar o el propio negocio) y el **nombre histórico**; quién registró (NEGOCIO | EMPLEADO, id y nombre
  histórico); turno de Caja del cajero si tenía uno abierto (contexto, sin efecto en el efectivo); valor comercial
  y costo conocido totales; `costoCompleto`; observaciones; estado (VIGENTE | ANULADO); estado de decisión
  (PENDIENTE para empleados, NO_APLICA para familiares/dueño); Idempotency-Key + huella únicas por negocio.
- `retiro_personal_lineas` — snapshot por línea: producto/variante, nombres, cantidad, precio unitario, subtotal,
  costo unitario (NULL = desconocido, nunca 0), costo total, si movió stock.
- `movimientos_inventario.retiroPersonalId` / `devolucionRetiroId` — tipos `RETIRO_PERSONAL` (salida) y
  `RETIRO_PERSONAL_REINGRESO` (entrada), vinculados inequívocamente con su origen.
- `devoluciones_retiro` + `devolucion_retiro_lineas` — ANULACION (error de registro) o DEVOLUCION (física), con
  cantidades, valores y costos devueltos; el retiro original nunca se modifica salvo su estado al anularse.
- `decisiones_recupero_retiro` + `decision_recupero_retiro_items` — decisión informativa del dueño sobre retiros
  de UN empleado: importe a recuperar, motivo, quién y cuándo; estado VIGENTE | REEMPLAZADA | ANULADA (historial);
  cada ítem guarda el valor elegible al decidir y el importe asignado. Índice único parcial: un retiro pertenece a
  UNA sola decisión vigente.
- CHECKs en SQL: tipos y estados válidos, coherencia beneficiario/referencia, importes y cantidades ≥ 0,
  asignado ≤ elegible por ítem. FKs NO ACTION hacia empleados/familiares/turnos (protegen la traza; la cascada del
  negocio sigue funcionando).

## Valoración (servidor)

- Precio = el mismo que cobraría la Caja en ese momento: precio de venta de la variante si la hay, si no el del
  producto. Caja no aplica promociones ni descuentos (son de pedidos en línea): un retiro tampoco. Sin protección
  de «inicio de venta»: si el total que vio el cajero no coincide con el actual → 409 `PRECIOS_CAMBIARON`.
- Producto sin precio de venta → 400 `PRODUCTO_SIN_PRECIO` (igual que una venta).
- Costo = costo propio de la variante, si no el del producto (misma regla que precios-venta); NULL = desconocido.
  Un costo 0 o negativo en el catálogo también se trata como desconocido (el catálogo no distingue «0» de «sin
  cargar»); nunca se muestra un costo desconocido como 0.
  Los totales informan costo conocido y si está completo. Valores congelados: cambios posteriores de precio,
  costo, nombre o empleado no alteran el registro.
- El cajero no puede alterar valores: no hay campos de precio/total editables; el servidor recalcula todo.

## Inventario

Líneas con control de stock: plan agregado por clave contra el disponible (respeta reservas de pedidos, nunca
negativo); un movimiento `RETIRO_PERSONAL` por clave en la misma transacción. Sin control: se registra el retiro
sin tocar stock ni activar el control. Cualquier línea inválida → rollback de todo. Devolución/anulación: reingreso
`RETIRO_PERSONAL_REINGRESO` sólo de líneas que movieron stock al retirarse y cuya clave sigue controlada; nunca más de
lo retirado menos lo ya devuelto (filas bloqueadas `FOR UPDATE` + Serializable).

## Tratamiento financiero

Ninguna escritura en ventas, cobros, operaciones o movimientos financieros; el efectivo esperado del turno y el
cierre ciego no cambian; los indicadores de ventas no leen estas tablas. El resumen separa: valor comercial, costo
conocido, importe que el dueño decidió recuperar (informativo) y — explícitamente — que **no hay importe recuperado
registrado** en esta entrega (no hay cobros ni descuentos salariales).

## Decisiones de recuperación

Sólo el dueño, sólo retiros VIGENTES de beneficiario EMPLEADO, todos del mismo empleado. Importe entre 0 y la suma
del valor elegible (valor − devuelto). Se asigna a los retiros del más antiguo al más nuevo (asignado ≤ elegible).
Modificar = nueva decisión que reemplaza a la anterior (la anterior queda REEMPLAZADA); «Volver a pendiente» =
ANULADA. Una devolución o anulación que dejaría a un retiro con asignado > elegible se rechaza (409
`DECISION_REQUIERE_REVISION`): el dueño revisa primero la decisión; nada se modifica en silencio.

## Permisos

Dueño: siempre. Empleado: sesión operativa de Caja + permiso individual (por defecto deshabilitado) que el dueño
gestiona desde Administración → Resumen → Retiros personales. Un cajero puede registrar para sí mismo, otro
empleado, un familiar o el dueño; no decide recuperaciones, no ve costos ni el resumen, no anula ni devuelve.

## API

Dueño (`/api/negocio/caja/retiros-personales`): `GET contexto`, `POST` (Idempotency-Key), `GET` (lista con
filtros), `GET resumen`, `POST decisiones`, `POST decisiones/[id]/anulacion`, `POST [id]/devoluciones`
(Idempotency-Key). Permisos: `GET/PUT /api/negocio/empleados/permisos-retiro`. Cajero
(`/api/operativo/caja/[slug]/retiros-personales`): `GET contexto`, `POST` (Idempotency-Key; respuesta sin costos).

## Correcciones de la revisión independiente de ChatGPT (2026-11-28)

1. **Resumen completo.** `resumenRetirosPeriodo` recorre TODOS los retiros del período en lotes de 1.000 ordenados
   (createdAt, id) dentro de una transacción de solo lectura REPEATABLE READ: totales y agrupados por persona incluyen
   cada registro (`registrosIncluidos`). El límite existe sólo en el DETALLE, paginado y explícito (100 por página,
   `siguienteCursor`; la pantalla muestra «Ver más retiros» y aclara que los totales cubren todo el período).
2. **Intento incierto persistente.** El formulario guarda el intento (clave + cuerpo exacto + carrito + nombre del
   beneficiario) en `sessionStorage` propio (`deligo:caja:retiro-attempt:v1:<scope>`, scope = negocio del dueño o
   empleado + negocio del cajero) ANTES de enviarlo. Una respuesta incierta (sin respuesta o 5xx, misma clasificación
   que el cobro: `classifyCheckoutResponse`) lo conserva; cerrar/reabrir o recargar vuelve al mismo intento, que sólo
   se puede reenviar tal cual o descartar; mientras exista, «Cobrar» reabre el retiro (nunca cobra una venta con ese
   carrito); el carrito se restaura al recargar y se vacía sólo tras la confirmación (y sólo si sigue siendo el
   carrito retirado). Un rechazo definitivo lo descarta — salvo un 401/403 al REINTENTAR un intento incierto (sesión
   vencida o permiso revocado no prueban que el original no se registró): el intento se conserva para resolverlo con
   una sesión autorizada. Descartarlo a mano exige una segunda confirmación que advierte que podría estar registrado y
   que debe verificarse antes de volver a cargarlo. Sin costos, decisiones ni credenciales en el almacenamiento.
   El mecanismo de ventas (`caja-checkout-attempt.ts`) no se modificó; sólo se reutilizan su clasificación de
   respuestas y su generador de claves.
3. **Variante borrada.** Nueva columna `retiro_personal_lineas.lineaDeVariante` (CHECK: una línea de producto nunca
   apunta a una variante). Una línea de variante cuya variante ya no existe (FK SET NULL) nunca reingresa stock al
   producto padre. Las cantidades devueltas siguen la regla de F4 (> 0, hasta 7 enteros y 3 decimales) y el remanente
   se compara con Decimal exacto. (Ninguna ruta borra variantes físicamente; la protección es defensiva.)

## Interfaz

- Caja (dueño y cajero, misma vista `VenderView`): «Cobrar» muestra «Retiro personal» separado de los medios de pago
  sólo si el servidor confirma el permiso (y nunca durante un cobro sin confirmar). El formulario usa el carrito tal
  como está, muestra el aviso «Esta operación registra una salida de mercadería sin ingreso de dinero a Caja.», exige
  la confirmación explícita y vacía el carrito sólo tras la confirmación del servidor.
- Administración → Resumen → Retiros personales (`owner-retiros-personales.tsx`, sección plegable): períodos hoy /
  esta semana / este mes / rango, tipo y persona; totales; detalle por persona con productos, valor, costo conocido,
  registrante, observaciones, estado y decisión; decisiones (no recuperar, todo, una parte, modificar, volver a
  pendiente) con historial; anulación y devolución; permisos individuales («Quién puede registrar retiros»).

## Pruebas

`src/lib/t7-f1-retiros-personales.integration.test.ts` (18, PostgreSQL efímero, rutas reales; incluye 2.050 retiros),
`src/lib/t7-f1-retiros-personales-static-contract.test.ts` (11), `src/components/business/caja-retiro-personal.test.tsx`
(8), `src/components/business/caja-tab.retiro-intento.test.tsx` (2, CajaTab real: respuesta perdida, reapertura,
recarga), `src/components/business/owner-retiros-personales.test.tsx` (4); contrato R3A-I2 actualizado con el nuevo
caller de `runStockSerializable` (34) y sumado al CI. CI de `2f42bf61`: 46087712923, 91/91 pasos, 1.061 pruebas.
