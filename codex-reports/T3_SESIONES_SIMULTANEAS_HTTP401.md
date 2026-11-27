# T3 — sesiones simultáneas y HTTP 401 (P1-09, P1-10)

Fecha: 2026-11-26 · Agente: Claude Code · Autorización del operador: T3 (implementación, CI, push sólo de
`codex/estabilizacion-final`, consulta de Railway en solo lectura). Sin despliegue, sin TESTING ni Production modificados.

## Estado

**T3 — TÉCNICAMENTE APROBADA POR CI** en `3eb53576fc113edac427ea8df97c61202eac50d0` (run `45928752129`, job `140276213538`, 82/82 pasos). Implementado en `codex/estabilizacion-final`. **No certificado funcionalmente**: falta el
recorrido manual consolidado T1–T3 en Railway TESTING, después de un despliegue conjunto que requiere autorización.

| Dato | Valor |
|---|---|
| HEAD inicial | `8ca2053eb635d1a2c2ce7fa54bebf0eba14c1e69` (T2 aprobada por CI) |
| Commits | `47649e10` docs T2 · `95a52848` identidad · `36ffd1c6` consultas automáticas · `d8a445ed` pruebas y CI · `85044624` fixture T3 · `d5b9a575` docs T3 · `3eb53576` K2 de 23-A1 · docs finales de T3 |
| CI | **Final: run [`45928752129`](https://github.com/LeoCampos2504/DeliGO/actions/runs/45928752129), job `140276213538`, `completed/success` sobre `3eb53576`: 82/82 pasos OK** (T1, T2, T3, 23-A1 completa con K2, P2-T41, ciclo de cuentas operativas P2-T08, typecheck completo y build). Conteo de pruebas: no visible sin sesión de GitHub (verificar en el log). Antecedentes: run `45924972870` (`d8a445ed`) falló por el fixture T3 sin `Mesa.ocupacionActualId` → `85044624`; run `45925393874` (`85044624`) falló sólo en K2 de 23-A1 → `3eb53576` |
| Ramas | `main` `42ca5005` y `testing-codex` `327d6c73` sin cambios |

## Autoridad existente reutilizada (sin sistema nuevo)

- **Familias de sesión** (P2-T18 AUTH2): `deligo_session_cliente|negocio|repartidor` (Sesion), `deligo_operativo_session`
  (cuenta operativa), cookie de terminal propia, SuperAdmin aislado. La cookie legacy `deligo_session` sólo la completa el
  proxy cuando hay **exactamente una** credencial; con dueño + empleado en el mismo navegador queda vacía.
- **Selector `?actorFamily=`** fijado por cada pantalla (nunca por el usuario): sólo elige qué credencial validar.
- **BUG-002** `resolveMesaOccupancyActor` (familia declarada, 401/403/404/400) — reutilizado tal cual para la cuenta de mesa.
- **BUG-001** identidad visible del empleado (`empleado-identidad.ts`) y **BUG-003** superficies públicas: no tocados.
- Nuevo helper mínimo `src/lib/actor-family-session.ts`: lee la cookie de la familia pedida y la valida con
  `getUserFromToken` (misma autoridad); legacy sólo si falta la de familia y siempre comprobando el tipo; nunca otra familia.

## Matriz de rutas revisadas

| Superficie | Ruta(s) | Problema encontrado | Corrección |
|---|---|---|---|
| Cierre comercial de mesa | `GET/POST /api/operaciones/ocupaciones/[id]/cuenta` | Orden fijo dueño → operativa → terminal: con ambas sesiones el cierre del dueño quedaba como el empleado de Salón (`cerradaPorTipo/Id`) o 401; una cookie legacy del dueño podía elevar la pantalla de un empleado. El diálogo además consultaba la ocupación sin familia | Familia **obligatoria** (400 sin ella) + `resolveMesaOccupancyActor`; `MesaCuentaDialog` exige `actorFamily` y lo envía en las 3 llamadas; hosts: dueño `negocio`, Mozo y Salón personal `cuenta_operativa`, Salón de terminal `terminal`. Terminal sigue sin cerrar (P2-T41) |
| Cancelación de pedido de mesa | `POST /api/operaciones/pedidos/[id]/cancelar` | Mismo orden fijo: cancelación y auditoría (`canceladoPor`, `PedidoEvento`) con identidad equivocada; elevación posible con cookie legacy | Familia **obligatoria** + resolvedor por familia (mismas reglas 23-A1/P2-T41); diálogo y drawer la exigen |
| Notificaciones | `GET/PATCH/DELETE /api/notificaciones` | Campana del dueño (`feed=cuenta`) leía sólo la legacy → **401 cada 10 s** con un empleado en el navegador; el cliente convertía el 401 en «0» y seguía sondeando | `feed=cuenta&actorFamily=` valida esa familia; campana ligada al actor, se detiene ante 401/403 |
| Destacado | `GET/POST /api/destacado-solicitud` | Sólo legacy → 401 con dos credenciales; sondeo cada 30 s sin freno | Credencial explícita del dueño; sondeo con freno ante 401/403 |
| Denuncias | `GET/POST /api/denuncias` | Sólo legacy → el dueño rechazado con un empleado en el navegador | Credencial explícita del dueño (GET conserva la rama legacy de SuperAdmin) |
| Mozos/stats | `GET /api/mozos/stats` (y `/api/negocio/mozos/stats`, reexport) | Sólo legacy → 401 en la ruta neutral | Credencial explícita del dueño; fórmulas sin cambios |

### Rutas revisadas que no necesitaron cambios

- `GET/POST /api/operaciones/mesas/[id]/ocupacion` (BUG-002, certificada): ya resuelve por familia; todos sus consumidores la
  declaran. Conserva su rama de compatibilidad sin selector (límite residual, abajo).
- `/api/negocio/*` (familia derivada del path por el proxy), `/api/operativo/*` (usan `deligo_operativo_session`), chat,
  push y `auth/me` (ya en el allowlist del selector): sin el problema investigado.
- Reglas comerciales, importes, estados, cobros, Caja, stock, idempotencia, Web Push: sin cambios.

## T3-02 — clasificación de los 116 HTTP 401

Evidencia disponible: el registro del Bloque 4 (verificación complementaria C3/C4 en TESTING, ~45 min, dueño y cajero
operando a la vez): 110 × `GET /api/notificaciones` y 6 × `GET /api/destacado-solicitud`, sin 5xx. **No hay en el repositorio
logs por petición** (cookies, pestaña, instante) que permitan atribuir cada rechazo.

| Causa | Evidencia | Clasificación |
|---|---|---|
| **G. Sesiones simultáneas** (dueño + cuenta operativa: el proxy deja vacía la legacy y la ruta sólo leía la legacy) | Mecanismo reproducido de forma determinista en PostgreSQL efímero (`feed=cuenta` sin familia con ambas cookies → 401; ver suite T3). Volumen y rutas coherentes: la campana del dueño sondea cada 10 s y destacado cada 30 s, y en C3/C4 ambas sesiones convivían | **Causa principal comprobada en el código; atribución individual de cada uno de los 116: no determinada** |
| **C. Polling sin sesión válida** | La queryFn convertía el 401 en vacío y seguía cada 10/30 s — amplificaba G en cada ciclo | Comprobada como amplificador (corregida) |
| A. Antes de la hidratación / E. credencial vencida | Posible a lo sumo un rechazo por pestaña (store persistida antes de `/api/auth/me`) | No determinada; ahora como mucho 1 rechazo y se detiene |
| B. Después de logout / D. pestaña antigua | El logout limpia la store y la campana deja de consultar; una pestaña antigua sigue con su bundle previo hasta recargar | No determinada |
| F. Familia incorrecta | Las campanas personales no declaraban familia | Corregida (declaran `actorFamily`) |
| H. Rechazo legítimo | Se conservan todos los 401/403 del servidor | — |
| I. Otra causa | Ninguna encontrada | — |

No se declaran resueltos los 116: se corrigió el mecanismo comprobado; la confirmación es la ausencia de esos 401 en el
recorrido manual de TESTING con dueño y empleado simultáneos.

## Pruebas

- **Nuevas:** `t3-sesiones-simultaneas.integration.test.ts` (PostgreSQL efímero, fail-closed): 11 casos — dueño + Salón /
  cajero / PyR / mozo en el mismo navegador, identidad registrada en `cerradaPorTipo/Id`, `canceladoPor` y `PedidoEvento`,
  sin fallback, credencial vencida con otra válida al lado, actor inactivo, otro negocio (404), terminal, cookie legacy sin
  elevación, y **sin efectos** en ocupación, pedido, eventos, notificaciones, solicitudes y denuncias rechazadas.
  `notification-center.t3.test.tsx` (happy-dom + React Query real): sin actor no consulta; familia declarada; refetch al
  foco; logout; 401 detiene sondeo y foco y limpia el contador; cambio de actor; respuesta tardía del actor anterior.
  Control por mutación: quitar el freno o la clave por actor hace fallar 3 de 6. `t3-identidad-static-contract.test.ts`.
- **Reutilizadas y ahora en CI:** `mesa-pedido-cancelacion.test.ts` (23-A1), `p2-t41-terminal-cierre-cuenta.test.ts`,
  `p2-t08-operational-account-lifecycle.integration.test.ts`, `mesa-pedido-cancelacion-client/ui-contract`; ya estaban:
  BUG-002 `mesa-ocupacion-familia`, F4-A (`f4-a-devoluciones`, campana), `notification-center.test.ts`.
- **Ajustes a pruebas existentes (sin debilitar):** las llamadas de ruta declaran la familia de la credencial que envían;
  P2-T41 casos 3 y 4 pasan al contrato BUG-002 (otro negocio 404 en vez de «401 o 403»; terminal sin área de Salón 403 en
  vez de 401).

## Preservación de T1 y T2

No se tocaron punto de venta, carrito, inicio de venta, precios, permisos granulares, bloqueos `FOR SHARE`,
`bloquearPrecioYEtiquetasEnTx`, retries P2034/P2010-40001, autoridad de stock, C5, importaciones, venta sin precio ni
ocultamiento de costos. Todas sus suites siguen en el workflow y pasaron en el run `45928752129`.

## Railway (solo lectura, por IDs, 2026-11-26)

- Proyecto `amiable-rejoicing` `49d4d9c7-d095-4002-834e-247198c6b6b9`: entornos **TESTING** `f37d0c49-b737-49e8-be89-a00c13734fae`
  y **production** `f96adff2-4496-47e8-9d3d-f8fa78b855fc`. La discrepancia de Codex se explica: los servicios enlazados a `main`
  que vio son los del entorno production (consulta por defecto).
- TESTING: **DeliGO Copy** `c6335604-063a-4a10-9c82-b0acb9e8ca7a`, rama `testing-codex`, deployment `8ac0f58f-ebc4-4529-a31f-7e3654959bb5`
  SUCCESS sobre `327d6c739a55e2f6b5da89f1ec125a24013eb345`, dominio `deligo-copy-production.up.railway.app`, pre-deploy
  `prisma migrate deploy`, `checkSuites: false` (despliega al recibir push, sin esperar CI). Auxiliares en `testing-codex`:
  chat en vivo, Review Moderation Expiry (cron horario), Mesa Occupancy Cron (cada 15 min); Postgres propio con volumen.
- Production: DeliGO, chat, crons en `main` (deployments `ccc2184a`, `898bf9d9`, `d22d6077`, `861b79f1`).
- **Ningún servicio sigue `codex/estabilizacion-final`**: el push de esta rama no despliega. No se leyeron valores de variables.

## Propuesta de despliegue conjunto T1–T3 en TESTING (NO ejecutada; requiere autorización expresa)

1. Confirmar CI verde sobre el HEAD a desplegar y que `origin/testing-codex` sigue en `327d6c73`.
2. Respaldo lógico de la base de TESTING (`pg_dump`, SHA-256 registrado) y comprobar que la rama no agrega migraciones
   (`git diff 327d6c73..HEAD -- prisma/migrations` vacío; T1–T3 no tocan migraciones).
3. `git push origin <HEAD>:refs/heads/testing-codex` (fast-forward, sin force); Railway despliega DeliGO Copy y auxiliares.
4. Verificar deployment SUCCESS con `commitHash` exacto, `migrate deploy` sin migraciones nuevas y logs sin 5xx; smoke de
   rutas sin sesión (401 esperados).
5. Recorrido manual consolidado (abajo) y revisión de evidencia (HTTP, logs, SQL de solo lectura).

## Recorrido manual consolidado para TESTING (después del despliegue)

URL: `https://deligo-copy-production.up.railway.app` · dueño y empleados ficticios de TESTING · móvil y escritorio, claro y oscuro.

1. **T1 (9 correcciones):** lista de `CONSOLIDACION_FINAL_PRODUCTION_PLAN.md` §17.3 — punto de venta reorganizado, el carrito
   y el inicio de venta sobreviven al abrir/cerrar turno, permisos vencidos desmarcados, cuadro de variantes con el precio
   guardado, textos/formularios de proveedores, «Todas las variantes», límites de importación.
2. **T2 (focalizado):** empleado con permiso de catálogo revocado no puede crear/editar; venta de producto sin precio
   rechazada; etiqueta pendiente bloquea al empleado y el dueño puede reemplazarla; importación pequeña con un costo y una
   etiqueta pendiente.
3. **T3, mismo navegador con dueño (pestaña /negocio) y empleado de Salón o cajero (pestaña /operaciones) conectados:**
   a. Campana del dueño: muestra sus avisos y el contador; la del empleado, los suyos. Logs: **sin 401** de
      `/api/notificaciones` ni `/api/destacado-solicitud` mientras ambas sesiones son válidas.
   b. Dueño → Salón → «Ver cuenta» y «Cerrar cuenta» de una mesa: SQL `cerradaPorTipo='negocio'`.
   c. Empleado de Salón → misma acción en otra mesa: `cerradaPorTipo='salon'`, `cerradaPorId` = su empleado.
   d. Cajero/PyR → no ve ni cierra cuentas (403), sin cambios en la ocupación.
   e. Cancelar un pedido de mesa desde el dueño y otro desde Salón: `canceladoPor` `negocio_admin` / `salon_personal` y el
      `PedidoEvento` con el actor correcto; PyR no puede.
   f. Dashboard del dueño → destacado carga; estadísticas de mozos en Salón; denunciar un cliente desde Pedidos.
   g. Logout del empleado: la campana del dueño sigue funcionando; cerrar sesión del dueño: su campana deja de consultar
      (a lo sumo un 401 y se detiene).
4. Evidencia: logs HTTP del intervalo, consultas SQL de solo lectura sobre `sesiones_ocupacion_mesa`, `pedidos`,
   `pedido_eventos`, `notificaciones`, `destacado_solicitudes`, `denuncias`.

## K2 de 23-A1 (autorizada por el operador, alternativa B)

- **Regla confirmada:** `preparando` es cancelable (`ESTADOS_PENDIENTES_MESA`, `src/lib/mesa-cuenta.ts:42`; caso F.1 de la
  suite). `cancelarPedidoMesa` no reintenta (P2034 → `conflict`). Si el avance `recibido → preparando` confirma antes de que
  la cancelación lea el pedido, la cancelación parte de `preparando` y su CAS prospera: ejecución en serie legítima. No se
  encontró regla comercial que exija que sólo una de las dos operaciones prospere.
- **Corrección (sólo la prueba):** K2 acepta exactamente A) cancela desde `recibido` + avance 0, B) cancela desde `preparando`
  + avance 1, C) conflicto + avance 1 + `preparando` sin evento. Refuerza: `estadoAnterior` igual al estado que dejó el avance
  (nunca ambos desde `recibido`), un único evento con actor/motivo/estado anterior reales, sin errores inesperados, ningún
  avance después de cancelado y segunda cancelación rechazada sin duplicar. Lógica comercial sin cambios.

## Certificación funcional T1–T3 en TESTING (2026-11-27)

- Despliegue: push `327d6c73..32cddd1e` a `testing-codex`, DeliGO Copy `084d76ad` SUCCESS (commit exacto), 69
  migraciones sin pendientes, 0 5xx; respaldo previo `deligo-testing-pre-t1-t3-20261127T024352Z.dump` SHA-256
  `28453218c77ac92d3d78d7c756537957df4bcb8c43d84420acc38e01d0ed910c`. CI del push `45930242578` SUCCESS. Production intacto.
- Operador: **28/28 aprobadas** (A1–A6, B1–B10, C1–C12). HTTP 02:53–03:26: 0 5xx; 0 HTTP 401 de `/api/notificaciones`
  con sesiones válidas; destacado sólo rechazos en logout, sin repetición.
- Verificación interna (`verificacion-t1-t3-20261127T034036Z.json`, solo lectura): turno QA abierto/cerrado (esperado =
  contado = 500), venta 700 con 1 cobro, salida 200, patas exactas, sin claves duplicadas, turno antiguo con huella
  igual; pago de 1800 asignado 1663,75 (saldo a favor 136,25); producto del 403 sin escritura; venta sin precio sin
  registros; etiqueta pendiente reemplazada por el dueño; cierres `negocio` y `mozo` y cancelaciones `negocio_admin` y
  `mozo` con un único evento cada una; denuncia en el negocio del pedido.
- **Aclaraciones del operador:** B8 — permisos temporales revocados manualmente después de la ventana (rechazo de
  escrituras aprobado). C5/C7 — hechos con el rol mozo; aprobados para ese rol; **pendientes** cierre comercial y
  cancelación como empleado de Salón personal con el dueño conectado.
- **Datos QA abiertos (no tocados):** ocupación activa `cmwyezwhg…` en la mesa 2 de `negocio_b` (pedidos cancelados) y
  un pedido de retiro en `recibido`.
- **Incidencia preexistente** (panel del mozo y Salón de terminal sin revalidar la ocupación): corrección `8eacd113`,
  pendiente de despliegue y prueba focalizada. Mejora del sondeo de `mesa-cuenta` ante 400: ROADMAP (no autorizada).

## Cierre formal T1–T3 (2026-11-27)

- Corrección `8eacd113` desplegada (`d72f8bdf`, DeliGO Copy `87d1c139`). Pruebas complementarias 8/8: M1–M3 (panel del
  mozo), T1–T3 (terminal; sin cierre comercial desde la terminal), S1 y S2 (Salón personal con el dueño conectado).
- S1 se repitió: la primera ejecución (04:11:13) quedó como `mozo` porque el área del empleado se cambió a Salón 34 s
  después (`empleado.area_cambiada` 04:11:47); la repetición (04:25:14) quedó `cerradaPorTipo='salon'`. S2 (04:14:22)
  `canceladoPor='salon_personal'` con un único evento.
- HTTP 04:01–04:16: 0 5xx, 0 403, sin series de 401; la ocupación se revalida una vez por mesa en cada lectura del panel.
- **T1, T2 y T3 CERTIFICADAS EN TESTING, 36/36.** Incidencias diferidas: paridad enlaces/QR (después de Production y
  T7), sondeo de `mesa-cuenta` ante 400, consulta periódica ante 403 persistente (revisión en T5).

## Reorganización Caja / Administración — alcance técnico mínimo (aprobada para antes de Production, NO implementada)

- Único archivo de navegación: `src/components/business/business-panel.tsx` (lista de pestañas principales) y
  `src/components/business/caja-tab.tsx` (subpestañas `vender | resumen | turnos | egresos | proveedores | compras |
  etiquetas`). Propuesta: nueva pestaña principal `administracion` (sólo rubro `negocio`, igual que Caja) que monte los
  mismos componentes `OwnerCompras`, `EtiquetasPrecioLista`, `OwnerProveedores` y `ResumenView`; Caja conserva
  `vender | turnos | egresos`. El salto Compras → «Ver proveedor» (`proveedorAbrir`) pasa a vivir dentro de
  Administración. Los avisos que navegan a pestañas (`navigateTo`) se mapean a la pestaña nueva; sin cambios de APIs,
  permisos ni datos.
- Se mueven con sus subpestañas las consultas de contadores (`recepcionesPendientes` → «Compras (N)»,
  `etiquetasPendientes` → «Etiquetas (N)»); el botón de Resumen «ir a vender» (`irAVender`) pasa a navegar a la
  pestaña Caja/Vender mediante `requestPanelNavigation` (respeta la guarda de navegación existente).
- Riesgos: avisos o enlaces que apunten a `caja` y a una subpestaña movida (mapa `tabMap` de `business-panel.tsx`);
  contratos estáticos que fijan la estructura de `caja-tab.tsx` (`caja-tab-responsive-static-contract`, `f10-b0`,
  `f10-b1`, `f10-c1c`, `f4-c5`, `f9-barcode` y otros) a actualizar sin debilitar; el menú principal del rubro negocio
  pasa de 8 a 9 pestañas, por lo que hay que comprobar 320–375 px (en móvil ya muestran sólo el ícono, E10) para no
  trasladar el desplazamiento horizontal; `VenderView` no debe desmontarse por la reorganización (invariante T1-01).

## Límites y pendientes

- **Compatibilidad residual (documentada, no eliminada):** `/api/notificaciones` sin `feed` (bundles anteriores a F4-A;
  su suite certificada la fija) y `mesas/[id]/ocupacion` sin selector (BUG-002). Ningún consumidor actual las usa.
  Proponer su retiro cuando Production tenga el bundle nuevo (T5/T6).
- Una pestaña abierta antes del despliegue envía la cuenta/cancelación sin selector → 400 hasta recargar (rechazo seguro).
- Los 116 rechazos históricos no se atribuyen individualmente (sin logs por petición).
- `operativo-logout-wiring-static-contract` (fuera de CI) falla también en la base `327d6c73` (`handleSendTestPush` no existe):
  preexistente, no tocado. Error ESLint preexistente en `operaciones/salon/page.tsx:921`, no tocado.
- Sin cambios: XLSX real de Excel (T5), F10-D1 (T4), `LATEST_SAMPLE_ONLY`, T54-R1, T44/T18/T31 condicionadas.
- Contradicciones de skills (`deligo-safe-task` §A, `deligo-closeout` §B) siguen registradas, sin modificar.
