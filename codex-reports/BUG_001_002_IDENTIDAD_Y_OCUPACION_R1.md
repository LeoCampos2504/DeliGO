# BUG-001 (identidad de empleados vinculados) y BUG-002 (ocupación de mesa con sesiones simultáneas) — corrección local R1

Fecha: 2026-11-24 · Autorización: implementación y pruebas **sólo locales** desde `e6224a48` (operador). Sin commits, push,
despliegues, migraciones ni cambios en TESTING/Production. Diagnóstico previo: `EMPLEADO_IDENTIDAD_VINCULACION_DIAGNOSTICO_R1.md`.

- Código: `C:\Leo Campos\Trabajo\deligo-dev-local`, rama local `codex/fix-identidad-ocupacion` (desde `e6224a48`, sin commits; cambios en el árbol de trabajo).
- Parches separados (aplican solos y en cualquier orden sobre `e6224a48`; juntos reproducen exactamente el árbol probado):
  - `C:\Users\eltig\deligo-dev-db\bugfix-001-002\BUG-001-identidad-empleado.patch` — 32 archivos — SHA-256 `8cc742cf…8525`
  - `C:\Users\eltig\deligo-dev-db\bugfix-001-002\BUG-002-ocupacion-sesiones.patch` — 12 archivos — SHA-256 `18900ffe…6cad`

## BUG-001 — identidad centralizada

**Regla única** (`src/lib/empleado-identidad.ts`): vínculo activo (cuenta no eliminada, con nombre) → `CuentaOperativa.nombre`,
aunque `Empleado.nombre` tenga otro nombre heredado (decisión del operador); sin vínculo → `Empleado.nombre` (el marcador
«Pendiente de vinculación» es entonces verdad); sin dato → «Empleado». Sólo lectura: nada se escribe, renombra ni revincula.
Helpers: `nombreVisibleEmpleado`, `EMPLEADO_NOMBRE_SELECT`, `mapaNombresVisibles(db, negocioId, ids)` (sólo filas del negocio
consultado), `conNombresHistoricosVisibles` / `nombreHistoricoVisible` (fotos históricas). `caja-nombre-empleado.ts` queda como
reexportación compatible (su regla anterior —«el nombre propio gana»— se reemplaza por la aprobada).

Aplicada en: permisos y autoría de catálogo (`catalogo-empleado-service`); Caja del dueño (`caja-cambios-http`, fondos
remanentes en SQL de `caja-turnos-service`) y del cajero (contexto operativo `operativo-mozo.resolveOperativoAreaForSlug` y
`/api/operativo/me` → «Vendiendo como…»); paneles operativos (mozo, Salón personal y terminal); Salón y mesas del dueño
(`/api/negocio/mesas`, `mesas-assign`, selector de mozo en `salon-tab`, `salon-config`); estadísticas (empleados, Salón, mozos);
compras y recepciones; proveedores y pagos (`cuenta-proveedor-vista`, `recepcion-pagos`); etiquetas; anticipos; invitaciones;
pedidos (lista del dueño, panel e historial de Salón, detalles operativos) y cancelaciones (`mesa-pedido-cancelacion`).

**Históricos:** `Pedido.empleadoNombre` no se modifica. Sólo si la foto es exactamente el marcador y hay relación inequívoca
(mismo `empleadoId`, fila del mismo negocio, vínculo activo) se MUESTRA el nombre actual; las respuestas agregan
`empleadoNombreRegistrado` (foto intacta) y `empleadoNombreResuelto` (true cuando se mostró el nombre actual).
**Pedidos nuevos** del mozo guardan la identidad resuelta. **Páginas públicas sin cambios** (`/api/empleados/by-codigo`,
`/api/negocio/mesas-public`).

## BUG-002 — familia de sesión en `GET/POST /api/operaciones/mesas/[id]/ocupacion`

**Reproducido en localhost antes de corregir** (cookies reales del navegador): sólo dueño → 200; dueño + cuenta operativa en
el mismo navegador → **401**. **Causa raíz confirmada:** `/api/operaciones/*` no tiene familia por ruta; el proxy sólo copia una
cookie de familia a la legacy `deligo_session` con exactamente UNA candidata; con dos no copia ninguna y el handler (que sólo
leía la legacy para el dueño) no lo reconocía; la cuenta operativa (área caja) no está autorizada → 401 genérico.

**Corrección** (`mesa-occupancy.ts: resolveMesaOccupancyActor`): la pantalla declara su familia (`?actorFamily=negocio |
cuenta_operativa | terminal`, fijada por cada host, nunca por el usuario) y se valida EXCLUSIVAMENTE esa credencial con las
reglas de siempre. El selector no otorga nada; una pantalla operativa nunca usa la sesión del dueño. Sin selector se conserva el
orden anterior (compatibilidad). Códigos: 401 sin credencial válida · 403 credencial del negocio sin permiso (caja/PyR, mozo no
asignado) · 404 credencial de OTRO negocio o mesa inexistente (no revela la mesa) · 400 selector inválido · 409 inconsistente ·
500 error interno (nuevo try/catch en GET). Sesión de dueño vencida ahora se rechaza. Cliente/UI: `mesa-occupancy-client` y
`MesaOccupancyControl` distinguen sesión, permiso, mesa, inconsistencia y error con mensajes propios; hosts: Salón del dueño
`negocio`, panel del mozo y Salón personal `cuenta_operativa`, Salón de terminal `terminal`. El resolvedor anterior
(`resolveMesaOccupancyCloseActor`) queda intacto para las rutas ajenas.

### Otros endpoints neutrales con el mismo mecanismo (documentados, NO modificados)
| Endpoint | Efecto con dueño + cuenta operativa en el mismo navegador | Alcance |
|---|---|---|
| `/api/operaciones/ocupaciones/[id]/cuenta` GET/POST (mismo resolvedor) | «Ver cuenta» / cierre comercial de mesa del dueño falla (401) | Alto en Salón: siguiente candidato, misma técnica |
| `/api/operaciones/pedidos/[id]/cancelar` (`mesa-pedido-cancelacion`) | el dueño no se reconoce al cancelar pedidos de mesa | Medio |
| `/api/notificaciones`, `/api/destacado-solicitud`, `/api/denuncias`, `/api/mozos/stats` (leen la cookie legacy) | llamadas del dueño en 401 mientras conviven ambas sesiones (p. ej. campana de avisos) | Medio; clase F-P2-T18-AUTH02 |
| `/api/operativo/*` que también leen la cookie legacy | sin evaluar en detalle (usan la cookie operativa propia) | A revisar |

## Pruebas (todas locales; base desechable `deligo_ci`, nunca `deligo_dev`)

- Nuevas: `empleado-identidad.test.ts` 9/9 · `empleado-identidad.integration.test.ts` 5/5 (casos 1–7: vinculado con marcador,
  heredado distinto, pendiente real, una cuenta en dos negocios, aislamiento, conservación de ids/vínculos/permisos/nombres/
  auditoría, permisos de catálogo, operativo/me, mesas del dueño, panel del mozo, **pedido nuevo guarda la identidad**, fotos
  históricas) · `mesa-ocupacion-familia.integration.test.ts` 4/4 (casos 8–11: dueño solo, ambas sesiones, operativa autorizada
  —Salón, mozo asignado, terminal— y no autorizada —caja, mozo no asignado—, otro negocio 404, sin sesión 401, selector 400,
  POST con ambas sesiones).
- Navegador local con cookies reales (BUG-002): 12/12 casos (incluye «dueño + cajero» 200 y «misma sesión pidiendo como
  operativa» 403: sin elevación). Interfaz (BUG-001): «Vendiendo como Cajero Sintetico 1» y lista de permisos con el nombre de la
  cuenta (antes «Cajero sintetico 1», nombre heredado).
- Regresión focalizada (caso 12: Caja, Salón, autenticación/proxy, ocupación, catálogo, compras, pagos, etiquetas, mozo): 81
  archivos, 1021 OK / 16 fallos → 4 eran expectativas del comportamiento anterior y se actualizaron a la regla aprobada
  (`f10-b1-cashier` nombre del cajero; `p2-t48` 401→404 otro negocio y 401→403 PyR; `p2-t53` dependencia `actorFamily`); los
  12 restantes son previos: 10 fallan igual en `e6224a48` limpio (catalog-tutorial 1, auth-login-throttle 4, f10-b1-static 1,
  f9-barcode 2, R3A I2 1, password-hash 1) y 2 son los chequeos LF de migraciones F10-B2.0/B2.1 que fallan sólo en esta copia
  Windows (pasan en checkout limpio; ninguna migración tocada).
- Typecheck: 41 errores, los mismos 21 archivos de la línea base; ninguno en archivos tocados.

## Riesgos y pendientes

- Cambio de regla en Caja: un vinculado con nombre heredado distinto ahora muestra el de la cuenta (aprobado).
- Superficies públicas siguen exponiendo `Empleado.nombre` (marcador para mozos vinculados): decisión de privacidad aparte.
- Textos ya persistidos (avisos, `audit_logs.detalle`, fotos de pedidos con nombres no-marcador) no cambian, por diseño.
- La UI no marca visualmente un nombre histórico resuelto (el dato `empleadoNombreResuelto` está disponible).
- Endpoints neutrales de la tabla anterior siguen con el problema hasta su propia corrección.
- Los códigos 401/403/404 de ocupación cambiaron (sólo un cliente en el repo, actualizado).
- Validación local de la certificación: el cajero local se mostrará como «Cajero Sintetico 1»; en TESTING se espera
  «TEST_T44_R1D_CUENTA_4135EA7A». Los scripts de certificación no se modificaron.
- Incidente local corregido: un script de capturas cambió por error `panelMode` del café ficticio `sxn3` (05:40:57 UTC, auditado
  como `negocio.config_cambiada`); restaurado a `""` con la API del dueño y verificado por SQL de sólo lectura. Se creó la Mesa 1
  ficticia de `sxn3` en `deligo_dev` para reproducir BUG-002.
- Falta: revisión del operador, commit/CI y despliegue autorizados; certificación del Bloque 1 (`M11240504`) sigue detenida.

## Actualización 2026-11-24 — integración y despliegue en TESTING

Commits `dd23ac1e` (BUG-001), `3c13cbf5` (BUG-002), `e77dc890` (CI) y `1c68007f` (expectativa de `f10-b2-1-turnos:1189`,
que comparaba con `Empleado.nombre`; no estaba en la regresión local; corrige la falla del CI `45336236016`). Los parches
de `bugfix-001-002` corresponden a los dos primeros commits. CI `45336755300` SUCCESS 59/59; `testing-codex` = `1c68007f`;
DeliGO Copy `6fb22207…` SUCCESS. Detalle: `GIT_DEPLOY_HISTORY.md` (2026-11-24).
