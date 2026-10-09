# F10-B1 — Cajero en DeliGO Operaciones (mobile-first)

Fecha: 2026-10-09 · Entorno: TESTING únicamente (amiable-rejoicing / TESTING / DeliGO Copy / testing-codex) · Production: sin cambios.
Base: F10-B0 (`codex-reports/F10_B0_IMPLEMENTATION.md`) · diseño: `codex-reports/F10_A_TECHNICAL_DESIGN.md` (decisión D5).

```text
F10_B1_STATUS=IMPLEMENTED_TESTING_AWAITING_PHYSICAL_SMOKE (2026-10-09)
F10_B2_STATUS=NOT_STARTED · F10_C_STATUS=NOT_STARTED · F10_D_STATUS=NOT_STARTED · F10_E_STATUS=NOT_STARTED
PHYSICAL_SMOKE=PENDING_OPERATOR (no se declara PASS sin los resultados del operador)
```

> **Importante:** F10-B1 permite que un empleado venda desde su teléfono, pero **todavía no es una Caja completa**: no hay turnos, apertura, cierre ciego ni control de efectivo por cajero (F10-B2). No habilitarlo como Caja completa para empleados reales hasta implementar y validar F10-B2.

## 1. Objetivo y alcance

Un empleado con el área operativa **Caja** en un negocio genérico vende desde DeliGO Operaciones (PWA personal) con la misma experiencia de venta del dueño. Implementado:

1. **Área `caja`** en el sistema real de `areaOperativa` (`src/lib/area-operativa.ts`):
   - sólo negocios genéricos (rubro `negocio`);
   - no exige Salón;
   - no concede ninguna capacidad de Mozo, Salón ni PyR;
   - un área por empleado (campo único existente);
   - sin revivir `Empleado.rol` / `permisos` (siguen sin uso).
2. **Pantalla del cajero** `/operaciones/mi-panel/[slug]/caja`. Reutiliza `VenderView`: catálogo, búsqueda, lector continuo F9, carrito, cantidades, variantes y checkout con intentos idempotentes. Acceso desde el panel personal ("Abrir Caja").
3. **Catálogo del cajero** `GET /api/operativo/caja/[slug]/productos`: sólo campos de venta y la misma autoridad de disponibilidad que el dueño.
4. **Venta del cajero** `POST /api/operativo/caja/[slug]/ventas`:
   - delega en el motor único `registrarVentaCaja` con actor `EMPLEADO` derivado de la sesión;
   - **Idempotency-Key obligatoria**.
5. **Administración:** el dueño asigna el área "Caja" desde Salón → Mozos/Empleados. La opción sólo aparece en negocios genéricos, y el servidor rechaza Caja en Restaurante/Ropa (409).
6. **Endurecimiento del motor:** un replay sólo se devuelve al **mismo actor** que creó la venta. La misma clave presentada por otra persona del negocio da 409 (nunca la venta de otro).

**No implementado (a propósito):**
- turnos, apertura/cierre, cierre ciego, cajas físicas y `Venta.turnoId` (F10-B2);
- salidas de efectivo y recepciones (F10-C);
- cuentas, Mercado Pago, remitente y conciliación (F10-D);
- cambios de efectivo/transferencia (F10-E);
- terminales compartidas o QR para Caja;
- modo offline;
- estadísticas o resumen del negocio para el cajero.

## 2. Revisión previa: checksum de la migración F10-B0 (sólo lectura)

Verificado con una lectura `SELECT` de `_prisma_migrations` en TESTING (huella `d64be28f676e`), sin modificar nada:

| Elemento | sha256 | Bytes |
|---|---|---|
| `_prisma_migrations.checksum` de `20261009120000_f10_b0_sales_idempotency_payments_ledger` | `d3faab68222f0fcb89ac54e3843a443401337caf5eceabf5edb0ca6d8dd963dd` | — |
| Copia aplicada (antes de quitar la línea en blanco final) | `d3faab68…63dd` (coincide con el registro) | 5632 |
| Blob versionado en Git (`e72c61b` / `88ff0c1`) | `51625d5d9faa364d88d1077fc26494a4a730aa9c0317ddeb1c78c6f05f56be6e` | 5631 |

- **Diferencia:** la copia aplicada es exactamente el blob más un `\n` final. Ninguna de las dos tiene CR. La copia de trabajo CRLF sólo difiere por `autocrlf`. **No hay diferencia SQL.**
- **Drift de esquema:** `prisma migrate diff` (base TESTING → `schema.prisma`) sólo muestra un `ALTER INDEX … RENAME` del índice único de `chat_attachment_deletion_jobs` (nombre truncado a 63 caracteres por PostgreSQL). Es preexistente y ajeno a F10, sin cambios de columnas, tablas ni restricciones de F10-B0.
- **`prisma migrate status` no verifica checksums** de migraciones ya aplicadas (y `migrate deploy` tampoco las revalida). Por eso la comparación se hizo directamente contra `_prisma_migrations`.
- **Conclusión:** diferencia trivial (espacio en blanco), sin drift material → sin STOP. **No** se editó la migración ni su registro.
- **Corrección propuesta (NO ejecutada, requiere autorización explícita):**
  - **(a) Recomendada:** dejarlo así y documentarlo. No afecta a `migrate deploy`, y Production aplicará el blob versionado desde cero (su checksum será `51625d5d…`).
  - **(b)** Si se quiere alinear el registro de TESTING: una tarea de mantenimiento dedicada y autorizada que haga `UPDATE _prisma_migrations SET checksum = '51625d5d…' WHERE migration_name = '20261009120000_f10_b0_sales_idempotency_payments_ledger'`, con huella verificada y respaldo previo de la fila.
  - Nunca volver a editar el archivo de la migración.

## 3. Riesgo de dinero en `Float` (documentado, sin migrar ahora)

`Venta.total`, `VentaItem.precio/subtotal`, `CobroVenta.importe`, `MovimientoFinanciero.importe` y `Producto.precio` son `Float` (double precision). Hoy el motor redondea a centavos en cada cálculo. Con turnos, cierres ciegos y sumas de muchos movimientos (B2/D), los errores binarios acumulados pueden producir diferencias de centavos falsas.

**Propuesta exacta, antes de F10-B2 (efectivo esperado) y obligatoria antes de F10-D:**
1. Migración aditiva y reversible por etapas: agregar columnas `Decimal(12,2)` (`total_dec`, `importe_dec`, …) en `ventas_caja`, `venta_items`, `cobros_venta` y `movimientos_financieros`. Backfill con `ROUND(x::numeric, 2)` en lotes, verificando que `|float − decimal| < 0.005` fila por fila.
2. Escritura doble durante una versión: el motor escribe ambas columnas. Las lecturas y sumas del libro pasan a Decimal (Prisma `Decimal` → `decimal.js`), sin aritmética de punto flotante en el servidor.
3. Una vez verificado, retirar las columnas `Float` con una migración destructiva separada y autorizada.
4. Alternativa equivalente: centavos enteros (`Int`/`BigInt`). Se prefiere Decimal(12,2) por compatibilidad con los reportes y con `Producto.precio`.

Sin cambios de dinero en B1.

## 4. Archivos

Commits (rama `work/f10-b1-cashier-operations`, integrados por fast-forward `e72c61b..ea276ca`):
- `0d033983874a69e5828e04f9f86a812068884ac0` feat: add caja operational area for generic businesses
- `03baa1b0fd4a03b473b410b95a3b464e2cf3dd48` feat: add cashier catalog and sale routes on the shared caja engine
- `ea276ca27bcb048bb6fdecbb57569087cbb69c19` feat: add mobile cashier screen to DeliGO Operaciones

| Archivo | Cambio |
|---|---|
| `src/lib/area-operativa.ts` | área `caja`; `areaOperativaRequiereSalon` la excluye; `AREA_CAJA_RUBRO`, `areaOperativaDisponibleEnNegocio` (Salón + rubro) |
| `src/lib/operativo-mozo.ts` | el resolver personal exige además el rubro del área (`rubro` en el select y en el tipo) |
| `src/app/api/operativo/me/route.ts` | sólo expone áreas disponibles en el negocio (incluye el rubro) |
| `src/app/api/negocio/empleados/route.ts`, `[id]/route.ts` | allowlist + `caja`; 409 si el negocio no es genérico |
| `src/components/business/salon-tab.tsx` | opción "Caja" sólo con `rubro === "negocio"` |
| `src/app/mozo/page.tsx` | etiqueta "Caja" + botón "Abrir Caja" (panel personal) |
| `src/lib/caja-catalogo.ts` | **nuevo** — `anotarDisponibilidadCaja` (lógica F9-D5 extraída sin cambios) + `CAJERO_PRODUCTO_SELECT` |
| `src/lib/operativo-caja.ts` | **nuevo** — respuesta de falla de acceso y `ventaParaCajero` |
| `src/app/api/operativo/caja/[slug]/productos/route.ts` | **nuevo** — catálogo del cajero |
| `src/app/api/operativo/caja/[slug]/ventas/route.ts` | **nuevo** — venta del cajero |
| `src/lib/caja-venta-service.ts` | `parseVentaCajaRequestBody` compartido; replay sólo al mismo actor |
| `src/app/api/negocio/caja/ventas/route.ts` | usa el parser compartido (mismos mensajes) |
| `src/app/api/negocio/productos/route.ts` | usa `anotarDisponibilidadCaja` (mismo resultado) |
| `src/components/business/caja-tab.tsx` | `CajaVenderSource` + `ownerCajaSource` (el dueño conserva endpoints, claves de consulta y alcance del intento); `VenderView` exportado |
| `src/app/operaciones/mi-panel/[slug]/caja/page.tsx` | **nuevo** — pantalla del cajero |
| `src/lib/f10-b0-static-contract.test.ts` | "todavía no hay cajero" → "la ruta del cajero reutiliza el motor único" |
| `src/lib/f9-barcode-static-contract.test.ts`, `src/components/business/managed-categories-static-contract.test.ts` | literales reubicados (`source.ventasUrl` / `ownerCajaSource`), misma intención |
| tests nuevos | `src/lib/f10-b1-cashier.integration.test.ts` (real DB), `src/app/operaciones/mi-panel/[slug]/caja/page.test.tsx`, `src/lib/f10-b1-static-contract.test.ts` |

**Sin cambios de schema ni migraciones.** `areaOperativa` ya era `String`.

`prisma/migrations/migration_lock.toml` sigue sin seguimiento (preexistente, no tocado ni versionado).

## 5. Autorización (siempre en el servidor)

`resolveOperativoAreaForSlug(req, slug, "caja")` (`src/lib/operativo-mozo.ts`) es la única puerta de las dos rutas del cajero:
- sesión personal de DeliGO Operaciones (`CuentaOperativa`, cookie operativa), nunca la sesión del dueño ni la de una terminal compartida;
- negocio del slug **aprobado**, **no suspendido**, con empleados habilitados y **rubro `negocio`** (`areaOperativaDisponibleEnNegocio`);
- vínculo `Empleado` **activo y no eliminado** de esa cuenta **en ese negocio**, con área efectiva `caja`.

Fallas:
- sin sesión → 401 `sin_sesion`;
- negocio no disponible, rubro no genérico, empleado inactivo/eliminado o slug ajeno/inexistente → 403 `acceso_no_disponible`;
- otra área → 403 `area_no_habilitada`.

`negocioId` y `empleadoId` salen **sólo** de esa resolución. El cuerpo nunca elige negocio, empleado, actor, precio, total ni turno: sólo se pasa a `parseVentaCajaRequestBody`, la misma validación y los mismos mensajes que la ruta del dueño.

`/api/operativo/me` y el panel personal muestran el área Caja sólo cuando el negocio la admite. Las mutaciones `/api/operativo/**` ya pasan por la protección de origen del proxy.

## 6. Venta e idempotencia

- **Motor único:** misma transacción Serializable que el dueño:
  - precios del servidor;
  - plan de stock R3A contra el disponible (físico − reservas ACTIVA);
  - Venta + VentaItem;
  - stock y `MovimientoInventario` una sola vez;
  - `CobroVenta`;
  - libro de efectivo.
- **Actor:** `actorTipo=EMPLEADO`, `actorId=empleadoId=` el empleado de la sesión. El motor revalida que sea activo del mismo negocio. La operación financiera de efectivo también queda con actor EMPLEADO. Auditoría `venta.creada` con `userType="empleado"`.
- **Sin `turnoId`** (no existe hasta B2).
- **Idempotency-Key obligatoria:**
  - sin clave o clave mal formada → 400 `IDEMPOTENCY_KEY_REQUIRED`;
  - replay exacto → 200 + `Idempotency-Replayed: true`;
  - otro contenido → 409 `IDEMPOTENCY_KEY_REUSED`;
  - solicitudes concurrentes con la misma clave → una sola venta.
- **Replay acotado al actor (nuevo en el motor, aplica también al dueño):** sólo se devuelve la venta a quien la creó (dueño = `negocioId`, cajero = su `empleadoId`). La huella de contenido no cambió, así que las ventas F10-B0 ya registradas siguen pudiendo reproducirse por su autor.
- **Cliente:**
  - el intento pendiente se guarda en `sessionStorage` con alcance `operativo:<empleadoId>:<negocioId>`: nunca se recupera en otro negocio, por otro empleado ni en la Caja del dueño (que conserva su alcance anterior);
  - sin conexión no se envía nada;
  - incierto → misma clave;
  - 401/403 → la pantalla sale de la venta.
- **Respuesta al cajero:** sólo su venta (`id`, `total`, `metodoPago`, `cantidadItems`, `createdAt`, ítems).

## 7. Seguridad del futuro cierre ciego

El cajero **no** recibe, por ninguna de sus rutas:
- efectivo esperado ni diferencias;
- totales por medio de pago;
- resumen ni ventas del día del negocio;
- saldos de Mercado Pago;
- movimientos financieros;
- ventas de otros cajeros;
- costos ni descuentos de configuración.

La cookie operativa **no** abre las rutas del dueño (verificado con base real):
- `GET` / `POST /api/negocio/caja/ventas`;
- `GET /api/negocio/productos`, que incluye costo;
- `GET /api/negocio/inventario/movimientos`.

Un contrato estático impide que el código del cajero lea ventas, cobros, libro, cuentas, reservas o movimientos, y que la página use `CajaTab` / `ResumenView` o cualquier `/api/negocio/*`.

## 8. Pruebas

Nuevos — **40 pass / 0 fail**:

| Archivo | Resultado | Cubre |
|---|---|---|
| `f10-b1-cashier.integration.test.ts` (real DB TESTING, huella `d64be28f676e`) | 23/0 | **Autorización:** sin sesión → 401; sesión del dueño en rutas del cajero → 401; áreas mozo/salon/pyr/sin_asignar → 403; cajero inactivo/eliminado → 403; negocio suspendido/no aprobado/empleados desactivados → 403; Restaurante/Ropa con `caja` en los datos → 403; slug de otro negocio y producto ajeno → sin escritura; slug inexistente → 403; `/api/operativo/me` sólo muestra Caja en el genérico. **Catálogo:** sin costo/descuentos/negocioId, disponible = físico − ACTIVA, sin eliminados ni ajenos, no-store. **Venta:** 201 con actor EMPLEADO + `empleadoId` de la sesión, sin turno, precio del servidor (cuerpo que intenta elegir negocio/empleado/actor/precio/total/turno ignorado), cobro + pata de efectivo una vez, stock una vez, auditoría `empleado`; transferencia sin libro; cuerpo inválido → 400 con los mensajes del dueño; faltante físico → 409; **reserva R3A ACTIVA respetada** (409 `STOCK_RESERVED_FOR_ORDERS`, la unidad libre sí se vende, la reserva intacta). **Idempotencia:** sin clave / vacía / mal formada → 400; replay 200 (también en mayúsculas) y otro contenido → 409 sin escrituras; **6 solicitudes concurrentes → 1 venta**; misma clave por otro cajero o por el dueño → 409; misma clave en dos negocios → dos ventas. **Acceso:** la cookie operativa no abre `GET`/`POST /api/negocio/caja/ventas`, `GET /api/negocio/productos` ni `GET /api/negocio/inventario/movimientos`; el catálogo no trae ventas/totales/efectivo ni datos de otros cajeros. **Administración:** alta y edición con `caja` OK en genérico y 409 en Restaurante/Ropa |
| `page.test.tsx` (happy-dom, página real + `VenderView` real) | 4/0 | sólo endpoints operativos (ninguna llamada a `/api/negocio/*`), clave UUID en el POST; intento incierto con alcance empleado+negocio (no lo ve otro empleado ni la Caja del dueño; la recarga reutiliza la clave); 401 → login personal, `area_no_habilitada` → panel, `acceso_no_disponible` → mensaje sin venta; 403 durante el cobro → sale de la venta |
| `f10-b1-static-contract.test.ts` | 13/0 | reglas puras del área (Salón no requerido, sólo genérico, otras áreas sin cambio, `AREA_CAJA_RUBRO === STOCK_LIFECYCLE_RUBRO`); allowlists sincronizadas; rutas sólo vía el resolver personal con `caja`, sin sesión de dueño/terminal/rol/permisos; clave obligatoria y motor único con actor de la sesión; cuerpo sólo al parser; replay por actor; sin lecturas de ventas/cobros/libro/cuentas/reservas/movimientos en el código del cajero; select del catálogo sin costo/descuentos; página sin `CajaTab`/`ResumenView`/`/api/negocio/*`; panel personal enlazado; sin migración nueva |

Regresiones (cada archivo en su propio proceso, secuencial, guardia de huella TESTING al inicio; incluye los 3 archivos nuevos): **133 archivos, 1679 pass / 24 fail en la primera pasada.** Clasificación de las 24:
- **1 causada por B1 y corregida:** `managed-categories-static-contract` exigía el literal de la clave de categorías del dueño dentro de `VenderView`; ahora vive en `ownerCajaSource`. Se actualizó para exigir la misma clave y el mismo endpoint del dueño en su nueva ubicación → 10/0.
- **5 preexistentes, idénticas en una copia limpia de `e72c61b`:** `catalog-tutorial-static-contract` 1, `category-filter-operational-static-contract` 1 (el literal de carrito ya había cambiado en F10-B0), `product-variants-static-contract` 2 (fallas CRLF conocidas), `operativo-logout-wiring-static-contract` 1.
- **10 de entorno** en `google-oauth-consent-gate.integration`: faltaba `GOOGLE_OAUTH_PENDING_SECRET` local. Con un secreto de prueba aleatorio quedan 11/2, y esas **2 son idénticas en `e72c61b`** (preexistentes; B1 no toca OAuth).
- **8 timeouts de 5 s** contra la base remota (`mesa-pedido-cancelacion` 2, `p2-t41-terminal-cierre-cuenta` 6). Con `--timeout 60000` pasan 72/0 y 7/0.

**Resultado: 0 fallas nuevas atribuibles a B1.**

Destacados: Caja B0 idempotencia (real DB, con el replay por actor) 11/0 · Caja route 21/0 · reservas Caja 14/0 · checkout idempotente del dueño 6/0 · escáner F9 Caja 7/0 · contratos F9 20/0, F10-B0 9/0, R3A I1/I2/I4/I5-P0/P0-F1 · stock-lifecycle/i3/i4 · Inventario · empleados · operativo-pyr-salon · Mozo/PyR/Salón · proxy · auth.

## 9. Gates

| Gate | Resultado |
|---|---|
| Tests F10-B1 nuevos | 40/0 (real DB 23/0) |
| Regresiones | 133 archivos; 0 fallas nuevas (ver §8 la clasificación de las preexistentes/entorno) |
| TypeScript (`tsc --noEmit`) | 35 errores, **conjunto idéntico** al de una copia limpia de `e72c61b` → 0 nuevos (todos en archivos no tocados: seed, auth, push, mapas, tests de location, etc.). El "0 errores" del informe F10-B0 no coincide con esta medición sobre `e72c61b`; se reporta la medición real |
| ESLint (21 archivos de B1 + contrato ajustado) | limpio |
| `prisma validate` / `generate` | válido (sin cambios de schema) / generado en el build |
| `next build` | OK (compiled, 160/160; rutas `/api/operativo/caja/[slug]/productos`, `/api/operativo/caja/[slug]/ventas`, `/operaciones/mi-panel/[slug]/caja`) |
| `git diff --check` / `--cached --check` | limpio |

## 10. Integración y deploy

- **Integración:**
  - rama `work/f10-b1-cashier-operations` publicada;
  - referencia de seguridad local `f10-b1-pre-integration-testing-codex` → `e72c61b`;
  - fast-forward `testing-codex` `e72c61b..ea276ca` (push sin force);
  - `main` sin cambios (`42ca500`).
- **Deploy TESTING:** `59d78750-0571-4fb9-a1ed-61b16333946b` SUCCESS, commitHash `ea276ca27bcb048bb6fdecbb57569087cbb69c19` (coincide). Los servicios auxiliares de TESTING también quedaron en `ea276ca` (SUCCESS).
- **Logs:** "39 migrations found", "No pending migrations to apply", "Ready", sin errores ni excepciones.
- **Smoke HTTP sin sesión:**
  - `GET /api/operativo/caja/x/productos` → 401;
  - `POST /api/operativo/caja/x/ventas` → 401 `sin_sesion`;
  - `GET /api/negocio/caja/ventas` → 401;
  - `/operaciones/mi-panel/x/caja` → 200 (la página resuelve el acceso contra el servidor);
  - `/negocio` → 200.
- **Base (sólo lectura, huella `d64be28f676e`):**
  - modo ON (config sin cambios desde 2026-10-08T17:51:08Z);
  - reservas ACTIVA 0 · CONSUMIDA 1 · LIBERADA 4;
  - 8 ventas históricas intactas, 0 ventas con clave/actor reales todavía, tablas del libro vacías;
  - 0 claves duplicadas, 0 cobros dobles o con importe distinto, 0 operaciones sin patas o entre negocios, 0 movimientos VENTA duplicados, 0 stock negativo;
  - 0 empleados `caja` (y 0 fuera de genéricos), 0 ventas de empleado inconsistentes;
  - 0 residuos de fixtures (`test-f10b1-*`, `test-f10b0-*`, `test-f9-*`, cuentas operativas de prueba).
- **Production** `6bf1ee84` @ `42ca500`: sin cambios.
- **Commit documental:** "docs: record F10-B1 cashier testing deploy" encima de `ea276ca` (ver CODEX_REPORT para su hash y deploy).

## 11. Smoke físico (pendiente del operador)

Preparación (dueño, en TESTING):
- usar un negocio **genérico** con algún producto con control de stock y, si es posible, uno con código de barras y otro con variantes;
- en **Salón → Mozos/Empleados**, activar empleados, crear (o editar) un empleado y asignarle el área **Caja**;
- vincular la cuenta personal de Operaciones del cajero con el código de incorporación (flujo existente).

Repetir en **iPhone Safari**, **iPhone PWA**, **Android Chrome** y **Android PWA**:

1. **Ingreso:** con la cuenta personal del cajero, entrar a DeliGO Operaciones → Mi panel. El negocio debe mostrar el área **Caja** y el botón **Abrir Caja**.
2. **Pantalla:** tocar "Abrir Caja". Se ve el nombre del negocio, "Vendiendo como <nombre>", el buscador, el botón del lector y el catálogo. No debe aparecer Resumen, totales del día ni efectivo esperado.
3. **Venta en efectivo:** agregar un producto, cobrar en Efectivo, confirmar → "Venta registrada". En el panel del dueño (Caja → Resumen) aparece la venta y el stock bajó una sola vez.
4. **Lector F9:** escanear un código cargado → se agrega al carrito; cobrar por Transferencia → registrada.
5. **Variantes / cantidades:** agregar un producto con variante y cambiar cantidades; cobrar → total correcto.
6. **Reintento sin duplicar:** activar el modo avión justo al tocar "Confirmar venta", volver a conectarse y confirmar de nuevo → **una sola** venta ("ya estaba registrada" o registro normal); verificar en el panel del dueño que no hay duplicado.
7. **Recuperación:** repetir el corte y recargar la página (o cerrar y abrir la PWA) → aparece "Hay un cobro sin confirmar" con el mismo carrito; confirmar o "Descartar este intento".
8. **Stock reservado:** con un pedido online que reserve todas las unidades de un producto, intentar venderlo desde la Caja del cajero → rechazo controlado, sin venta.
9. **Pérdida de acceso:** el dueño cambia el área del cajero (por ejemplo a "Sin área") o lo desactiva. Al reintentar vender o recargar, el cajero sale de la Caja y no puede registrar ventas.

Informar por cada paso y dispositivo PASS / FAIL / NO DISPONIBLE (con captura si falla). **No** se declara PASS físico sin esos resultados.

## 12. Riesgos y limitaciones

- **No es una Caja completa:** sin turnos, sin cierre ciego y sin efectivo por cajero. Las ventas en efectivo del cajero se suman a la cuenta de sistema `efectivo_caja_sin_asignar` igual que las del dueño (F10-B2 las separará por caja).
- **Asignación del área desde Salón:** el área se asigna desde la pestaña Salón (subpestaña Mozos/Empleados), visible en negocios genéricos. La palabra "Mozos" sigue siendo de restaurante (conocido desde P2-T56-R1).
- **Sesión por pestaña:** el intento pendiente vive en `sessionStorage`; si la PWA borra el almacenamiento se pierde, y el servidor sigue impidiendo duplicados sólo con la misma clave.
- **Sin offline** (D9).
- **Dinero en `Float`:** ver §3.
- **Checksum de TESTING:** ver §2.
- **Rendimiento:** mismas limitaciones de contención R3A (409 de serialización bajo escrituras simultáneas) ya conocidas.
- **Hallazgo lateral (no tocado):** `/api/negocio/caja` no figura en `NEGOCIO_ORIGIN_PROTECTED_PREFIXES` del proxy (preexistente, ruta del dueño). Las rutas nuevas del cajero sí quedan protegidas por el prefijo `/api/operativo`.

## 13. Rollback

- **Código:** `git revert` de los commits funcionales de F10-B1 en `testing-codex` + deploy de TESTING. No hay migración ni datos nuevos de esquema.
- **Datos:**
  - un empleado que quedó con `areaOperativa="caja"` tras el revert pasa a "Sin área asignada" (el valor desconocido se normaliza a `sin_asignar`) y pierde el acceso;
  - el dueño puede reasignarlo;
  - las ventas del cajero quedan como registro (actor EMPLEADO) y siguen visibles para el dueño.
- **Desactivación sin revert:** el dueño quita el área Caja o desactiva al empleado; el acceso se corta en la siguiente solicitud.

## 14. Dependencias para F10-B2

- `CajaFisica` (una por defecto) y `TurnoCaja`; `Venta.turnoId` con FK. La ruta del cajero deberá exigir un turno abierto propio y pasarlo al motor (único punto a extender).
- Cuentas de efectivo por caja (el libro ya admite varias); la venta del cajero pasará a la cuenta de su caja.
- Cierre ciego en dos fases con CAS e idempotencia: el cajero informa contado/entregado/fondo sin ver esperado ni diferencia (los contratos de B1 ya impiden esas lecturas).
- Resolver antes el riesgo de §3 (Decimal) y decidir la corrección de checksum de §2.
