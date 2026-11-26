# Consolidación final antes de Production — decisiones, plan definitivo T0–T7 y preparación de T0/T1

Fecha: 2026-11-26 · Revisión 2.

Estado: **PLAN DEFINITIVO APROBADO por el operador (D-1…D-7, T0–T7)**.

**Actualización (operador, 2026-11-26, autorización de T0 y T1):**
- **T0 y T1 autorizados** en la rama `codex/estabilizacion-final` (worktree `C:\Leo Campos\Trabajo\deligo-estabilizacion`, base `327d6c739a55e2f6b5da89f1ec125a24013eb345`), con commits **locales**.
- **Sin push, merge, cherry-pick ni despliegues.**
- F10-D1, T2 y T3 siguen **sin autorizar**.
- **P0-08 decidido:** se conserva en Production el modelo certificado `LATEST_SAMPLE_ONLY` y P2-T24 no entra mientras siga `BLOCKED_NOT_RELEASE_ELIGIBLE`. Sus commits y evidencias se conservan en el historial.
  - **No** se copian a ciegas los 6 archivos de `main`. La resolución se prepara en T5 y debe:
    - preservar el comportamiento certificado de Production;
    - conservar las mejoras compatibles posteriores;
    - no reactivar funcionalidad no elegible;
    - mantener la seguridad y el aislamiento entre usuarios;
    - no introducir regresiones en pedidos, repartidores ni GPS;
    - preservar el historial de ambas ramas.
- **Informes históricos:** los ~447 informes nunca versionados quedan como **respaldo privado local**; no se versionan ni se eliminan. LEGACY no se toca.
  - Si hace falta publicar alguno, se prepara una **copia sanitizada** y el original queda intacto.
  - El historial de Git no se reescribe.
- La matriz de elegibilidad de los trabajos dudosos está en el §16.

Restricciones de esta tarea (operador, 2026-11-26), textuales:
> En esta tarea se autoriza exclusivamente revisión, análisis y actualización documental. No modificar código funcional. No
> implementar todavía T1. No implementar todavía F10-D1. No modificar migraciones. No modificar datos de TESTING. No alterar
> evidencias históricas. No tocar el archivo 32. No realizar pruebas funcionales locales. No hacer commits ni push sin
> autorización posterior. No realizar merge ni cherry-pick. No realizar force push. No desplegar. No modificar Production.

Fuentes revisadas:
- `ROADMAP.md`, `COMPLETED_TASKS.md`, `DECISIONS_AND_INVARIANTS.md`, `CODEX_REPORT.md`, `DELIGO_FULL_CONTEXT_LATEST.md`, `GIT_DEPLOY_HISTORY.md`, `DEVELOPMENT_WORKFLOW.md` y `CLAUDE.md`;
- las certificaciones de los Bloques 1–6;
- `F4_C_SALE_EXCHANGES.md`, `F10_C_EGRESOS_CAJA_DISENO.md` y `F10_C2_F5_COMPRAS_RECEPCION_DISENO.md`;
- el árbol de `origin/testing-codex` (`327d6c73`) y de `origin/main` (`42ca5005`), leídos con `git show`, `git grep`, `git cherry` y `git merge-tree` (este último no escribe referencias).

La revisión 1 del plan (inventario, análisis del punto de venta y propuesta de tandas) queda incorporada y actualizada abajo.

---

## 0. Decisiones del operador (2026-11-26) — VIGENTES

ChatGPT confirmó la divergencia:
- base común `86609599bcbdf7979244c34298a27836e6452d3c`;
- **409 commits** sólo en `testing-codex` y **15** sólo en `main`;
- TESTING `327d6c739a55e2f6b5da89f1ec125a24013eb345`;
- Production `42ca5005d2ecd412de87e454b52820f38aaec5c0`.

| ID | Decisión |
|---|---|
| **D-1** | **Rama candidata basada en TESTING.** Primero se identifican los 15 commits propios de `main` (7 equivalentes y 8 propios) y se arma la matriz de cambios a conservar y de comportamientos que sólo están en Production. Los **45 conflictos** se resuelven **por comportamiento correcto**, nunca con un «ours/theirs» general. Se conserva el historial de `main`: sin reset y sin force push. Atención especial a: autenticación, sesiones, pedidos, Salón, notificaciones, estilos, configuración de despliegue, migraciones y decisiones. La candidata se prueba en TESTING, y **lo que llega a Production es exactamente el código certificado** |
| **D-2** | **F10-D1 es obligatorio antes de Production.** No se libera con egresos ni compras desactivados. Se implementa **sólo F10-D1** (alcance en §14). Antes de implementarlo se presentan: el diseño actualizado, los escenarios exactos, las migraciones nuevas posibles y la matriz de efectos financieros. **Esta decisión aprueba el alcance, no la implementación** |
| **D-3** | **La suite de seguridad es obligatoria antes de Production.** Seguridad: aislamiento entre negocios y empleados, independencia de permisos, ocultamiento de costos, rechazo de stock desde el catálogo, venta sin precio, restricciones del precio de variante y etiquetas pendientes. Importación: idempotencia, reintentos, confirmaciones simultáneas, tandas, conflictos de código, límites, formatos numéricos, aislamiento y etiquetas pendientes |
| **D-4** | **Una rama de estabilización para T1–T3**, con commits separados por responsabilidad y **un despliegue conjunto inicial en TESTING**. Despliegues adicionales sólo si hacen falta |
| **D-5** | Se aceptan las dos mejoras en T1: **«Todas las variantes»** marcado visualmente, y el **texto de formatos y límites de importación** (XLSX, CSV, primera hoja, 5 MB, 2000 filas) |
| **D-6** | **Push en Android con la app cerrada:** se acepta como limitación conocida **sólo si se confirma que no es una regresión respecto de Production**, y se registra. Esto **no cubre** inconsistencias de identidad en las notificaciones |
| **D-7** | **La prueba C5 se integra al CI general**: debe ejecutarse de verdad contra PostgreSQL, sin quedar omitida. El workflow focalizado **no** se lleva a `main`. Se conservan la rama `codex/b4-c5-inicio-vencido`, el commit `3c498c24` y la ejecución de CI 45763041157 como evidencia |

**Se mantienen como P2:**
- la importación para restaurantes;
- la estética no esencial;
- las funcionalidades nuevas;
- `PEDIDO_CON_DEUDA_APROBADA`, si el comportamiento actual es seguro.

Las decisiones comerciales ya resueltas no se vuelven a preguntar.

## 1. Estado certificado (lo que NO se reabre)

Los seis bloques funcionales principales están **CERTIFICADOS EN TESTING** (`327d6c73`), dentro del alcance de sus evidencias:

| Bloque | Ejecución | ZIP definitivo |
|---|---|---|
| 1 Proveedores y asociaciones | M11240504 | `0da1488e…` |
| 2 Compras y recepciones | M11250631 | `a995816a…` |
| 3 Pagos, anticipos y cuenta corriente | M11251859 | `cc68cf21…` |
| 4 Precios y etiquetas (+ C5 en CI, run 45763041157) | M11260155 + complementaria | `5279a313…` |
| 5 Permisos temporales de catálogo | M11261651 | `04cd6c33…` |
| 6 Importación Excel/CSV del dueño | M11262102 | `e042303e…` |

Antes también se certificaron en TESTING: F10-B0/B1/B2, F10-C1 (egresos), F4-A, F4-B, F4-C1…C5 (cambios y ventas vinculadas), BUG-001/002/003 y el catálogo.

**Production NO está certificada.** Sigue en `main` `42ca5005` (RC1 de P2, 2026-09-21).

## 2. Estado real del repositorio (solo lectura, 2026-11-26)

| Elemento | Estado |
|---|---|
| `origin/testing-codex` | `327d6c73` (TESTING): 409 commits por delante de la base común |
| `origin/main` | `42ca5005` (Production, 2026-09-21): 15 commits propios; `git cherry` da **7 equivalentes y 8 no equivalentes** |
| Fusión de prueba `merge-tree --write-tree testing-codex × main` | **45 archivos en conflicto** |
| Migraciones de `testing-codex` que faltan en `main` | **35** (2026-09-27 → 2026-11-21) más `migration_lock.toml`. Son aditivas, pero incluyen **rellenos sobre datos existentes** y **reemplazos de restricciones CHECK** (detalle en §9) |
| `codex/b4-c5-inicio-vencido` | `3c498c24` = `327d6c73` + 1 commit (la prueba C5 y su workflow propio). No integrada |
| Ramas de funcionalidad (`codex/f4-*`, `codex/integracion-compras-catalogo`, `work/*`) | Integradas en `testing-codex`. `f4-a`, `f4-b` y `p2-t56-r3a-i4-discovery-roadmap` tienen 1 commit **sólo de documentación** cada una |

### 2.1 Matriz de los 15 commits propios de `main`

Método:
- `git cherry origin/testing-codex origin/main` para la equivalencia de parche;
- en los no equivalentes, por cada línea agregada (8 caracteres o más), si existe textualmente en el archivo de `testing-codex`;
- después, comparación de los archivos que difieren.

| Commit | Tipo | Archivos | Líneas agregadas presentes en `testing-codex` | Asunto |
|---|---|---|---|---|
| `678ccf06` | PROPIO | 26 | 534/536 | release: add operations terminal security hardening |
| `fc4edb39` | EQUIV | 24 | — | release: retire legacy mozo authentication |
| `3a822df3` | PROPIO | 6 | 272/272 | release: harden operational lifecycle gates |
| `1de0d3c1` | EQUIV | 6 | — | release: harden mesa authorization boundaries |
| `969ea77a` | PROPIO | 168 | 15972/16177 | release: promote certified pre-t29 checkpoint |
| `c45fd5ec` | EQUIV | 10 | — | release: promote certified p2-t29a checkpoint |
| `7a3a1dcb` | PROPIO | 22 | 1509/1536 | release: promote certified p2-t29b-t29c checkpoint |
| `44af4ece` | EQUIV | 3 | — | release: promote certified p2-t29 final checkpoint |
| `8011ee37` | PROPIO | 8 | 1063/1063 | release: promote certified p2-t30 and p2-t32 checkpoint |
| `773664f8` | PROPIO | 23 | 327/327 | release: promote certified p2-t35 and p2-t36 checkpoint |
| `bb17c7dd` | EQUIV | 8 | — | release: promote certified p2-t41 checkpoint |
| `46a1d556` | EQUIV | 18 | — | fix: align pyr order workflow |
| `946f8c24` | EQUIV | 4 | — | fix: align salon personal occupation state |
| `ff4cc2f8` | PROPIO | 25 | 719/721 | release: promote P2-T46 canonical table accounts |
| `42ca5005` | PROPIO | 213 | 38694/38911 | release: assemble certified P2 Production Release Candidate RC1 |

**Resultado por archivo** (484 archivos tocados por los 15 commits):
- **411 son idénticos** en `testing-codex`.
- **73 difieren.** En casi todos, `testing-codex` es **más nuevo** y supera a `main`. Ejemplos:
  - el aislamiento de la familia de sesiones en Google OAuth (2026-09-26);
  - la corrección de notificaciones de F4-A (2026-10-15);
  - el estado de pedidos de R3A;
  - `prisma/schema.prisma`.

**Excepción — comportamiento que sólo está en Production.** Son 6 archivos de seguimiento en vivo del repartidor (*tracking*), donde **`main` es más nuevo**:

| Archivo | En `main` (RC1) | En `testing-codex` |
|---|---|---|
| `src/components/tracking/delivery-tracking-map.tsx` | Modelo certificado `GPS_SAMPLE_QUEUE_MODEL=LATEST_SAMPLE_ONLY` | Trabajo de P2-T24 (transporte de trayectoria, instrumentación del *pipeline*) |
| `src/hooks/use-repartidor-tracking.ts` | Ídem | Ídem |
| Las pruebas asociadas de esos dos archivos, más `src/lib/repartidor-tracking-static-contract.test.ts` y `src/lib/tracking-consumer-static-contract.test.ts` | Contratos del modelo de `main` | Contratos de P2-T24 |

### 2.2 Hallazgo nuevo P0 — `testing-codex` contiene trabajo no elegible para *release*

- **P2-T24** figura como `P2_T24_STATUS=IMPLEMENTED_PARTIALLY_TESTING_BLOCKED_NOT_RELEASE_ELIGIBLE`, y su última prueba como `P2_T24_R5_STATUS=DIAGNOSTIC_CONTROL_CANARY_FAILED_NO_VALID_TRACKING_POST`.
- En los asuntos de commits de `testing-codex` que no están en `main` hay 33 referencias a P2-T24.
- Si la candidata toma `testing-codex` tal cual, **Production cambiaría el seguimiento del repartidor certificado por uno no certificado**.

**Estado de los demás trabajos que sólo están en `testing-codex`** (conteo de marcadores en `COMPLETED_TASKS`, `ROADMAP` y `CODEX_REPORT`; es **indicativo**: la auditoría formal es parte de la tarea P0-08):

| Trabajo | Marcador dominante | Lectura preliminar |
|---|---|---|
| P2-T38, T39, T43, T45, T51, T55 | `CLOSED_TESTING_CERTIFIED` | Elegibles |
| P2-T47, T49, T50 | `CLOSED_TESTING_CERTIFIED` (+ `PROMOTED`) | Elegibles |
| P2-T56 (R3A, autoridad de stock) | `CLOSED_TESTING_CERTIFIED` (41 menciones) | Elegible; es base de stock de los Bloques 1–6 |
| P2-T40 | `CLOSED_TESTING_CERTIFIED`, con menciones `DEPLOYED_TESTING_AWAITING_*_RECERTIFICATION` | **Revisar**: confirmar si la recertificación física se cerró |
| P2-T44 | `CERTIFIED` | Confirmar el alcance |
| P2-T52 | `CLOSED_TESTING_CERTIFIED`, con una mención `BLOCKED_BY_T…` | Confirmar |
| P2-T54 | `BLOCKED_BY_T…` / `BLOCKED_ON_TESTING_CODEX_INTEGRATION_AUTHORIZATION` | **Revisar** |
| P2-T18 | `BLOCKED_AUTH` (chat en el navegador real) | Ya estaba en RC1 como limitación (P2-11); confirmar que no cambió |
| P2-T23, P2-T53 | Sin marcador encontrado | **Revisar** |
| **P2-T24** | `BLOCKED_NOT_RELEASE_ELIGIBLE` | **No elegible**: neutralizar o conservar el *tracking* de `main` |
| F4-A/B/C1…C5, F10-B0/B1/B2, F10-C1, CATALOG, BUG-001/002/003, compras y pagos | Certificados (Bloques 1–6 y anteriores) | Elegibles |

### 2.3 Copia local (entregable 1)

| Elemento | Estado exacto |
|---|---|
| Ruta | `C:\Leo Campos\Trabajo\deligo-main-limpio` |
| Rama local | `codex/f4-c5-sale-exchange-ui` en `941a915d`: **0 commits propios y 23 detrás** de `origin/testing-codex` (es antecesora) |
| Seguidos y modificados (7) | `CODEX_REPORT.md`, `DELIGO_FULL_CONTEXT_LATEST.md`, y en `codex-reports/`: `COMPLETED_TASKS.md`, `DECISIONS_AND_INVARIANTS.md`, `F4_C_SALE_EXCHANGES.md`, `GIT_DEPLOY_HISTORY.md` y `ROADMAP.md`. Cada uno es la versión de `testing-codex` **más agregados** (como mucho 1–2 líneas reemplazadas). `F4_C_SALE_EXCHANGES.md` es idéntico al de `testing-codex`: su «M» se debe a que la rama local está detrás |
| Sin seguimiento en `codex-reports/` | 460: **13 idénticos** a archivos de `testing-codex` (la rama local está detrás) y **447 que nunca estuvieron en ninguna rama** (225 `P2*`, 110 `archive/P2*`, 25 `PRODUCTION*`, 14 `night*`, 12 `IOS*`, 10 `CERTIFICACION_*`, 9 `CATALOG*`, 9 `BUSINESS*` y otros), más `CONSOLIDACION_FINAL_PRODUCTION_PLAN.md` |
| Otros sin seguimiento | `.claude/` (`launch.json`, `scheduled_tasks.lock`, `settings.local.json`, `skills/`), `.codex/rules`, `.next-r5-7-*` (5 carpetas de build), `.t02_poll_temp.mjs`, `1)`, **`32` (intocable)**, `CLAUDE.md`, `DELIGO_CONTEXT_RECONCILIATION_2026_09_05.md`, `DEVELOPMENT_WORKFLOW.md`, `branding-source/`, imágenes y documentos en `public/` (`ChatGPT Image…png`, `pa8-human-anchors.json`, `tarjetas.docx` y `.pdf`), `scripts/security/` (plantilla de configuración de Claude, `secret_guardrail.js` con su prueba y su *hook*, `verify-testing-postgres-identity.ts`) y `tsconfig.tsbuildinfo` |
| Worktree `C:\Leo Campos\Trabajo\deligo-b4-c5` | En la rama `codex/b4-c5-inicio-vencido` `3c498c24`, limpio |
| `.gitignore` | Cubre `.next/`, `.env`, `.env.local` y `.env.production` |
| Búsqueda de secretos en los informes sin seguimiento (sólo nombres y patrones; sin imprimir valores) | Sólo marcadores de posición enmascarados. **Datos personales:** el correo del operador aparece en líneas de autor de `P2_T15_T17_COMMIT_R1`, `P2_T20_COMMIT_R1`, `P2_T22A_COMMIT_R1` y `P2_T22C_COMMIT_R1` |

## 3. Inventario priorizado (actualizado con D-1…D-7)

**Tipos:**
- **E** = error funcional comprobado;
- **L** = limitación conocida;
- **U** = mejora de UX;
- **R** = riesgo técnico;
- **N** = funcionalidad nueva.

### 3.1 P0 — Bloqueantes para Production

| ID | Tipo | Descripción | Decisión / tanda |
|---|---|---|---|
| P0-01 | R | Integración `testing-codex` → `main` (§12) | **D-1**: candidata basada en TESTING, 45 conflictos por comportamiento, sin reset ni force push → T5 |
| P0-02 | R | **F10-D1**: errores de egresos descubiertos después del cierre | **D-2**: obligatorio; diseño previo (§14) → T4 |
| P0-03 | R | Ensayo de las 35 migraciones (más las de F10-D1) sobre una copia restaurada aislada | T6 |
| P0-04 | R | CI completo verde: TS 32/41, las 10 pruebas que fallan localmente, lint, build y la batería completa | T2 |
| P0-05 | R | **Suite de seguridad e importación** (antes P0-05 + P1-08) | **D-3**: obligatoria completa → T2 |
| P0-06 | R | Infraestructura de Production: variables (sólo nombres), chat, tareas programadas, imágenes y herramienta de respaldo | T6, en sesión del operador |
| P0-07 | R | Respaldo consistente de Production con la restauración comprobada | T6 |
| **P0-08** | R | **Elegibilidad para *release* de todo lo que sólo está en `testing-codex`** (§2.2): P2-T24 no es elegible y `main` tiene un *tracking* más nuevo y certificado. Sin resolver, Production recibiría código no certificado | **Nuevo**. Auditoría por trabajo en T5 (antes de armar la candidata); decisión del operador sobre P2-T24 (§15) |

### 3.2 P1 — Resolver antes de Production

| ID | Tipo | Descripción | Tanda |
|---|---|---|---|
| P1-01 | U | Jerarquía visual del punto de venta del cajero (§4) | T1 |
| P1-02 | U | Casillas de permisos vencidos **preseleccionadas** al volver a habilitar | T1 |
| P1-03 | E | El cuadro de variantes muestra el precio anterior hasta reabrirlo | T1 |
| P1-04 | E | Texto financiero E4.1 «a favor del proveedor» | T1 |
| P1-05 | U | Separación de importes en la cuenta corriente (E4.3) | T1 |
| P1-06 | U | Ubicación de los formularios de desafectar y asignar (E3.1/E3.2) | T1 |
| P1-07 | R | C5 al CI general (**D-7**) | T2 |
| P1-09 | E/R | Sesiones simultáneas: cierre comercial de mesa, cancelación de pedidos, notificaciones y destacado (también `denuncias` y `mozos/stats`, de la misma clase) | T3 |
| P1-10 | R | 116 respuestas HTTP 401 (`/api/notificaciones` 110 y `/api/destacado-solicitud` 6) | T3 |
| P1-11 | L | Importar un `.xlsx` guardado por Microsoft Excel real | T5 |
| P1-12 | R | Diagnósticos de TS y pruebas locales que fallan (parte de P0-04) | T2 |
| P1-13 | R | Push en Android con la app cerrada | **D-6**: limitación **sólo** si no es regresión frente a Production (comprobación en T5) |
| P1-14 | R | Prueba física en teléfonos de Caja, turnos y egresos | T5 |
| P1-15 | L | Commit de la documentación y de las evidencias | T0 (§11), con autorización |
| P1-16 | U | «Todas las variantes» marcado visualmente (antes P2-01) | **D-5** → T1 |
| P1-17 | U | Acceso a «Pagar deudas seleccionadas» (antes P2-02) | T1 (plan T0–T7) |
| P1-18 | U | Texto de formatos y límites de importación (antes P2-03) | **D-5** → T1 |

P1-08 pasó a P0-05 por D-3.

### 3.3 P2 — Postergar

| ID | Descripción |
|---|---|
| P2-04 | No perder las decisiones de la vista previa al volver a «Revisar columnas» |
| P2-05 | `PEDIDO_CON_DEUDA_APROBADA` con anticipos por mercadería pendiente (se mantiene P2 si el comportamiento actual es seguro; el Bloque 3 E7.1 lo certificó) |
| P2-06 | Importación para restaurantes; cambio masivo de nombres y alta de variantes en productos existentes |
| P2-07 | Nombre público del mozo y `mesas-public` para anónimos |
| P2-08 | Resto del rediseño de pagos, F10-D completo (más allá de D1), F5-B y DeliGO Proveedores B2B |
| P2-09 | Asociación específica redundante al aprobar recepciones |
| P2-10 | Aviso de deprecación de Node 20 en `actions/checkout@v4` (sin actualizaciones masivas de dependencias) |
| P2-11 | P2-T18 (chat entre pestañas) y otros pendientes físicos que ya estaban en RC1 |
| P2-12 | Estética no esencial y funcionalidades nuevas |

## 4. Análisis — jerarquía visual del punto de venta del cajero (P1-01)

**Componentes actuales** (`src/app/operaciones/mi-panel/[slug]/caja/page.tsx`, 258 líneas). El orden es fijo:
1. encabezado («Vendiendo como…» y «Recibir mercadería»);
2. `EtiquetasAcceso` y `CatalogoAcceso`;
3. `OperationalShiftPanel` (Caja y turno);
4. `CajaSalidasCajero` (registro e historial completo `historial-salidas`, línea 605);
5. `<section id="caja-vender">` (línea 209) con `VenderView`;
6. `CajaVentasHistorial`.

**Estado del turno:**
- `OperationalShiftPanel` avisa con `onTurnoChange` **sólo cuando terminó de cargar**.
- La página lo guarda en `turnoAbiertoId`: `undefined` mientras carga, `null` sin turno y un id con turno.
- Es el estado confirmado por el servidor.

**Carrito:**
- `VenderView` (`caja-tab.tsx:382`) lo guarda en un `useState` en memoria.
- **Si `VenderView` se desmonta, el carrito se pierde** y se libera el inicio de venta con su protección de precios.
- El `QueryProvider` global usa `refetchOnWindowFocus: true` y `retry: 1`.

**Solución propuesta (sin desmontar):**
- Los tres paneles van en el mismo contenedor `flex flex-col`, siempre en el mismo orden del árbol. El orden visual se cambia con CSS `order` según `turnoAbiertoId`:
  - sin turno o cargando: Caja y turno → Ventas → Salidas;
  - con turno confirmado: Ventas → Caja y turno → Salidas.
- Indicador compacto «Turno abierto · `<Caja>`».
- «Caja y turno» plegable, **montado y oculto** (no desmontado).
- Salidas siempre después de Ventas: «Registrar salida de Caja» visible y el historial plegado («Ver salidas de este turno (N)»), con altura limitada.
- Etiquetas, Catálogo y Recibir mercadería quedan como accesos compactos.
- Sin cambios de lógica, permisos, dinero ni base de datos.

**Teclado y lector de pantalla (requisito del plan T0–T7).** CSS `order` cambia el orden **visual**, pero **no** el del DOM. El foco con Tab y la lectura del lector de pantalla siguen el DOM, así que en uno de los dos estados el orden visual y el de lectura no coinciden. Criterio para T1:
- **El orden del DOM sigue el estado operativo principal (con turno): Ventas → Caja y turno → Salidas.** Sin turno, el orden visual pone Caja y turno primero, y Ventas no ofrece acciones de venta hasta que hay turno. La primera acción útil queda así accesible en los dos estados.
- **Se mueve el foco sólo cuando lo pide el usuario**: tras abrir el turno, un enlace o botón «Ir a Ventas» lleva el foco al encabezado de Ventas (`tabIndex=-1`). Nunca se mueve el foco en un refresco automático.
- Cada panel tiene su encabezado o `aria-label`, y los plegables usan `<details>/<summary>` o `aria-expanded`.
- **Verificación manual en T1:** Tab completo en escritorio, y TalkBack (Android) o VoiceOver/NVDA, en los dos estados.
- **Si la revisión muestra un desfase confuso**, la alternativa es un orden único del DOM sin `order` CSS, con el indicador compacto y el plegado de «Caja y turno». Se decide en la revisión técnica de T1, sin cambiar el principio de no desmontar `VenderView`.

## 5. Plan definitivo T0–T7

| Tanda | Alcance | Rama | Dependencias | Criterio de cierre |
|---|---|---|---|---|
| **T0** Docs y preparación | Registrar D-1…D-7 y T0–T7 (esta tarea). Conservar los cambios locales. Commit de la documentación (§11), **con autorización aparte**. Nunca `32`, secretos ni archivos privados | Rama de estabilización (§12) | Autorización de commit | Docs versionados en la rama; exclusiones respetadas |
| **T1** Interfaz y UX | §13 | Estabilización | T0 | §13.3 |
| **T2** Seguridad y salud técnica | C5 en el CI general (D-7); suite de seguridad e importación (D-3); TS 32/41; las 10 pruebas locales que fallan; lint, build y CI completo. **Sin exclusiones** ni actualizaciones masivas de dependencias | Estabilización | Ninguna (en paralelo con T1) | CI completo verde, C5 ejecutada (no omitida) en PostgreSQL, diagnósticos clasificados y corregidos donde corresponda |
| **T3** Sesiones simultáneas | Cierre comercial de mesa, cancelación de pedidos, notificaciones y destacado (clase AUTH02), y los 116 HTTP 401 | Estabilización | Ninguna | Sin atribuciones erróneas; los 401 desaparecen o quedan justificados como sondeos legítimos |
| — | **Despliegue conjunto en TESTING de T1–T3** (D-4), con autorización | `testing-codex` | T1–T3 | Prueba manual del operador + evidencia (HTTP, logs, SQL) |
| **T4** F10-D1 | Diseño → aprobación → implementación (§14) | Estabilización o rama propia desde ella | Aprobación del diseño | Certificado en TESTING (en T5) |
| **T5** Candidata y certificación final en TESTING | Auditoría de elegibilidad (P0-08); integración de `main` por comportamiento (D-1, §12); CI completo; regresiones proporcionales (§6); Excel real; teléfonos; certificación de F10-D1; comprobación de D-6 | Rama candidata | T1–T4 | §7 |
| **T6** Preparación de Production | Ensayo de las 35 migraciones (más las de F10-D1) sobre una copia restaurada aislada; respaldo consistente con restauración probada; comparaciones de datos; variables sólo por nombre; ventana de mantenimiento; estrategia de recuperación (§9) | — (operador) | T5 | Ensayo y restauración comprobados, inventario completo, plan escrito |
| **T7** Metodología | Activar `DEVELOPMENT_WORKFLOW.md` después de certificar Production | — | Production certificada | Registro de la activación |

## 6. Matriz de pruebas técnicas y regresiones (proporcional)

| Área | Por qué | Cómo |
|---|---|---|
| Caja del cajero: orden, plegado, carrito, inicio de venta y protección de precios | T1 | Componente + manual en móvil y escritorio, claro y oscuro, teclado y lector de pantalla |
| Turnos y egresos | T1 (presentación) y T4 (F10-D1) | Manual en la caja QA + suite de F10-D1 en CI |
| Ventas, cobros, anulaciones, devoluciones, correcciones y cambios | Riesgo indirecto | CI (F4 y F10) + una venta y una devolución manuales |
| Stock | Sin cambios | CI (R3A) + SQL |
| Compras, proveedores y pagos | T1 (textos y disposición) y T4 (egresos vinculados a proveedor) | Manual de lectura con datos QA + CI F5/F10-C2 + escenarios de F10-D1 con proveedor |
| Etiquetas y protección de precios | C5 en el CI general | CI |
| Permisos y seguridad | T1 (permisos) y T2 (suite D-3) | CI + manual del permiso vencido |
| Sesiones simultáneas | T3 | Integración + manual de Salón con las dos sesiones |
| Importaciones | T1 (texto) y T2 (suite) | CI + Excel real |
| Restaurantes: pedidos, mesas, Salón, pyr y mozo | T3, y los conflictos con `main` (D-1) | Manual en TESTING de la candidata |
| Autenticación (Google, login, terminales operativas) | Conflictos con `main` (D-1) | CI + inicio de sesión manual de dueño, empleado y mozo en la candidata |
| Seguimiento del repartidor | P0-08 | Según la decisión sobre P2-T24: el modelo de `main` conservado y sus contratos verdes, o P2-T24 certificado |
| Notificaciones y push | T3 y D-6 | Logs + comparación con el comportamiento de Production |
| Migraciones | T6 | Ensayo sobre una copia restaurada |

No se repiten los seis bloques: los cubren sus certificaciones y el CI.

## 7. Criterios para declarar la candidata lista para Production

1. Todos los P0 resueltos (P0-01…P0-08). F10-D1 implementado y **certificado en TESTING**.
2. CI completo verde sobre el commit candidato: C5 ejecutada contra PostgreSQL, la suite de seguridad e importación (D-3) y los diagnósticos de TS clasificados.
3. Auditoría de elegibilidad (P0-08) aprobada: ningún trabajo no certificado llega a Production. El seguimiento del repartidor de `main` se conserva, o P2-T24 se certifica.
4. Los 45 conflictos resueltos por comportamiento, cada uno con su justificación, y el historial de `main` conservado.
5. TESTING desplegado con **el commit candidato exacto**, con la regresión de §6 aprobada, sin 5xx y con los 4xx explicados.
6. D-6 comprobado (sin regresión frente a Production) y registrado.
7. Migraciones (35 + F10-D1) aplicadas sin error sobre una copia restaurada, con las validaciones SQL correctas.
8. Respaldo consistente con la restauración probada. Inventario de variables y servicios completo (sólo nombres).
9. Plan de recuperación escrito: **revertir el código no revierte las migraciones**, y restaurar un respaldo no es sin pérdidas (pierde lo escrito después del respaldo).
10. **El commit desplegado en Production es exactamente el certificado en TESTING.**

## 8. Pendientes que necesitan al operador (no comerciales)

Ver §15 (dependencias y bloqueos).

## 9. Preparación y despliegue en Production (T6, no se ejecuta)

1. **Candidata:** el commit exacto con su CI completo y la certificación en TESTING.
2. **Comparación:** `main` contra la candidata, por módulo, con los conflictos resueltos y las migraciones.
3. **Migraciones a ensayar:** las 35 (más las de F10-D1). Puntos de atención:
   - **rellenos:**
     - `20261010120000_f10_b2_0_money_decimal_columns` (ventas, renglones y cobros);
     - `20261013130000_f10_b2_2_d_cash_shift_review` y `20261016120000_f10_b2_2_g_shift_recovery` (turnos);
   - **restricciones CHECK reemplazadas:** f4_c4, f10_c2a, pagos_e1, pagos_e3 y catalogo_activacion_empleado.
4. **Respaldo consistente:** `pg_dump` de Production en la ventana acordada, con su SHA-256. Restauración en una base **aislada** y comprobación de conteos.
5. **Ensayo:** `prisma migrate deploy` sobre la copia restaurada, con validaciones SQL de integridad: totales de ventas y cobros, turnos, restricciones nuevas y conteos antes y después.
6. **Variables y servicios:** comparación **sólo por nombre** con TESTING; chat, tareas programadas e imágenes. En una sesión del operador separada, sin conectores de Production en sesiones de desarrollo.
7. **Ventana de mantenimiento:** en horario de baja actividad, con aviso a los negocios si corresponde. Migraciones → aplicación → salud.
8. **Comprobaciones posteriores:** pruebas de humo (login, catálogo, pedidos, Caja sin dinero real, mesas, notificaciones), logs sin 5xx y conteos financieros iguales a los previos más lo esperado.
9. **Recuperación:**
   - ante diferencias, se detiene;
   - se redespliega el commit anterior **sólo si el esquema migrado es compatible**;
   - si la base quedó inconsistente, se restaura el respaldo, con la pérdida de lo escrito después (decisión del operador), o se aplica una migración correctiva hacia adelante.
10. **Registro:** commit, fecha, despliegue, respaldo y etiqueta Git (`DEVELOPMENT_WORKFLOW.md` §Production).

## 10. Metodología posterior (T7)

`DEVELOPMENT_WORKFLOW.md` se activa plenamente con la primera versión estable certificada en Production.

**Ciclo:** definir → implementar → revisar → integrar → CI → probar en TESTING → corregir → autorizar Production.

**Proporcionalidad:**
- los cambios visuales simples no llevan herramientas de certificación;
- dinero y stock llevan una verificación focalizada;
- tras unos tres intentos fallidos, replantear.

Sin revertir migraciones, sin force push y sin quitar el CI.

---

## 11. T0 — preparación de la documentación (entregables 2, 3 y 4)

### 11.1 Cambios documentales pendientes (entregable 2)

- Los 7 archivos seguidos y modificados (§2.3), con los registros de los Bloques 4–6, la consolidación y estas decisiones.
- Las certificaciones sin seguimiento: `CERTIFICACION_BLOQUE_2…6` (5) con sus `_PROPUESTA` (5).
- Este plan (`CONSOLIDACION_FINAL_PRODUCTION_PLAN.md`).
- `CLAUDE.md` y `DEVELOPMENT_WORKFLOW.md` (raíz, sin seguimiento): son la metodología vigente y las reglas de secretos.

### 11.2 Archivos propuestos para el commit de documentación (entregable 3)

Se agregan **uno por uno**, nunca con `git add .`. El commit se hace en la **rama de estabilización** creada desde `origin/testing-codex` (§12), no en la rama local, que está 23 commits detrás.

Cómo se lleva cada archivo:
- Las versiones locales de los 7 archivos seguidos ya contienen todo `testing-codex` más los agregados. Se copian sobre el worktree nuevo y se revisa `git diff` antes de agregarlos. `F4_C_SALE_EXCHANGES.md` no tiene cambios reales y queda fuera.
- **`DELIGO_FULL_CONTEXT_LATEST.md` está seguido** en el repositorio. Va en el commit (la sección §B de `deligo-closeout` que dice «untracked» está desactualizada).

| # | Archivo | Motivo |
|---|---|---|
| 1 | `CODEX_REPORT.md` | Handoff principal |
| 2 | `DELIGO_FULL_CONTEXT_LATEST.md` | Handoff secundario (seguido) |
| 3 | `codex-reports/COMPLETED_TASKS.md` | Bloques 4–6 certificados |
| 4 | `codex-reports/DECISIONS_AND_INVARIANTS.md` | Reglas D1/D2/D6 de la importación y D-1…D-7 |
| 5 | `codex-reports/GIT_DEPLOY_HISTORY.md` | Registros de CI y C5 |
| 6 | `codex-reports/ROADMAP.md` | Estado y plan |
| 7–16 | `codex-reports/CERTIFICACION_BLOQUE_{2,3,4,5,6}_*.md` (10) | Evidencia de la certificación |
| 17 | `codex-reports/CONSOLIDACION_FINAL_PRODUCTION_PLAN.md` | Este plan |
| 18 | `DEVELOPMENT_WORKFLOW.md` | Metodología permanente |
| 19 | `CLAUDE.md` | Reglas del proyecto (sin datos personales; revisar antes) |
| Opcional | `scripts/security/secret_guardrail.js`, su prueba y su *hook*, `claude-settings.template.json` y `verify-testing-postgres-identity.ts` | Controles de secretos. **Revisión de contenido antes** (que no contengan valores ni rutas privadas); commit aparte, con responsabilidad propia |

**Resultado real de T0 (2026-11-26): 17 archivos, no 19.**
- `CLAUDE.md` y `DEVELOPMENT_WORKFLOW.md` (filas 18 y 19) **ya están versionados en `testing-codex`** y son idénticos a la copia local (sólo cambia el fin de línea). No hay nada que agregar.
- La copia local los mostraba como «sin seguimiento» porque su rama (`941a915d`) es anterior a ese commit.
- `F4_C_SALE_EXCHANGES.md` es idéntico a `testing-codex` y queda fuera.
- `scripts/security/` queda fuera por decisión del operador: corresponde a una tarea técnica aparte.

**Revisión de privacidad de los 17 archivos.** Sólo se revisaron patrones, sin imprimir valores. No se encontraron:
- correos, URLs de base de datos ni JWT;
- claves de Mercado Pago, de GitHub ni de pagos;
- claves privadas, cookies ni tokens de sesión;
- teléfonos ni dominios de Railway.

Las únicas coincidencias eran 38 menciones de la ruta local del usuario de Windows. En las copias que entran al commit se normalizaron a `%USERPROFILE%`; los originales locales siguen intactos.

### 11.3 Archivos que deben quedar fuera del repositorio (entregable 4)

| Archivo(s) | Motivo |
|---|---|
| **`32`** | Intocable (no se lee, no se agrega, no se mueve) |
| `1)`, `.t02_poll_temp.mjs` | Restos temporales |
| `.next-r5-7-*` (5 carpetas), `tsconfig.tsbuildinfo` | Artefactos de build |
| `.claude/settings.local.json`, `.claude/scheduled_tasks.lock` | Configuración local y de sesión |
| `.codex/rules` | Configuración local de la herramienta (decisión del operador si se quisiera versionar) |
| `branding-source/`, imágenes y documentos sueltos de `public/` (`ChatGPT Image…png`, `pa8-human-anchors.json`, `tarjetas.docx` y `.pdf`) | No son documentación ni código de la candidata; decisión de producto aparte |
| `codex-reports/archive/LEGACY_FULL_REPORT_20260826.md` | Inmutable; contiene el correo del operador y menciones textuales de claves |
| `P2_T15_T17_COMMIT_R1`, `P2_T20_COMMIT_R1`, `P2_T22A_COMMIT_R1` y `P2_T22C_COMMIT_R1` | Contienen el correo del operador. El repositorio es **público**: fuera, salvo una redacción aprobada |
| Los otros ~440 informes históricos nunca versionados | Fuera de T0 hasta una decisión del operador (§15): son historial de trabajo, no evidencia de los Bloques 1–6. Si se versionan, se hace en un commit aparte, previa búsqueda de datos personales y secretos |
| `.env*` | Ya ignorados; nunca se leen |
| `DELIGO_CONTEXT_RECONCILIATION_2026_09_05.md` | Histórico (septiembre); decisión del operador |

## 12. Estrategia de ramas y conservación de `main` (entregables 5 y 6)

### 12.1 Ramas

1. **`codex/estabilizacion-final`**, creada desde `origin/testing-codex` (`327d6c73`) en un **worktree nuevo**. La copia local actual no se toca: conserva los cambios locales y el archivo `32`.
   - **Commit 1 (T0):** documentación (§11.2).
   - **T1:** commits separados por responsabilidad: (a) punto de venta; (b) permisos y variantes; (c) cuenta corriente y proveedores; (d) texto de importación.
   - **T2:** la prueba C5 **copiada** desde `3c498c24` (sólo el archivo de prueba, sin cherry-pick). Se suma su paso al **workflow general**, que la ejecuta de verdad contra PostgreSQL; el workflow focalizado no se porta (D-7). Después, la suite D-3 y las correcciones de TS y de pruebas.
   - **T3:** sesiones simultáneas y 401.
2. **Integración en `testing-codex`** por avance directo (*fast-forward*) de la rama de estabilización, y **un despliegue conjunto en TESTING** (D-4). Requiere autorización.
3. **T4 (F10-D1)** sobre la estabilización, después de aprobar su diseño.
4. **Rama candidata `codex/release-candidata`** desde la `testing-codex` resultante: **merge de `origin/main`** (un commit de fusión, sin squash ni rebase) con los 45 conflictos resueltos **archivo por archivo** según §12.2.
   - Así `main` avanza después por *fast-forward* hasta la candidata, conservando su historial completo: sin reset y sin force push.
   - La candidata se despliega en TESTING, se certifica (T5) y **ese mismo commit** se promueve a Production (T6).

### 12.2 Conservación del historial de `main` y de lo que sólo está en Production

- **Los 7 commits equivalentes** ya están en `testing-codex`; la fusión los conserva en el historial.
- **Los 8 propios:** 99–100 % de sus líneas ya existen en `testing-codex`. Para cada uno de los 73 archivos que difieren se registra en la resolución:
  - qué comportamiento tiene Production;
  - cuál tiene TESTING;
  - cuál se conserva, y por qué.
- **Regla por defecto:** se conserva el comportamiento certificado más nuevo. Si un archivo de `main` es más nuevo y está certificado (por ejemplo, el *tracking*), **se conserva el de `main`**, salvo una decisión del operador.
- **Áreas de atención (D-1)** en los 45 conflictos: autenticación (Google, login, terminales operativas), sesiones, pedidos, Salón, pyr, mozo, notificaciones, `globals.css`, `cart-panel`, `salon-tab`, ocupación de mesa, configuración de despliegue, `prisma/schema.prisma`, migraciones y documentos de decisiones.
- **Migraciones:** nunca se editan las históricas. Si `main` y `testing-codex` comparten migraciones, se verifica que sean idénticas byte a byte.
- **Seguimiento del repartidor (P0-08):** hasta que el operador decida, la candidata conserva los 6 archivos de `main` (`LATEST_SAMPLE_ONLY`) y sus contratos. Hay que verificar que el resto de P2-T24 en `testing-codex` (instrumentación, rutas) quede inactivo o se retire sin romper.

## 13. T1 — alcance exacto, archivos y criterios (entregables 7, 8 y 9)

Sólo presentación y textos: **no cambian** lógica, cálculos, permisos del servidor, dinero, stock ni la base de datos. T1 no está autorizado todavía.

### 13.1 Alcance

| # | Ítem | Qué cambia |
|---|---|---|
| T1-a | Punto de venta del cajero (P1-01) | Orden según el turno sin desmontar (§4), indicador compacto, «Caja y turno» plegable montado, Salidas después de Ventas con el historial plegado y de altura limitada, y orden de teclado y lector de pantalla revisado |
| T1-b | Permisos vencidos (P1-02) | Si el permiso **no está vigente**, las casillas empiezan **desmarcadas** (hoy se copian los permisos anteriores). El servidor ya valida; no cambia |
| T1-c | Cuadro de variantes (P1-03) | Refrescar el precio que muestra el cuadro tras guardar, sin reabrirlo. La causa exacta (copia local del producto contra la consulta invalidada) se confirma en la revisión técnica de T1 |
| T1-d | Texto financiero E4.1 (P1-04) | Reemplazar «Quedan $X a favor del proveedor (no se reparten solos)» por el texto aprobado: «Se aplican $A de los $T pagados. Los $X restantes quedan como saldo a favor de tu negocio con este proveedor y no se aplicarán automáticamente a otras deudas.» También el mensaje de éxito equivalente |
| T1-e | Separación de importes E4.3 (P1-05) | Mostrar por separado: pagos realizados, pagos aplicados, deuda pendiente, saldo a favor del negocio, anticipos reservados a pedidos y transferencias programadas, sin mezclar lo realizado con lo programado o cancelado. Sólo con los datos que ya devuelve la API |
| T1-f | Ubicación de formularios E3.1/E3.2 (P1-06) | «Desafectar asignación» junto a la asignación elegida; «Asignar pago a deudas» en el contexto del pago |
| T1-g | «Pagar deudas seleccionadas» (P1-17) | Acceso visible sin tener que abrir el pedido primero (por ejemplo, una indicación o un botón en la cuenta que lleve a la selección), con la misma acción y los mismos permisos |
| T1-h | «Todas las variantes» (P1-16, D-5) | Marca visual de la asociación que cubre todas las variantes, en la lista y en el selector |
| T1-i | Formatos y límites de importación (P1-18, D-5) | Texto visible: «XLSX o CSV · sólo se lee la primera hoja · hasta 5 MB · hasta 2000 filas», **tomado de las constantes existentes** (`MAX_BYTES_ARCHIVO`, `MAX_FILAS_IMPORTACION`) para que no se desfase |

### 13.2 Componentes y archivos afectados (en `testing-codex` `327d6c73`)

| Ítem | Archivo | Punto de referencia |
|---|---|---|
| T1-a | `src/app/operaciones/mi-panel/[slug]/caja/page.tsx` (258 líneas) | Orden de paneles; `#caja-vender` (l. 209); `irAVender` (l. 118) |
| T1-a | `src/components/business/operational-shift-panel.tsx` (353) | Sólo plegado y presentación; `onTurnoChange` sin cambios |
| T1-a | `src/components/business/caja-salidas-cajero.tsx` (626) | Historial `historial-salidas` (l. 605) plegado y de altura limitada |
| T1-a | `src/components/business/caja-tab.tsx` | **No se modifica** `VenderView` (l. 382); sólo se verifica que no se desmonte |
| T1-b | `src/components/business/permisos-catalogo.tsx` (60) | `FilaPermiso`: estado inicial de `f` (l. 25) cuando `!e.vigente` |
| T1-c | `src/components/business/inventario-tab.tsx` (1505) | `ProductoDetailDialog` (l. 998); consulta `negocio-inventario-productos` (l. 178) e invalidación (l. 243) |
| T1-d, g | `src/components/business/cuenta-proveedor-pedidos.tsx` (263) | Textos de las l. 133 y 152; acceso «Pagar deudas seleccionadas» (l. 137 y 219) |
| T1-e, f | `src/components/business/owner-proveedores.tsx` (1059) | Saldo (l. 98–101), movimientos (l. 708) y formularios de asignar y desafectar |
| T1-h | `src/components/business/owner-proveedores.tsx` (l. 547) y `src/components/business/producto-proveedores.tsx` (121, l. 105) | Opción «Todas las variantes» |
| T1-i | `src/components/business/importar-productos.tsx` (322, l. 201–205) | Constantes en `src/lib/importacion-archivo.ts` (`MAX_BYTES_ARCHIVO`) y `src/lib/importacion-productos-service.ts` (`MAX_FILAS_IMPORTACION`) |
| Pruebas existentes a conservar | `caja-tab-responsive-static-contract`, `operational-shift-panel.test`, `owner-proveedores.test.tsx` y las de componente del catálogo y la importación | Ajustar sólo si un texto aprobado cambia una aserción literal, nunca debilitar |

### 13.3 Criterios de aprobación de T1 (entregable 9)

1. **Revisión técnica breve** del diff: sólo presentación y textos; ningún cambio en rutas API, servicios, Prisma, migraciones ni permisos del servidor.
2. **Pruebas:** las de componente y estáticas existentes pasan. Una prueba de componente nueva y mínima comprueba que `VenderView` **es la misma instancia** al abrir y cerrar el turno y al plegar y desplegar (el carrito se conserva).
3. **Lint y typecheck** sin diagnósticos nuevos en los archivos tocados.
4. **Manual en TESTING** (después del despliegue conjunto de T1–T3), en móvil y escritorio, claro y oscuro:
   - **punto de venta:** sin turno, Caja primero; al abrir, Ventas primero; con productos en el carrito, plegar y desplegar paneles o cambiar el estado no lo vacía; con muchos egresos, Ventas sigue arriba; al cerrar, vuelve el orden sin turno; registrar una salida funciona;
   - **teclado y lector de pantalla:** recorrido completo coherente en los dos estados;
   - **permiso vencido:** al volver a habilitar, ninguna casilla viene marcada;
   - **variantes:** el precio nuevo se ve sin reabrir;
   - **cuenta corriente:** el texto E4.1 nuevo, los importes separados y los formularios en contexto, con datos QA existentes (sin pagos nuevos salvo los que pida la regresión);
   - **«Pagar deudas seleccionadas»** se encuentra sin instrucciones especiales;
   - **«Todas las variantes»** se distingue;
   - **importación:** se ven los formatos y los límites.
5. **Evidencia revisada por Claude:** HTTP sin 5xx, logs y, si hubo una operación de dinero en la regresión, SQL de solo lectura.
6. Ningún cambio en cálculos: los importes mostrados son los mismos de la API antes y después.

## 14. F10-D1 — diseño pendiente (entregable 10)

**Alcance aprobado (D-2).** Se implementa **sólo** después de aprobar el diseño.
- Corrección de egresos cuyo error se descubre **después del cierre del turno**.
- El egreso original y el cierre histórico, con sus importes declarados, **quedan intactos**.
- Conciliación contra la **diferencia del turno cerrado** y su entrega.
- Documento o movimiento correctivo **independiente y auditado**.
- **Sin dinero ficticio.**
- El dinero recuperado de verdad es un **ingreso nuevo en el turno abierto que lo recibe**.
- Los egresos vinculados a un proveedor pasan por el **motor financiero**, con ajuste del crédito o desvinculación, según el diseño.
- Las restricciones SQL de F10-C1 se levantan **sólo por mecanismos autorizados**.
- Idempotencia, permisos, auditoría e integridad transaccional.

**Referencias a las decisiones originales:**

| Fuente | Contenido |
|---|---|
| `F10_C_EGRESOS_CAJA_DISENO.md` §11 D9 | Corrección por compensación: un error posterior al cierre se corrige en F10-D **sin tocar el turno cerrado** ni su revisión |
| Ídem §11.1 ajuste 3 | Nunca reabrir ni modificar importes de un turno cerrado; tabla `compensaciones_egresos_caja` con `momento` `TURNO_ABIERTO` / `POSTERIOR_AL_CIERRE` |
| Ídem §13.1, §13.2 y §13.7 | Guardas SQL (`guard_operacion_egreso_caja`, `guard_movimiento_egreso_caja`, `guard_egreso_caja`); el modelo financiero del libro por turno |
| Ídem §15.3 **D-C1c-1** | Por qué la compensación posterior al cierre quedó **bloqueada**: una `REVERSION` sin turno crearía **dinero ficticio**, porque la entrega a custodia no es un movimiento del libro. Allí se esbozó la propuesta: (a) «conciliación de error de egreso» enlazando el egreso observado con la diferencia del cierre y la entrega; (b) «recupero de egreso» como ingreso en el turno abierto que recibe el efectivo |
| Migración `20261118150000_f10_c1c_block_post_close_compensation` | Bloqueo en la base: la base rechaza la `REVERSION` sin turno y las filas `POSTERIOR_AL_CIERRE`. El valor sigue en el CHECK como reserva. **F10-D1 debe levantarlo con una migración nueva y aditiva, nunca editando esta** |
| `caja-egresos-service.ts` (F5-A, D-8) | Un `PAGO_PROVEEDOR` vinculado a un proveedor no se compensa mientras el vínculo está vigente (`PAGO_VINCULADO_A_PROVEEDOR`); primero se desvincula en Proveedores. El crédito `PAGO_CAJA` está en `cuenta-proveedor-service.ts` |
| ROADMAP «Production / F10-D (criterio del operador, 2026-11-19)» | F10-D1 acotado: conciliación del error contra la diferencia del turno cerrado y recupero real como ingreso nuevo, sin esperar a F10-D completo |

**Lo que se presentará antes de implementar** (en una tarea de diseño):
1. **Diseño actualizado.**
2. **Escenarios exactos:**
   - egreso cargado por error y el efectivo nunca salió → sobrante del cierre ya entregado → conciliación sin movimiento de dinero;
   - importe mal cargado (parcial);
   - el efectivo salió y vuelve más tarde (total o parcial) → ingreso en el turno abierto receptor, vinculado al egreso;
   - egreso `PAGO_PROVEEDOR` vinculado (con desvinculación o ajuste del crédito);
   - `RETIRO_DUENO` confirmado o `NO_RECIBIDO`;
   - repeticiones y concurrencia contra el cierre de otro turno;
   - permisos (sólo el dueño).
3. **Migraciones nuevas posibles**, todas aditivas:
   - tabla de conciliación o recupero;
   - funciones de guarda nuevas que permitan sólo los casos aprobados;
   - **nunca** se modifica la migración de bloqueo ni las históricas.
4. **Matriz de efectos financieros por escenario**: libro (patas y cuentas), turno cerrado (sin cambios), turno receptor, cuenta del proveedor, reportes del día y auditoría.

## 15. Dependencias y bloqueos adicionales (entregable 11)

| # | Bloqueo o dependencia | Quién | Bloquea |
|---|---|---|---|
| 1 | **Autorización de T0**: crear la rama o worktree `codex/estabilizacion-final`, el commit de documentación (lista §11.2) y el push de esa rama | Operador | T0 → T1 |
| 2 | **Autorización para implementar T1** | Operador | T1 |
| 3 | **Decisión sobre P2-T24 / seguimiento del repartidor** (P0-08). Recomendado: conservar el modelo certificado de `main` (`LATEST_SAMPLE_ONLY`) en la candidata y dejar P2-T24 fuera (P2), salvo que se certifique | Operador | T5 |
| 4 | **Auditoría de elegibilidad** de cada trabajo que sólo está en `testing-codex` (§2.2): revisar P2-T40, T44, T52, T54, T23 y T53 | Claude, con revisión del operador | T5 |
| 5 | **Diseño de F10-D1**: presentación y aprobación | Claude → operador | T4 |
| 6 | **D-6**: comprobar en Production, sin escribir, que el push con la app cerrada en Android ya fallaba igual. Requiere la observación del operador en un teléfono con Production | Operador | Cierre de D-6 en T5 |
| 7 | Inventario de infraestructura de Production (sólo nombres) y respaldo | Operador, en sesión separada | T6 |
| 8 | Destino de los ~440 informes históricos sin versionar y redacción de los 4 con el correo | Operador | Nada crítico (fuera de T0) |
| 9 | Revisión del contenido de `scripts/security/` antes de versionarlo | Claude, con aprobación del operador | Commit opcional |
| 10 | **CI:** la ejecución de los logs de jobs desde aquí requiere permisos de administrador (403 por la API pública). ChatGPT lo verificó por su conector | Operador o ChatGPT | Evidencia de CI en T2 y T5 |
| 11 | **PENDIENTE registrado (operador, 2026-11-26):** la sección §B de `deligo-closeout` dice que `DELIGO_FULL_CONTEXT_LATEST.md` debe quedar sin seguimiento, pero está seguido en `testing-codex` y se versiona con la documentación. La documentación y el estado real del repositorio deben coincidir. **No se modifica el *skill* todavía** | Operador | Nada |

Estado de las filas 1, 2, 3 y 8 (2026-11-26):
- **filas 1 y 2:** T0 y T1 autorizados, sin push;
- **fila 3:** P2-T24 decidido, se conserva `LATEST_SAMPLE_ONLY`;
- **fila 8:** los informes históricos quedan como respaldo privado local.


## 16. Matriz de elegibilidad para la candidata (2026-11-26, revisión con evidencia; sin cambios de integración)

**Fuentes:**
- `git log origin/testing-codex ^origin/main`;
- `git cat-file` en las dos ramas;
- el mensaje del commit de Production `42ca5005`, que declara la composición del RC1;
- el informe local `P2_PRODUCTION_RC1_BUILD_AND_AUTOMATED_GATE.md` (no versionado);
- los marcadores de estado de `COMPLETED_TASKS`, `ROADMAP` y `CODEX_REPORT` en `testing-codex`;
- los informes de cada trabajo.

**Regla aplicada:**
- la documentación incompleta no hace a un trabajo no elegible;
- estar en TESTING no lo hace elegible;
- las discrepancias se resuelven con evidencia.

**Composición de Production (RC1, mensaje de `42ca5005`):**
- **incluye:** P2-T02, T31, T39, T40, T43, T45, T46-R2, T47, T49, T50, T51, T52, T53 (`CLOSED_OPERATOR_PASS`) y T55, más la infraestructura de T44-R1D, con T44-G3 «arrastrado sin resolver» por autorización del operador;
- **excluye por completo:** P2-T23 y P2-T24. Los archivos mixtos se reconstruyeron al último commit anterior a T23/T24.
- **Corrección del análisis previo (§2.1):** el *tracking* de `main` es más nuevo por fecha de commit, pero su **contenido es el anterior a T23/T24**: el modelo certificado `LATEST_SAMPLE_ONLY`.

| Trabajo | Funcionalidad | Estado documental | Commits sólo en `testing-codex` | Evidencia de pruebas | Estado real del código | En TESTING | En Production | Dependencias | Clasificación | Decisión recomendada para la candidata |
|---|---|---|---|---|---|---|---|---|---|---|
| **P2-T40** | Paquete de RC1 (A0/A1/R1–R3/FINAL) | `CLOSED_TESTING_CERTIFIED` («close P2-T40 Testing certification», 2026-09-21). Las menciones `…AWAITING_RECERTIFICATION` son anteriores | 4, **sólo docs** (`aa98d41e`…`e1fee008`) | Certificación de TESTING y RC1 | Igual en las dos ramas, salvo docs | Sí | **Sí** (RC1) | T31 (resuelto: la versión final de T40 prevalece) | **Elegible** | Conservar; sin acción |
| **P2-T44** | Push personal por cuenta (R1D) + G3 | `PAUSED_UNRESOLVED_AFTER_TIMEBOX` (G3) | 4, **sólo docs** (R1/R1D/R1E) | R1D incluido en RC1; G3 sin certificar | R1D en las dos ramas; G3 sin código nuevo | Sí | R1D sí; G3 arrastrado sin resolver | T31 y D-6 | **Elegible con condiciones** | Conservar R1D tal como está en Production. G3 sigue como limitación registrada, sin cambio respecto de Production. Comprobarlo junto con D-6 |
| **P2-T52** | PWA única (empleado y salón) | `CLOSED_TESTING_CERTIFIED`. Fase 4 diferida, sin autorización | 5, **sólo docs** | Certificación de TESTING y RC1 | Igual que en Production | Sí | **Sí** | Ninguna | **Elegible** | Conservar. La Fase 4 queda fuera (no hay código) |
| **P2-T53** | Ocupación y nitidez del panel de mesas | `CLOSED_OPERATOR_PASS` (no `CLOSED_TESTING_CERTIFIED`) | 2, **sólo docs** | Aprobación visual del operador; RC1 por reconfirmación expresa | Igual que en Production | Sí | **Sí** | Salón (conflictos D-1) | **Elegible** (con su terminología) | Conservar; revisarla en la regresión de Salón de la candidata |
| **P2-T23** | Reproducción suave de la trayectoria (cliente) | `SUPERSEDED_BY_PRODUCT_DECISION_INTO_P2_T54`; `P2_T23_COMPLETED_TECHNICALLY=NO` (A0 de T54) | 2 de docs, más código en el linaje T23/T24 (`tracking-playback.ts`, `tracking-trajectory.ts` y los archivos mixtos de *tracking*) | Reproducción controlada sin certificación física cerrada | **Presente en `testing-codex`**, ausente en `main` | Sí | **No** (excluido del RC1) | P2-T24 y los archivos de *tracking* | **No elegible** | No reactivar. La resolución de T5 conserva el comportamiento `LATEST_SAMPLE_ONLY` de Production. El código y el historial se preservan |
| **P2-T24** | Ajuste al mapa (OSRM) y transporte de trayectoria | `BLOCKED_NOT_RELEASE_ELIGIBLE`; `SUPERSEDED_AS_INDEPENDENT_TASK_BY_P2_T54` | 33 (docs + código) | El canario de control de R5 falló | Presente en `testing-codex` (`osrm-map-matching-provider.ts`, `t24-physical-witness.ts`, `t24-witness-revision.ts`, la ruta `api/testing/t24-physical-witness` con guarda `DELIGO_ENVIRONMENT === "TESTING"` → 404 fuera de TESTING, y los *scripts* de prueba) | Sí | **No** | `delivery-tracking-map.tsx`, `use-repartidor-tracking.ts`, `realtime-publish.ts`, `realtime-types.ts` y `api/repartidor/ubicacion` | **No elegible** (decisión del operador, P0-08) | Igual que T23. Además, en T5 hay que revisar que la ruta de prueba quede inerte en Production y que `realtime-publish.ts` y `api/repartidor/ubicacion` no cambien de comportamiento |
| **P2-T54-R1** | Navegación del repartidor con cámara de seguimiento | Los docs dicen `IMPLEMENTED_TESTED_AWAITING_COMMIT_PUSH_AND_TESTING_DEPLOY_AUDIT` y «bloqueado en su propia autorización de integración». **Discrepancia:** el código **sí está** en `testing-codex` (commit `b2ec74fb`, 2026-09-27, ancestro de `327d6c73`). La rama `work/p2-t54-driver-navigation` no tiene commits propios | 1 de docs, más `b2ec74fb` (feat) | Pruebas unitarias de `delivery-navigation-ux`. **`PHYSICAL_CERTIFICATION_REQUIRED=SI`**, sin certificación física | Presente (`delivery-navigation.tsx`, `delivery-navigation-ux.ts`) | **Sí** (desplegado con `327d6c73`) | **No** | Navegación del repartidor; comparte área con el *tracking* | **Evidencia insuficiente** | **Decisión del operador:** (a) certificación física (Android e iOS) en T5, o (b) excluirlo de la candidata (volver la navegación del repartidor al comportamiento de Production) |
| **P2-T18** | Chat entre pestañas (AUTH01) y sesiones simultáneas (AUTH02) | AUTH01 `OPEN_BLOCKED_BY_AUTH` / navegador real; AUTH02 `RESOLVED` (BUG-001/002) | 4: **instrumentación + sus reversiones** (contribución neta nula) | BUG-001/002 certificados | Sin código propio neto | Sí | AUTH01: misma limitación que en Production (P2-11) | T3 (resto de la clase AUTH02) | **Elegible con condiciones** | Sin acción en la candidata. El resto de AUTH02 va en T3 |
| P2-T31 | Push en Android | En RC1; abortos intermitentes `UNRESOLVED` | 0 | RC1 | Igual que en Production | Sí | Sí | D-6 | **Elegible con condiciones** | Comprobar D-6 (no es regresión) en T5 |
| P2-T38 | Experiencia de instalación (PWA) | `CLOSED_TESTING_CERTIFIED` (certificación física cerrada el 2026-09-26, **después** del RC1) | 4 de docs, más el código `5dc91a21` y `147f24a3` (2026-09-26) | Certificación física y de *push* registrada | Sólo en `testing-codex` | Sí | **No** | PWA (T52) | **Elegible** | Incluir; repasarlo en la regresión de la candidata (instalación en un teléfono) |
| P2-T56 (R3A/R3B) | Autoridad única de stock | `CLOSED_TESTING_CERTIFIED` | 26 + R3A 25 | Bloques 1–6 y CI | Sólo en `testing-codex` | Sí | No | Todos los bloques | **Elegible** | Incluir |
| F4-*, F5-A, F9, F10-*, CATALOG, BUG-001/002/003 | Caja, compras, pagos, catálogo e identidad | Certificados (Bloques 1–6 y anteriores) | Varios | Certificaciones y CI | Sólo en `testing-codex` | Sí | No | — | **Elegible** | Incluir. F10-D1 es obligatorio antes de habilitar egresos y compras (D-2) |
| P2-T33, P2-T37 | Futuras | `BLOCKED_UNTIL_FUNCTIONAL_PREREQUISITES` / secuenciadas | 0 | — | Sin código | — | — | — | No aplica | — |

**Pendiente para T5:** resolver P2-T54-R1 (decisión del operador) y preparar la resolución de *tracking* según lo decidido sobre P0-08. No se implementa ahora.

## 17. T1 — implementación local (2026-11-26) · rama `codex/estabilizacion-final`

**Niveles de estado:**
- implementación local: **SÍ**;
- verificación estática: **SÍ**;
- CI: **NO** (requiere push, no autorizado);
- despliegue en TESTING: **NO**;
- certificación funcional: **NO**.

**T1 no está certificada.**

**Commits:**

| Commit | Contenido |
|---|---|
| `c52ecd82` | T0: documentación (17 archivos) |
| `e283c450` | T1-01: punto de venta |
| `ab295580` | T1-02 y T1-03: permisos vencidos y cuadro de variantes |
| `86d89279` | T1-04 a T1-08: proveedores |
| `63d29856` | T1-09: límites de importación |
| `7500dd9d` | CI: pruebas de T1 y ejecución de CI para la rama |

| ID | Estado | Qué cambió (sólo presentación) |
|---|---|---|
| T1-01 | Implementada | Nuevo `caja-cajero-secciones.tsx`: las secciones tienen clave estable dentro de un mismo contenedor y su orden depende del turno **confirmado** (`turnoAbiertoId`).<br>• **Sin turno o cargando:** Caja y turno → Ventas → Salidas → herramientas (Etiquetas y Catálogo) → Ventas anteriores.<br>• **Con turno:** Ventas primero, el indicador «Turno abierto · `<Caja>`» y Caja y turno plegado. El panel queda **montado** (`hidden`), con un botón «Ver turno/Ocultar» que expone `aria-expanded`, y sólo se vuelve a plegar cuando cambia el turno (no en cada refresco).<br>• **Historial de salidas:** plegado (`<details>`, «Salidas de este turno (N)»), con la lista completa en una región desplazable de 60vh.<br>• «Recibir mercadería» queda en el encabezado, compacto. Las ventas sin turno no cambian |
| T1-02 | Implementada | `casillasInicialesPermiso`: un permiso vencido, revocado o inexistente empieza **todo desmarcado**. Se muestra el distintivo «Vencido el…» y «Tenía: …» (sólo informativo). Un permiso vigente no cambia |
| T1-03 | Implementada | El detalle del producto se deriva de la **última lectura del catálogo** (por id). La copia tomada al hacer clic queda sólo como respaldo. Se muestra el precio nuevo sólo después de la respuesta exitosa y la relectura; un rechazo deja el precio vigente |
| T1-04 | Implementada | `textoRepartoPago` con el texto aprobado en el Bloque 3, y el mensaje de éxito equivalente. «a favor del proveedor» desaparece |
| T1-05 | Implementada, con una **limitación** | Tarjetas separadas: deuda pendiente, **total pagado y acreditado** (`totales.creditosConfirmados` de `/cuenta`), aplicado, **saldo a favor de tu negocio** (`aFavorGeneral`), **anticipos reservados** (`anticiposPedidos`), **transferencias programadas** y **pagos cancelados** (créditos `RECHAZADO`, `ANULADO` o `DESVINCULADO` que entrega `/cuenta`: suma de filas, sin fórmula nueva).<br>**Limitación:** el servidor no entrega un «total pagado» que excluya los ajustes a favor. Por eso la tarjeta dice «Pagos confirmados y ajustes a favor». Separarlos requeriría un dato nuevo del motor: no se tocó y queda para decisión del operador |
| T1-06 | Implementada | Asignar, reasignar, desafectar, anular y las acciones con motivo se abren **dentro del elemento elegido** (`EnContexto`, con anclas `cuenta:`, `pago:`, `deuda:` y `asignacion:`). Son los mismos formularios y confirmaciones. Mientras uno está abierto, los demás botones siguen bloqueados como antes |
| T1-07 | Implementada | Una indicación visible con deuda y sin selección, y el botón «Ver deudas con saldo», que aplica el filtro y abre los pedidos con saldo. La barra «Pagar deudas seleccionadas» no cambia |
| T1-08 | Implementada | Elegir «Todas las variantes» marca cada variante como incluida (marcada y deshabilitada, «(incluida en «Todas las variantes»)»), quita las variantes sueltas ya marcadas de ese producto y envía **una** asociación general. La lista dice «— todas las variantes». `producto-proveedores.tsx` ya lo indicaba; no cambió |
| T1-09 | Implementada | Un bloque «Formatos y límites» en la pantalla única del dueño y del empleado: XLSX o CSV, primera hoja, 5 MB y 2.000 filas. Los valores salen de `MAX_BYTES_ARCHIVO` y de `MAX_FILAS_IMPORTACION`, que pasó a `importacion-limites.ts`. El servicio lo **re-exporta**, con el mismo nombre y valor. El lector y el motor no cambiaron |

### 17.1 Cómo se preservan el carrito y el inicio de venta

- `VenderView` guarda el carrito en memoria. Si se desmonta, se pierden el carrito y el inicio de venta.
- Las cinco secciones son hijos **con clave estable** (`turno`, `ventas`, `salidas`, `herramientas`, `historial`) del **mismo** contenedor. Cambiar el orden del arreglo hace que React **mueva** los nodos existentes (reconciliación por clave) sin desmontar ninguna instancia.
- Ni el carrito, ni el inicio de venta (`sessionStorage` + estado), ni la protección de precios, ni el intento de cobro, ni las consultas cambian. No se duplican componentes, consultas ni efectos.
- **Orden de teclado y lector de pantalla:** se mueve el DOM, no sólo lo visual, así que el orden de Tab y de lectura **coincide siempre** con lo que se ve. No hizo falta CSS `order`.
- **Foco:** si el foco del usuario estaba en una sección y el movimiento lo hace perder, se lleva al encabezado de la primera sección (`data-foco-seccion`, `tabIndex=-1`). Un refresco automático nunca mueve el foco.
- **Prueba:** `page.secciones.test.tsx` usa la página con la `VenderView` **real**:
  - con 2 unidades en el carrito, abre y cierra el turno;
  - comprueba que `#caja-vender` es **el mismo nodo**;
  - comprueba que la cantidad sigue en 2, que el inicio guardado es idéntico y que hubo **un solo** `POST …/ventas/inicio`;
  - comprueba el orden y el indicador;
  - comprueba que el detalle está plegado pero montado, y que un refresco del mismo turno no lo vuelve a plegar.

  Una mutación de control (claves que cambian con el turno) **hace fallar** la prueba.

### 17.2 Verificación estática y pruebas (ejecutadas en esta tarea, worktree local)

- **TypeScript completo:** 40 diagnósticos, **idénticos a la base** `327d6c73`, comparados archivo por archivo y código por código. Ninguno en archivos de T1.
- **ESLint** en los 17 archivos de T1: 0 problemas.
- **`git diff --check`:** OK.
- **Pruebas de componente y estáticas que tocan archivos de T1** (21 archivos, sin las de integración): 240 pasan y 6 fallan.
  - Los 6 fallos son **los mismos 6 de la base sin modificar**: F10-B1 *sale route*, F9 ×2, I3, R2B-F1 y R2C 21/22. Son preexistentes y van a T2.
  - Hubo 8 fallos adicionales que eran **artefactos de fin de línea** del worktree nuevo (`core.autocrlf=true` → CRLF en contratos estáticos que buscan `\n`). Se comprobó con la copia en LF. El contenido versionado está en LF, como en el CI.
- **Pruebas nuevas o adaptadas (todas pasan):**
  - `page.secciones.test.tsx` (3);
  - `permisos-catalogo.test.tsx` (3);
  - `inventario-tab.variantes.test.tsx` (2, con una mutación de control que falla con la copia vieja);
  - `cuenta-proveedor-pedidos.test.ts` (2);
  - `importar-productos.limites.test.ts` (2);
  - `owner-proveedores.test.tsx` (+3: T1-05, T1-06 y T1-08).

  Están sumadas al workflow general, cada una en su proceso.
- No hubo pruebas funcionales manuales locales.

### 17.3 Lista manual breve para TESTING (después del despliegue conjunto T1–T3)

Móvil y escritorio, modo claro y oscuro:
1. **Cajero sin turno:** Caja y turno primero, con selección, fondo e «Iniciar turno» visibles. Ventas sigue disponible, como antes.
2. Con 1–2 productos en el carrito, **abrir el turno** → Ventas pasa primero, aparece «Turno abierto · `<Caja>`», el carrito sigue intacto y «Caja y turno» queda plegado abajo. Desplegarlo, ver el turno y volver a plegarlo.
3. **Registrar una salida** → el historial está plegado, «Salidas de este turno (N)» lo despliega y la lista se desplaza dentro de su recuadro.
4. **Cerrar el turno** (diferencia 0, caja QA) → vuelve el orden sin turno.
5. Con teclado (Tab) y TalkBack o VoiceOver, el recorrido sigue el orden visible.
6. **Dueño, permisos de catálogo:** un empleado con un permiso vencido muestra «Vencido el…» y todas las casillas desmarcadas.
7. **Inventario:** cambiar el precio de una variante → se ve sin reabrir.
8. **Ficha de proveedor:**
   - las tarjetas de importes están separadas;
   - «Pagar deudas seleccionadas» con un pago mayor muestra el texto de saldo a favor **del negocio**;
   - «Asignar», «Desafectar» y «Reasignar» se abren junto al elemento;
   - «Ver deudas con saldo» funciona;
   - «Todas las variantes» marca las variantes como incluidas.
9. **Importar productos** (dueño y empleado con permiso): se ve el bloque «Formatos y límites».

Evidencia a revisar: HTTP sin 5xx, logs y, si hubo una salida o un pago, SQL de solo lectura.

## 18. Plan concreto para T2 (no ejecutado; requiere autorización)

1. **C5 en el CI general (D-7):**
   - copiar `src/lib/f10-c2c-inicio-vencido.integration.test.ts` desde `3c498c24` (sólo el archivo, sin cherry-pick);
   - agregar `bun --no-env-file test src/lib/f10-c2c-inicio-vencido.integration.test.ts` antes de la tanda de regresión;
   - verificar en el log que se ejecuta contra PostgreSQL (2 pruebas y 41 `expect()`, sin `skip`);
   - el workflow focalizado no se porta.
2. **Suite D-3:**
   - inventariar primero las pruebas existentes (`importacion-*`, `catalogo-empleado-*`, `etiquetas-precio-*`, F10-C2c), para no duplicarlas;
   - agregar sólo los casos faltantes:
     - aislamiento entre negocios y entre actores;
     - independencia de permisos;
     - ocultamiento de costos;
     - `STOCK_NO_PERMITIDO`;
     - `PRODUCTO_SIN_PRECIO`;
     - restricciones del precio de variante;
     - `ETIQUETA_PENDIENTE`;
     - importación: idempotencia, reintentos, confirmaciones simultáneas, tandas, conflictos de código, límites, formatos numéricos, aislamiento y etiquetas pendientes;
   - todo en el PostgreSQL efímero del CI, cada suite en su proceso.
3. **TypeScript (40 diagnósticos de la base):**
   - clasificar por archivo: `address-form.test` 7, `prisma/seed.ts` 6, `owner-caja-revisiones` 3 (BigInt), `mozo/[slug]` 3, `permission-prompt` 2, `barcode-scanner.test` 2, `session-cookie.test` 2, `migrate-sqlite-to-postgres` 2, y uno en cada uno de `push`, `caja-turnos-entrega`, `auth`, `promocionados-tab`, `repartidor/profile-tab`, `location-map-picker`, `address-map-picker`, `client-profile-panel`, `operational-shift-panel.test`, `config-tab`, `mozo/page`, `api/superadmin/denuncias` y `api/denuncias`;
   - corregir primero los de flujos críticos (Caja, turnos, autenticación, *push*, mozo) y registrar los demás.
4. **Pruebas que fallan localmente:**
   - clasificar las 6 observadas, más el resto de la batería completa;
   - separar las sensibles a CRLF (pasan en CI con LF) de los errores reales;
   - corregir las reales sin debilitar ninguna aserción.
5. **CI completo:**
   - lint y build;
   - la batería completa en el CI, sin exclusiones;
   - sin actualizaciones masivas de dependencias (el aviso de Node 20 queda P2-10).
6. **Criterio de cierre de T2:**
   - CI verde;
   - C5 ejecutada;
   - la suite D-3 completa;
   - los diagnósticos clasificados.

## 19. Riesgos y limitaciones encontrados en T0/T1

- **Movimiento de foco al reordenar:** está probado en happy-dom. En navegadores reales y con TalkBack o VoiceOver queda para la prueba manual de TESTING (§17.3).
- **T1-05:** el «total pagado» incluye los ajustes a favor (es el dato existente). Si se quiere separarlos hace falta un dato nuevo del servidor, que no se tocó.
- **T1-07:** con el filtro «Con saldo» los pedidos con saldo se abren solos. Al quitar el filtro vuelven a plegarse.
- **Worktree nuevo con `core.autocrlf=true`:** los contratos estáticos que buscan `\n` fallan localmente. No pasa en el CI (Linux, LF). Para las comparaciones locales la copia se convirtió temporalmente a LF y después se devolvió a CRLF. El índice y los commits están en LF.
- **`node_modules` del worktree:** es una unión (*junction*) hacia `deligo-dev-local\node_modules`, que está en la misma base `327d6c73`. Está ignorada por Git. Para regenerar el cliente Prisma o instalar dependencias habrá que hacerlo con cuidado (comparten carpeta).
- **P2-T54-R1:** está desplegado en TESTING sin certificación física; los docs decían otra cosa (§16).
- **El reemplazo de módulos en las pruebas de página** (`barcode-scanner` sólo con `BarcodeScanner`) obliga a ejecutar cada suite en su propio proceso, como ya hacía el workflow.
