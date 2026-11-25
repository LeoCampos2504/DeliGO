# Identidad de empleados vinculados («Pendiente de vinculación») y ocupación de Mesa 1 — diagnóstico R1

Fecha: 2026-11-24 · Tipo: diagnóstico de solo lectura (sin cambios de código, datos, TESTING ni Production).
Código revisado: `codex/integracion-compras-catalogo` = `origin/testing-codex` = `e6224a48` (lo desplegado en DeliGO Copy / TESTING).
Disparador: la preparación manual del Bloque 1 (`M11240504`) se detuvo correctamente porque la API de permisos de catálogo
devolvió «Pendiente de vinculación» (`cmuq91zhp0008ka0ab4fqenuj`, paola-vinal) en lugar de «TEST_T44_R1D_CUENTA_4135EA7A».
La preparación quedó detenida en la identificación del cajero, **antes de crear ningún dato QA**; sin línea base. Queda pendiente.

## 1. Modelo

- `CuentaOperativa` (persona, global): `nombre`, `email`, `activo`, `eliminado`; 1→N `Empleado`.
- `Empleado` (vínculo persona↔negocio): `nombre`, `codigo`, `rol`, `areaOperativa`, permisos de catálogo/anticipos,
  `negocioId`, `cuentaOperativaId?` (`onDelete: SetNull`), `@@unique([negocioId, cuentaOperativaId])`.
  Una cuenta con 4 negocios = 4 filas `Empleado` (una por negocio), cada una con su ID, permisos, mesas y historial.
- Alta sin nombre (`POST /api/negocio/empleados`, `route.ts:122-123`): `Empleado.nombre = "Pendiente de vinculación"`.
- Vinculación (`POST /api/operativo/mozos/unirse`, `route.ts:147-263`): fija `cuentaOperativaId`; **no** cambia
  `Empleado.nombre` (decisión documentada P2-T43-R2: el nombre de `Empleado` es dato heredado; la identidad visible de
  un vínculo activo se **proyecta** desde `CuentaOperativa.nombre`; el editor ya no permite editarla).

## 2. Causa raíz

**Dos fuentes de nombre y una regla de proyección que no está centralizada.** Por diseño, un empleado vinculado
conserva para siempre el marcador en `Empleado.nombre`; su nombre real sólo existe en `CuentaOperativa.nombre`.
La proyección se implementó **en dos lugares y con reglas distintas**:

| Lugar | Regla | Resultado para la cuenta del caso |
|---|---|---|
| `GET /api/negocio/empleados` (`route.ts:86-94`, Salón → Empleados) | vinculada y cuenta no eliminada → `CuentaOperativa.nombre` | correcto |
| `nombreVisibleEmpleado` (`src/lib/caja-nombre-empleado.ts:26-32`, sólo vistas de Caja del dueño) | nombre propio real gana; marcador/vacío → nombre de la cuenta | correcto |
| **Todos los demás lectores** | `Empleado.nombre` crudo | «Pendiente de vinculación» |

No es un problema de vinculación ni de datos: la cuenta está bien vinculada, el ID de empleado, los permisos, las mesas,
la auditoría y el historial están intactos (todos se relacionan por `Empleado.id`). Es un problema de **presentación de
identidad** en lectores que nunca adoptaron la proyección.

## 3. Endpoints y pantallas afectados (leen `Empleado.nombre` crudo)

Dueño
- `GET/PUT /api/negocio/empleados/permisos-catalogo` → `src/lib/catalogo-empleado-service.ts:187-188` (lista de permisos; la usa la preparación del Bloque 1) y `:174` (historial «quién» del catálogo).
- Salón (dueño): detalle de mesa / mozo asignado `src/components/business/salon-tab.tsx:987, 1477, 1929`; `src/app/api/negocio/mesas-assign/route.ts:162`; configuración `src/components/business/salon-config.tsx:1105`.
- Estadísticas: `src/app/api/negocio/empleados/stats/route.ts:144-150`, `negocio/salon/stats/route.ts:217-223`, `mozos/stats/route.ts:111-117` (`nombreActual` crudo; `nombreHistorico` = foto del pedido).
- Invitaciones: `src/app/api/negocio/mozos/invitaciones/route.ts:82, 213`.
- Compras / pagos / etiquetas / anticipos (actor por ID → nombre): `compras-recepciones-service.ts:1119`, `recepcion-pagos-service.ts:98`, `cuenta-proveedor-vista-service.ts:39-45`, `etiquetas-precio-service.ts:69-70`, `anticipos-pedido-http.ts:120-121`.
- Caja, cambios (dueño): `caja-cambios-http.ts:92-95, 180-182` (selecciona `nombre` crudo aunque el servicio usa el helper).

Cuenta operativa / terminal
- `GET /api/operativo/me` (`route.ts:121`) → cabecera de Caja del cajero «Vendiendo como …» (`operaciones/mi-panel/[slug]/caja/page.tsx:153, 198`; ya anotado como hallazgo visual conocido en CODEX_REPORT).
- `GET /api/operativo/caja/[slug]/productos` (`route.ts:40`).
- Mozo: `operativo/mozo/panel/[slug]/route.ts:170`; Salón operativo: `operativo/salon/panel/[slug]/route.ts:59, 117`, `operaciones/salon/panel/route.ts:50, 160-161` y `operaciones/salon/page.tsx:749, 796, 943`.
- Cancelación de pedido de mesa: `src/lib/mesa-pedido-cancelacion.ts:169, 175` (nombre del actor).

Fotos históricas (persistidas)
- `Pedido.empleadoNombre` se escribe al tomar el pedido (`operativo/mozo/panel/[slug]/pedidos/route.ts:1318`) con `Empleado.nombre`: los pedidos de mesa de un mozo vinculado guardan el marcador. Es historial: **no se reescribe**.
- `audit_logs.detalle` de `empleado.creado` guarda el nombre de alta (marcador): era verdad en ese momento; no se toca.

Superficies públicas (cliente final) — **fuera de la corrección, decisión aparte**
- `GET /api/empleados/by-codigo` (página pública `/mozo/[slug]`) devuelve `Empleado.nombre`. Proyectar ahí `CuentaOperativa.nombre` publicaría el nombre personal de la cuenta a clientes; requiere decisión de privacidad.

## 4. Alcance

- Integridad: sin impacto en IDs, permisos (`catalogo*`, anticipos), relaciones (mesas, ventas, turnos), auditoría (por `userId`/`recursoId`) ni historial. Ninguna escritura usa el nombre como clave.
- Multi-negocio: cada negocio ve su propia fila `Empleado`; la proyección sólo lee la cuenta enlazada a **esa** fila (sin mezclar negocios). Mostrar el nombre de la persona en cada negocio vinculado ya es la regla aprobada en Salón (P2-T43-R2).
- Controles: la preparación del Bloque 1 identifica al cajero por nombre **exacto**; con la corrección, la API devolverá el nombre real y el control pasa sin debilitarse.
- Inconsistencia de reglas: para un vinculado con nombre propio heredado distinto del de la cuenta, Salón muestra la cuenta y Caja el nombre propio. Hay que unificar (ver §6).
- Cuentas realmente pendientes (sin `cuentaOperativaId`, o cuenta eliminada) siguen mostrando «Pendiente de vinculación».
- Datos locales (`deligo_dev`, solo lectura): 0 empleados con marcador + vínculo; 0 pedidos con marcador; sin mesas. El caso sólo existe en TESTING (no consultado: acceso exclusivo del operador).

## 5. Mesa 1 — «No se pudo consultar la ocupación de la mesa» (problema distinto)

- La pantalla muestra ese texto tanto para **401** como para cualquier error (404/409/500): `mesa-occupancy-control.tsx:202-206` + `mesa-occupancy-client.ts:43-45`.
- `GET /api/operaciones/mesas/[id]/ocupacion` → `resolveMesaOccupancyCloseActor` (`src/lib/mesa-occupancy.ts:775-828`): 1) dueño por la cookie legacy `deligo_session`; 2) cuenta operativa con área efectiva `salon` o `mozo`; 3) terminal de Salón; si no → **401**.
- El inicio de sesión sólo escribe la cookie de su familia (`auth-session-cookie.ts`); el proxy (`src/proxy.ts:143-167`) copia esa cookie a `deligo_session` **sólo si hay exactamente una candidata** para rutas sin familia de path. `/api/operaciones/*` no tiene familia de path ni está en `SELECTOR_ENDPOINT_PREFIXES` (`proxy.ts:95-110`).
- **Causa más probable:** con la sesión del dueño (`deligo_session_negocio`) y la de la cuenta operativa (`deligo_operativo_session`) en el mismo navegador hay 2 candidatas → el proxy no reenvía ninguna → el dueño no se reconoce; la cuenta operativa del cajero (área `caja`) no está autorizada para ocupación → **401** → el mensaje. Es exactamente la clase documentada **F-P2-T18-AUTH02** (resuelta en 2026-08 sólo para chat/push), sin cubrir este endpoint.
- Alternativas a descartar con evidencia: 409 «estado de ocupación inconsistente», 500, o un actor operativo sin área salon/mozo (devuelve 401 cuando semánticamente es 403).
- Relación con «Pendiente de vinculación»: **ninguna** en la causa (la ocupación no usa nombres); sólo coinciden en el detalle de la mesa, donde el nombre del mozo asignado sale crudo (§3).
- Confirmación para el operador (sin escribir nada): en ese navegador, abrir la Mesa 1 con DevTools → Red y anotar el código de `GET /api/operaciones/mesas/<id>/ocupacion`; repetir en una ventana privada con **sólo** la sesión del dueño.

## 6. Propuesta de corrección (para aprobar; nada implementado)

A. Identidad (lectura, sin migraciones ni escrituras)
1. Un único módulo `src/lib/empleado-identidad.ts` (re-exportado desde `caja-nombre-empleado.ts`): `nombreVisibleEmpleado`, `EMPLEADO_NOMBRE_SELECT` y `mapaNombresVisibles(db, negocioId, ids)` para los lectores por ID. Regla unificada recomendada (alineada con P2-T43-R2 y con Salón): vínculo activo (cuenta no eliminada) → `CuentaOperativa.nombre`; si no → `Empleado.nombre` (el marcador sigue siendo verdad para los pendientes). **Decisión del operador:** confirmar «la cuenta gana» frente a «el nombre propio heredado gana» (hoy Caja usa la segunda).
2. Aplicarlo en todos los lectores de §3 (dueño y operativos), filtrando siempre por el `negocioId` de la sesión.
3. Fotos históricas: no se reescriben; las vistas que muestran `Pedido.empleadoNombre` usan el nombre visible actual cuando la foto es el marcador y el pedido tiene `empleadoId`. Pedidos nuevos: la foto toma el nombre visible.
4. Superficies públicas (`by-codigo`): sin cambio en esta corrección; decisión de privacidad aparte.
5. Nunca: renombrar en la base, tocar vínculos, cuentas, auditoría o historial.

B. Ocupación de mesa (separado)
1. `resolveMesaOccupancyCloseActor`: leer explícitamente la cookie de familia del dueño (`deligo_session_negocio`) y, si falta, la legacy; misma validación (`userType = negocio` y `userId = negocioId`). Alternativa: selector explícito como en AUTH02.
2. Cuenta operativa válida sin área autorizada → 403 (no 401).
3. UI: distinguir «sesión no reconocida», «sin permiso» y «error/inconsistente».

## 7. Pruebas de regresión propuestas (focalizadas, según la metodología vigente)

- Unidad `nombreVisibleEmpleado`: vinculado con marcador → cuenta; vinculado con nombre heredado → según la regla aprobada; pendiente → marcador; cuenta eliminada → nombre de `Empleado`; vacío → «Empleado».
- Integración (PostgreSQL, patrón de `caja-nombre-empleado.integration.test.ts`): una cuenta vinculada a 2 negocios (A con marcador, B con nombre heredado) + un pendiente en A + un empleado de un negocio C. Comprobar en A: permisos de catálogo e historial, `operativo/me`, panel de Salón/mesa y stats → nombre de la cuenta con el **mismo ID** y los **mismos permisos**; el pendiente sigue «Pendiente de vinculación»; A nunca lista empleados de B ni de C; ninguna escritura (`Empleado.nombre` sigue con el marcador; conteo de `audit_logs` sin cambios).
- Ocupación: dueño + cuenta operativa en el mismo navegador → 200 para el dueño; cajero de área `caja` solo → 403; mozo no asignado → 403; terminal de Salón → 200.
- Actualizar las pruebas existentes afectadas (`salon-tab-employee-identity-feedback`, `negocio/empleados/route.test`, `caja-nombre-empleado*.test`).
- Validación manual: localhost con una cuenta vinculada a dos negocios ficticios; luego, con autorización, el operador en TESTING (Salón, permisos de catálogo, Caja del cajero, Mesa 1).

## 8. Estado

- Bloque 1 manual: **detenido** hasta la corrección; la etiqueta `M11240504` se reutilizará (no se creó ningún dato QA).
- Sin cambios de código, datos, TESTING ni Production. Sin commits.
