# F4-A — Anulación completa y devolución parcial de ventas de Caja (2026-10-15, Claude Code)

## Numeración

El roadmap ya tenía el bloque **F4 — DEVOLUCIONES Y ANULACIONES** («hoy no existe ningún camino de anulación de Venta»).
Esta entrega es su primera etapa: **F4-A**. Quedan fuera (etapas propias): edición/corrección administrativa de ventas
(sólo dueño), calculadora de vuelto, consumo interno/familiar, retiros/ingresos de caja ajenos a devoluciones y F10-B2.2-H.

## Decisiones de negocio aplicadas (aprobadas por el operador)

Empleado de caja y dueño pueden anular ventas completas y devolver productos parcialmente, sin autorización previa,
con motivo obligatorio; días después y aunque el turno original esté cerrado; los cierres históricos nunca cambian;
el dueño recibe un aviso persistente; la edición de ventas queda para una etapa posterior.

## Diseño

- **Compensación, no edición.** Tablas nuevas `devoluciones_venta` (evento: tipo ANULACION | DEVOLUCION_PARCIAL, motivo,
  actor de la sesión, importe, medio de la venta, estado del reintegro, idempotencia) y `devoluciones_venta_items`
  (línea: cantidad, importe, resultado de stock, movimiento de inventario). La Venta, sus VentaItem, el CobroVenta y la
  operación VENTA_COBRO no se tocan. La venta neta se deriva: total − devoluciones.
- **Importe = lo efectivamente cobrado.** Por línea, proporcional y acumulado sobre el subtotal cobrado:
  `round2(subtotal × devueltas_acumuladas / vendidas) − ya_devuelto`; la última unidad cierra exacto. Nunca el precio
  actual del catálogo. Ejemplo del operador: 2 gaseosas $2.000 + yerba $5.000 → devolver 1 gaseosa = $2.000, neta $7.000.
- **Anulación tras devoluciones parciales:** sólo las unidades e importes todavía no devueltos.
- **Dinero separado de la devolución comercial:** `NO_CORRESPONDE` | `PENDIENTE` | `REALIZADO` (EFECTIVO / TRANSFERENCIA /
  OTRO). Un pendiente se registra después, una sola vez (`POST …/devoluciones/[id]/reintegro`).
  - Sólo el **efectivo** mueve el libro existente: operación `DEVOLUCION_VENTA` con una pata negativa en la cuenta de
    efectivo de la caja que entrega el dinero, atribuida al **turno abierto en ese momento** (el propio del empleado; para
    el dueño la caja elegida o la única abierta). Así baja el efectivo esperado del turno actual; el snapshot congelado de
    un turno cerrado no cambia. Sin turno y en modo OPCIONAL → cuenta `efectivo_caja_sin_asignar`; empleado sin turno en
    OBLIGATORIO → 409 `TURNO_REQUERIDO` (pendiente sigue permitido). No genera venta ni ingreso.
  - TRANSFERENCIA / OTRO: quedan **declarados** («sin verificación bancaria»); DeliGO no afirma haber transferido.
- **Stock:** decisión explícita por línea. «Vuelve al stock» en producto controlado suma exactamente la cantidad devuelta
  con un `MovimientoInventario` tipo `DEVOLUCION` (ventaId, motivo). No toca reservas de pedidos. Sin control de stock o
  producto/variante eliminado → se registra el resultado sin movimiento.
- **Integridad y concurrencia:** una transacción Serializable con reintentos acotados; idempotencia (Idempotency-Key +
  huella, mismo actor; misma clave con otros datos → 409); la fila de la venta se bloquea con un UPDATE sin cambios para
  que una devolución concurrente de la misma venta reintente con datos frescos; la caja se bloquea `FOR UPDATE` contra
  un cierre concurrente.
- **Invariantes SQL (migración aditiva `20261017120000_f4_a_sale_returns`):** CHECKs de tipo, motivo 1–500, actor
  coherente, reintegro coherente (REALIZADO + EFECTIVO ⇔ operación financiera; nunca «realizado» sin respaldo); trigger
  de líneas que bloquea la línea vendida y rechaza cantidad o importe acumulado mayor a lo vendido/cobrado; eventos
  inmutables (sólo PENDIENTE → REALIZADO); trigger que impide atribuir una salida `DEVOLUCION_VENTA` a un turno no ABIERTO.
- **Aviso al dueño:** cada operación de un empleado (y el registro posterior de un reintegro) crea una `Notificacion`
  persistente (tipo `caja_devolucion`) **dentro de la misma transacción**: empleado, fecha, referencia de venta, tipo,
  productos y cantidades, importe, motivo y estado del reintegro; abre la pestaña Caja. **No se envía push** en esta
  etapa (sólo aviso en la campana de la app).
- **Permisos y privacidad:** negocio y actor siempre de la sesión (dueño: `requireNegocioCajaGenerico`; cajero:
  `resolveOperativoAreaForSlug(…, "caja")`). El cajero ve las ventas del negocio para poder devolver (decisión aprobada),
  pero sólo líneas, importes cobrados y devoluciones («Vos» / «Otro empleado»); nunca efectivo esperado, diferencias,
  totales del turno ni datos del libro. No existe ruta de edición de ventas.

## API

| Dueño | Cajero | Uso |
|---|---|---|
| `GET /api/negocio/caja/ventas/historial` | `GET /api/operativo/caja/[slug]/ventas/historial` | buscar por día (`desde`/`hasta`, ≤ 31 días) o referencia |
| `GET/POST /api/negocio/caja/ventas/[id]/devoluciones` | `GET/POST /api/operativo/caja/[slug]/ventas/[id]/devoluciones` | detalle / anular o devolver |
| `POST /api/negocio/caja/devoluciones/[id]/reintegro` | `POST /api/operativo/caja/[slug]/devoluciones/[id]/reintegro` | registrar un reintegro pendiente |
| `GET /api/negocio/caja/devoluciones` | — | historial de operaciones del dueño |

`GET /api/negocio/caja/ventas` (resumen del día) suma, sin cambiar sus campos previos: `resumenHoy.totalDevuelto`,
`resumenHoy.totalNeto` y `devolucionesPorVenta`.

## Interfaz

Integrada en el historial existente: Caja → Resumen del dueño (tarjetas «Devoluciones hoy» y «Neto hoy», insignia en
ventas, botón «Anular o devolver productos» en el detalle, buscador de ventas anteriores e historial «Anulaciones y
devoluciones») y en la PWA del cajero (sección «Ventas anteriores: anular o devolver»). Mismo componente
(`caja-devoluciones.tsx`) con endpoints propios de cada host. Formulario: cantidades con − / +, decisión de stock por
producto, motivo, dinero (ahora con medio / pendiente / no corresponde; el dueño elige caja si hay varias abiertas) y
confirmación explícita. Error → conserva los datos y reintenta con la misma clave. Botones apilados a ancho completo.

## Pruebas

- Integración (PostgreSQL efímero en CI, `src/lib/f4-a-devoluciones.integration.test.ts`): escenario manual completo
  (venta de 3 productos en turno cerrado, otro empleado devuelve 1 en efectivo al día siguiente, esperado del turno
  actual baja exacto, cierre anterior intacto, stock, aviso, historial, replay y clave reutilizada, cierre ciego);
  parciales sucesivas + anulación del resto con centavos; transferencia pendiente → realizada una vez sin libro, luego
  efectivo desde el turno abierto; stock no reingresado y sin control; ráfaga con la misma clave; dos empleados por la
  última unidad; aislamiento entre negocios y por área; sin rutas de edición; importes del body ignorados; modo OPCIONAL
  sin turno y OBLIGATORIO; dueño con dos cajas abiertas.
- Unitarias: `src/lib/caja-devoluciones.test.ts` (validación, regla de importe, huella, aviso, filtros, contrato
  estático) y `src/components/business/caja-devoluciones.test.tsx` (flujo, doble clic, 500 + reintento, layout).
- Contratos existentes de «escritor único» del libro (F10-B0/B2.0/B2.1) actualizados con el servicio de devoluciones
  como segundo escritor explícito (lista exacta, no relajada).

## Resultados

- Commit `d94b361` en `testing-codex` (fast-forward `7593e87..d94b361`).
- Local: `caja-devoluciones.test.ts` 12/0, `caja-devoluciones.test.tsx` 6/0, pruebas de Caja existentes 110/0, contratos
  estáticos 148/2 (los 2 = chequeo CRLF preexistente de la copia de trabajo de B2.0/B2.1; en CI pasan); TypeScript sin
  diagnósticos nuevos (33 = línea base); ESLint limpio. La suite de integración F4-A sólo corre en CI (no hay
  PostgreSQL local).
- CI run 38801260653: success (validate, generate, migrate deploy en PostgreSQL efímero, suites unitarias/UI/estáticas,
  integración F10-B2.1 con regresiones C/D/E/F/G e integración F4-A, build). Conteos exactos no capturados (el log del
  job requiere autenticación).
- Railway TESTING `DeliGO Copy` deployment `3856ee17-e2c9-40a8-b7a6-fe304149a877` SUCCESS, commit coincide; migración
  `20261017120000_f4_a_sale_returns` aplicada (48 migraciones), Ready; rutas nuevas responden 401 sin sesión.
- Production y `main` sin cambios. **No certificado:** pendiente la prueba manual del operador.

## Revisión manual y corrección de la campana del dueño (2026-10-15)

- **Revisión del operador:** 7 de 8 comprobaciones confirmadas. Falla: el aviso persistente no aparece en la campana
  del dueño. F4-A **no** está certificada.
- **Causa (evidencia de código):** la cookie `deligo_operativo_session` se crea con `path: "/"`
  (`src/app/api/operativo/login/route.ts`, callback de Google), así que en un navegador donde también hay sesión de
  empleado llega al panel del dueño. `GET`/`PATCH /api/notificaciones` elegían el feed del empleado por la sola
  presencia de esa cookie (o devolvían 401 si estaba vencida). La fila `caja_devolucion` del dueño
  (`userId = negocioId`, `userType = "negocio"`) se guarda bien —ya lo probaba la integración F4-A en CI—, pero nunca
  llegaba a su campana.
- **Corrección** (rama `codex/f4-a-owner-bell-notification`, commit `0495d48`, **sin integrar ni desplegar**): cada
  campana declara su feed (`?feed=cuenta` dueño/personal, `?feed=operativo` empleado); el servidor valida sólo la
  cookie de ese feed, sin caer en la otra; sin parámetro (clientes anteriores) gana la sesión personal válida. Sin
  migración, sin push y sin cambios en devoluciones, reintegros, stock, importes ni cierres.
- **Pruebas:** nueva regresión real-DB en `f4-a-devoluciones.integration.test.ts` (ambas cookies, cookie vencida, sin
  fallback, otro negocio, marcar leído aislado) — corre sólo en CI; locales 103/0.
- **CI de la rama:** se agregó un disparador `push` sólo para esta rama al workflow de validación (sin despliegue).
  Run 38824220699 falló en `caja-devoluciones.test.tsx` (el diálogo Radix no se montó) porque se había sumado
  `notification-center.test.ts` al lote, que importa la campana sin DOM; se quitó del lote. Run 38824562325 sobre
  `cfd23e3`: **PASS** (migraciones en PostgreSQL efímero, integración real-DB F4-A con la regresión de la campana,
  build). Railway TESTING no desplegó nada.
- **Pendiente:** autorización del operador para integrar en `testing-codex`, CI, Railway TESTING y una comprobación
  manual de la campana.

## Prueba manual sugerida (TESTING)

1. Empleado A abre turno, vende 3 productos (por ejemplo 2 gaseosas y 1 yerba con stock controlado) en efectivo y
   cierra el turno normalmente.
2. Al día siguiente, empleado B abre su turno en la misma caja.
3. B → «Ventas anteriores: anular o devolver» → elige el día de la venta (o escribe la referencia #xxxxxxxx) → abre la
   venta → «Devolver productos» → 1 gaseosa → «Vuelve al stock» → motivo → «Devolví el dinero ahora» / Efectivo →
   confirma. Debe ver «Devolución registrada por $…».
4. Dueño → Caja → Cajas y turnos: el efectivo esperado del turno de B bajó exactamente el importe devuelto; el cierre
   del turno de A (historial) no cambió.
5. Inventario: la gaseosa sumó 1 unidad (movimiento DEVOLUCION).
6. Campana del dueño: aviso «Devolución parcial» con empleado, venta, producto, importe, motivo y estado del dinero.
7. Caja → Resumen: la venta muestra «Devolución parcial», total original, devuelto y neto; «Anulaciones y
   devoluciones» lista la operación.
8. Anulación: en otra venta, «Anular venta» → decisión de stock por producto → motivo → dinero → confirmar; la venta
   queda «Anulada» y ya no admite devoluciones.
9. Transferencia: venta por transferencia → devolución con «El reintegro queda pendiente» → luego «Registrar
   reintegro» → Transferencia; figura como declarado, sin verificación bancaria.
