# P2-T52-A0 — Operations/Mozo Legacy Flow Coexistence Audit + Single-PWA Consolidation Design

Fecha: 2026-09-20
Alcance: AUDITORÍA / MAPEO DE CONTRATO / DISEÑO ÚNICAMENTE. Cero
implementación, cero borrado de ruta, cero redirect, cero cambio de
manifest/SW/auth/DB/schema/migración, cero Production, cero prueba
física.

## 0. Corrección de una suposición previa

```text
PREVIOUS_ASSUMPTION_MOZO_DEAD=REJECTED_BY_OPERATOR_EVIDENCE
MOZO_ROUTE_CURRENTLY_FUNCTIONAL=SI
MOZO_USES_CUENTA_OPERATIVA=SI (confirmado por código, no sólo por evidencia física)
FINAL_MOZO_LEGACY_CLASSIFICATION=CURRENT_REQUIRED (ver §21 para el detalle
  completo — NO es "legacy muerto", NO es "duplicación accidental": es
  una superficie de compatibilidad ACTIVAMENTE mantenida, con
  dependencias reales de push/PWA/install-prompt que exigen tratamiento
  cuidadoso)
```

El operador tenía razón: `/mozo` es completamente funcional hoy, y una
`CuentaOperativa` real puede autenticarse indistintamente desde
`/mozo/iniciar-sesion` o `/operaciones/ingresar`. La auditoría de código
confirma que esto NO es un accidente ni una duplicación — es una
arquitectura de **reutilización literal** deliberada y bien documentada
en el propio código (comentarios explícitos "compatibilidad temporal"),
no dos implementaciones paralelas.

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=94c2258c0a288ea24f6be8be2b36637d701b862c (== origin/testing-codex)
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes de esta misma
  sesión + next-env.d.ts, artefacto auto-generado por `next dev`
  usado en la prevalidación visual de T51-R1 — ninguno es código de
  producto ajeno)
PRODUCT_CODE_DIRTY_AJENO=NO
```

Worktree T39 no tocado. Production sólo consultada en modo lectura:
`origin/main` = `ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`, sin cambios.
Ningún deploy, ninguna mutación de DB, ningún logout de sesión ajena,
ningún dato modificado.

## 2. Modelo funcional actual — confirmado por código

El modelo descrito por el operador es exactamente lo que implementa el
código:

```text
CUENTA_OPERATIVA_IS_PERSONAL_IDENTITY=SI
EMPLOYEE_BUSINESS_LINK_IS_SEPARATE_FROM_ACCOUNT_CREATION=SI
BUSINESS_DETERMINES_EMPLOYEE_ROLE_AREA=SI
MOZO_IS_EMPLOYEE_ROLE_OR_AREA=SI (específicamente: es un valor de
  `Empleado.areaOperativa`, la autoridad efectiva actual — ver §12)
CURRENT_PREFERRED_ENTRYPOINT=DELIGO_OPERACIONES
```

## 3. Modelos de datos (`prisma/schema.prisma`)

```text
ACCOUNT_MODEL=CuentaOperativa (líneas 1023-1041): identidad personal —
  id, nombre, email @unique, password?, googleId? @unique, telefono?,
  emailVerified?, activo, eliminado. Relación `empleados: Empleado[]`
  (UNA CuentaOperativa puede vincularse a MÚLTIPLES negocios, uno por
  Empleado distinto — ver @@unique([negocioId, cuentaOperativaId])
  abajo, que permite como máximo UN vínculo activo por negocio, pero
  ningún límite entre negocios distintos).

EMPLOYEE_LINK_MODEL=Empleado (líneas 1043-1071): negocioId (obligatorio,
  UN empleado pertenece a UN negocio), cuentaOperativaId? (FK opcional
  a CuentaOperativa, onDelete: SetNull — un Empleado puede existir SIN
  cuenta vinculada todavía, ej. recién creado por el negocio antes de
  que el mozo acepte la invitación). @@unique([negocioId,
  cuentaOperativaId]) — una cuenta no puede tener dos vínculos activos
  al MISMO negocio.

ROLE_MODEL=Empleado.rol (String @default("mozo"), valores libres:
  mozo/cajero/cocinero/admin) — ver §12: YA NO es la autoridad de
  acceso a áreas, se mantiene sólo por compatibilidad de contrato/
  estadísticas legacy.

AREA_OPERATIVA_MODEL=Empleado.areaOperativa (String
  @default("sin_asignar"), valores: sin_asignar|mozo|salon|pyr,
  administrado EXCLUSIVAMENTE por el negocio — "el empleado NO puede
  cambiarla", comentario textual del schema). `asignacionVersion`
  (Int) se incrementa en cada cambio de área para que la PWA detecte
  el nuevo contexto sin polling agresivo.

JOIN_CODE_MODEL=CodigoIncorporacionMozo (líneas 1073-1098): negocioId,
  empleadoObjetivoId? (Empleado preexistente al que apunta el código),
  rol (default "mozo" — HOY sólo se emiten/consumen códigos de rol
  "mozo", ver §11), codeHash @unique, expiresAt, usedAt,
  usedByCuentaOperativaId?, revokedAt.
```

**Confirmado con evidencia**: una misma `CuentaOperativa` SÍ puede
vincularse a varios negocios (un `Empleado` por negocio, cada uno con
su propia `areaOperativa` independiente) — el home `/mozo` (§ más
abajo) ya renderiza explícitamente una grilla de "vínculos" (`vinculos:
VinculoMozo[]`) por esta razón, con un botón "Unirme a otro negocio".

Adicionalmente auditado (autoridad de Terminal, para no confundirla con
la de cuenta personal): `TerminalOperativa` (líneas 1111-1132) tiene su
propio comentario explícito: *"Áreas: salon | pyr (**nunca mozo**)"* —
el modo Terminal (dispositivo compartido, no cuenta personal) **nunca**
puede operar el área Mozo. Mozo es, estructuralmente, un área
EXCLUSIVA del modelo de cuenta personal — otra confirmación de que
`/mozo` no es un "modo" alternativo sino una interfaz sobre la misma
identidad personal que ya usa Operaciones.

## 4. Flujo moderno de registro/login/unión (Operaciones)

```text
OPERATIONS_REGISTER_FLOW=`/operaciones/registro` → componente
  compartido `CuentaOperativaRegisterForm` → `POST /api/operativo/register`.
  Sólo crea la identidad personal (nombre/email/password) — NO pide
  negocio, rol ni área. Confirmado por comentario textual del propio
  archivo: *"A propósito NO pide negocio/área/rol: crear la cuenta
  solo crea la identidad personal. Vincularse a un negocio sigue
  requiriendo el código de incorporación."*

OPERATIONS_LOGIN_FLOW=`/operaciones/ingresar` → `POST /api/operativo/login`
  → cookie `deligo_operativo_session` (`OPERATIONAL_SESSION_COOKIE_NAME`,
  src/lib/auth.ts:225) → redirect a `/operaciones/mi-panel`. Incluye
  además `GET /api/operativo/auth/google` (Google SSO), que
  `/mozo/iniciar-sesion` NO ofrece.

OPERATIONS_JOIN_FLOW=el "home" de selección de negocio en
  `/operaciones/mi-panel` es un RE-EXPORT literal de `src/app/mozo/page.tsx`
  (`export { default } from "@/app/mozo/page"`) — el mismo componente,
  el mismo formulario de "Unirme a un negocio", el mismo
  `POST /api/operativo/mozos/unirse`. No existe una implementación de
  unión por código separada/propia de Operaciones — es exactamente la
  misma.

OPERATIONS_ROLE_RESOLUTION=el negocio fija `Empleado.areaOperativa`
  (fuera de este flujo, en la administración de empleados del negocio
  — no auditado a fondo por estar fuera del árbol Mozo/Operaciones,
  pero confirmado que NO ocurre en `/api/operativo/mozos/unirse`, ver
  §11); el cliente resuelve el área EFECTIVA vía
  `resolveAreaOperativaEfectiva()` (src/lib/area-operativa.ts), la
  MISMA función pura que usa `/api/operativo/me` para poblar
  `areaOperativaEfectiva` en cada vínculo devuelto.
```

## 5. Flujo legacy de registro/login/unión (`/mozo`)

```text
MOZO_LOGIN_FLOW=`/mozo/iniciar-sesion` → **el mismo**
  `POST /api/operativo/login` (verificado línea por línea: mismo
  fetch, mismo body {email,password}, misma cookie resultante) →
  `router.replace("/mozo")`. Sin opción de Google SSO en esta pantalla
  (única diferencia de contrato observable).

MOZO_REGISTER_FLOW=`/mozo/registro` → **el mismo** componente
  `CuentaOperativaRegisterForm` → **el mismo**
  `POST /api/operativo/register` — confirmado explícitamente por el
  comentario de `/operaciones/registro/page.tsx` citado en §4. Sin
  botón de Google (única diferencia visual).

MOZO_JOIN_FLOW=`/mozo` (home) contiene el formulario de unión por
  código inline (mismo componente que sirve a `/operaciones/mi-panel`,
  ver §4) — **el mismo** `POST /api/operativo/mozos/unirse`.
  `/mozo/unirse` es sólo un redirect shim (`redirect("/mozo?accion=unirse")`)
  que abre ese mismo formulario vía query param — no tiene lógica
  propia. Nada lo enlaza actualmente desde la UI (alcanzable sólo por
  URL directa).
```

## 6. Tabla de rutas `/mozo` completas

| ROUTE | ACTIVE | UI_PURPOSE | AUTH_API | SESSION_COOKIE | BACKEND_DEPENDENCIES | LINKS_IN | LINKS_OUT | PWA_IDENTITY | REACHABLE |
|---|---|---|---|---|---|---|---|---|---|
| `/mozo` | SÍ | Home personal: selección de negocio, unión por código, logout (**componente COMPARTIDO** con `/operaciones/mi-panel`) | `/api/operativo/me`, `/api/operativo/mozos/unirse`, logout compartido | `deligo_operativo_session` | `Empleado`, `CuentaOperativa`, `CodigoIncorporacionMozo` | `/mozo/iniciar-sesion`, `/mozo/registro`, `/mozo/unirse` (shim), botón "Unirme a otro negocio" | `/mozo/panel/[slug]`, `/operaciones/mi-panel/[slug]/salon\|pyr`, `/operaciones` (área sin_asignar), `/operaciones/cuenta` (sólo en árbol mi-panel) | mozo (DynamicManifest, manifest-mozo.json) | SÍ |
| `/mozo/iniciar-sesion` | SÍ | Login personal (sin Google) | `POST /api/operativo/login` (**idéntico** a Operaciones) | `deligo_operativo_session` | `CuentaOperativa` | ninguno propio | `/mozo` (tras login), `/mozo/registro` | mozo | SÍ |
| `/mozo/registro` | SÍ | Registro personal (sin Google) | `POST /api/operativo/register` (**idéntico** a Operaciones) | (ninguna hasta login) | `CuentaOperativa` | ninguno propio | `/mozo` (tras éxito) | mozo | SÍ |
| `/mozo/unirse` | SÍ (shim) | Redirect a `/mozo?accion=unirse` | — | — | — | ninguno (no linkeado desde UI actual) | `/mozo` | mozo | SÍ (URL directa) |
| `/mozo/panel/[slug]` | SÍ | Panel completo de trabajo Mozo (mesas, pedidos, alta manual, pedidos listos, push) — **FUENTE CANÓNICA COMPARTIDA**, `/operaciones/mi-panel/[slug]` la re-exporta literalmente | `GET/PUT /api/operativo/mozo/panel/[slug]`, `POST .../pedidos`, `.../push-subscription` | `deligo_operativo_session` | `Empleado`, `Mesa`, `Pedido` | `/mozo` (desde la card "Abrir panel de Mozo" cuando area=mozo) | `/mozo/panel/[slug]/pedido/[mesaId]` | mozo | SÍ |
| `/mozo/panel/[slug]/pedido/[mesaId]` | SÍ | Configurador de pedido manual — **re-exportado literalmente** por `/operaciones/mi-panel/[slug]/pedido/[mesaId]` | `POST /api/operativo/mozo/panel/[slug]/pedidos` (T46-R2 ya lo corrigió acá) | `deligo_operativo_session` | `Producto`, `Pedido`, `Mesa` | `/mozo/panel/[slug]` | — | mozo | SÍ |

Hallazgo lateral (fuera del árbol `/mozo`, pero relevante):
`/operaciones/mi-panel/[slug]/mozo/page.tsx` es una vista "pedidos
listos" AISLADA y separada (backend propio
`/api/operativo/mozo/pedidos-listos/[slug]`), que el propio código de
`/mozo/panel/[slug]/page.tsx:844-846` documenta como **ya superada**:
*"Bugfix-Mozo-1A: entregar un pedido listo directamente desde el panel
(antes solo era posible desde la vista aislada
/operaciones/mi-panel/[slug]/mozo, que ya no es el destino principal)"*.
Ningún link activo apunta a esa ruta hoy (grep exhaustivo sin
resultados) — es una ruta huérfana, técnicamente reachable por URL
directa, pero fuera del grafo de navegación actual. No se toca en esta
auditoría (no forma parte del árbol `/mozo`), pero se registra como
candidato de limpieza futura bajo T52.

## 7. Comparación LOGIN legacy vs moderno (prioridad alta)

| CONTRACT | MOZO | OPERACIONES | SAME/DIFFERENT | IMPACT |
|---|---|---|---|---|
| LOGIN_ENDPOINT | `POST /api/operativo/login` | `POST /api/operativo/login` | **SAME** | Ninguno — literalmente la misma request |
| SESSION_COOKIE | `deligo_operativo_session` | `deligo_operativo_session` | **SAME** | Una sesión abierta en un árbol sirve en el otro sin re-login |
| ACCOUNT_MODEL | `CuentaOperativa` | `CuentaOperativa` | **SAME** | Una sola identidad, nunca duplicada |
| PASSWORD_AUTH | SÍ (mismo endpoint) | SÍ (mismo endpoint) | **SAME** | — |
| GOOGLE_AUTH | NO (sin botón/enlace en la UI) | SÍ (`/api/operativo/auth/google`) | **DIFFERENT** (sólo UI) | Un usuario que sólo tiene Google vinculado no puede "ver" esa opción en `/mozo/iniciar-sesion`, pero su cuenta funciona igual si llega autenticado por otra vía |
| ME_ENDPOINT | `GET /api/operativo/me` | `GET /api/operativo/me` | **SAME** | — |
| LOGOUT_ENDPOINT | `performOperativeLogout()` (mismo helper compartido, ver `src/lib/operativo-logout.ts`) | mismo helper | **SAME** | — |
| REGISTER_ENDPOINT | `POST /api/operativo/register` | `POST /api/operativo/register` | **SAME** | — |
| POST-LOGIN REDIRECT | `/mozo` | `/operaciones/mi-panel` | DIFFERENT (esperado — es la única diferencia de propósito) | Ninguno — ambos destinos terminan resolviendo el mismo estado vía `/api/operativo/me` |

## 8. Pregunta central — respondida con evidencia

```text
DO_MOZO_AND_OPERATIONS_SHARE_THE_SAME_ACCOUNT_AUTHORITY=SI
DO_MOZO_AND_OPERATIONS_SHARE_THE_SAME_SESSION_COOKIE=SI (deligo_operativo_session)
DO_MOZO_AND_OPERATIONS_SHARE_THE_SAME_LOGIN_ENDPOINT=SI (/api/operativo/login)
DO_MOZO_AND_OPERATIONS_SHARE_THE_SAME_EMPLOYEE_LINK=SI (mismo Empleado/CuentaOperativa,
  mismo POST /api/operativo/mozos/unirse)
DO_MOZO_AND_OPERATIONS_SHARE_THE_SAME_BUSINESS_ROLE_ASSIGNMENT=SI (mismo
  campo Empleado.areaOperativa, misma resolveAreaOperativaEfectiva())
```

**Conclusión documentada**: `/mozo` NO es otra "clase de cuenta" ni un
sistema de auth paralelo — es OTRA INTERFAZ/ENTRYPOINT sobre la MISMA
identidad personal que Operaciones. El mecanismo técnico exacto de esta
unificación es la re-exportación literal de componentes React
(`export { default } from "@/app/mozo/..."`) combinada con un único
helper de navegación (`useOperativoNav()`, `src/components/operativo/use-operativo-nav.ts`)
que resuelve `homeHref`/`loginHref`/`registroHref`/`panelHref`/
`noSessionMode` según el pathname (`/mozo/**` vs
`/operaciones/mi-panel/**`) — el código mismo lo documenta como
*"compatibilidad temporal"* en un comentario explícito.

## 9. Unión por código — comportamiento exacto (`/api/operativo/mozos/unirse`)

```text
JOIN_CODE_CREATED_BY=el negocio (fuera del árbol Mozo/Operaciones —
  administración de empleados, no auditada a fondo por no ser parte
  del alcance de este task)
JOIN_CODE_TARGETS=un Empleado PREEXISTENTE (`empleadoObjetivoId`
  obligatorio en la validación — el endpoint NUNCA crea un Empleado
  nuevo, sólo consume la invitación y vincula `cuentaOperativaId`)
JOIN_CODE_ASSIGNMENT_BEHAVIOR=vinculación pura (CuentaOperativa ↔
  Empleado existente) — el endpoint jamás toca `areaOperativa` ni
  `rol`; esos campos ya estaban fijados por el negocio ANTES de emitir
  el código
USER_CAN_SELF_ASSIGN_ROLE=NO (confirmado por código: el body de la
  request es únicamente `{codigo}`, sin ningún campo de rol/área)
```

Hallazgo adicional: el endpoint actual (`/api/operativo/mozos/unirse`)
**sólo acepta códigos con `rol === "mozo"`** (`invitation.rol !== "mozo"`
→ código inválido). No se auditó a fondo si existe un mecanismo
equivalente de invitación/vinculación para empleados de área
Salón/PyR (probablemente vive en la administración de empleados del
negocio, fuera del árbol Mozo/Operaciones) — se registra como pregunta
abierta para una auditoría futura si se retoma la consolidación de PWA
de forma más amplia, pero no bloquea las conclusiones de este A0.

## 10. Rol vs Área operativa — autoridad real (`src/lib/area-operativa.ts`)

```text
ROLE_FIELD_CURRENT_PURPOSE=LEGACY/COMPATIBILIDAD ÚNICAMENTE. El propio
  código lo documenta: *"rol se mantiene en la firma solo por
  compatibilidad de contrato con los consumidores existentes (y para
  estadísticas/legacy no retiradas), pero NO participa en la
  autorización de área"*. Un empleado con rol="mozo" cuya área NO sea
  explícitamente "mozo" YA NO obtiene acceso — la compatibilidad
  histórica (sin_asignar + rol mozo → mozo) se cerró tras la migración
  `backfill_employee_operational_areas`.

AREA_OPERATIVA_CURRENT_PURPOSE=ES LA ÚNICA AUTORIDAD real de acceso a
  áreas (mozo/salon/pyr/sin_asignar), fijada exclusivamente por el
  negocio, resuelta por una función PURA compartida.

EFFECTIVE_OPERATIONS_AREA_AUTHORITY=resolveAreaOperativaEfectiva()
  (src/lib/area-operativa.ts) — importada por
  resolveOperativoMozoForSlug, GET /api/operativo/me, la
  administración de empleados y los guards de las APIs legacy de
  mozo. Documentada como fuente única de verdad, "no duplicar esta
  lógica".
```

## 11. Panel Mozo moderno vs legacy — NO son dos implementaciones

```text
MOZO_ORDER_FLOW_DUPLICATED=NO
MOZO_ORDER_API_SHARED=SI (POST /api/operativo/mozo/panel/[slug]/pedidos,
  el mismo endpoint que T46-R2 corrigió esta misma sesión)
MOZO_SERVER_AUTHORITY_SHARED=SI
```

`/operaciones/mi-panel/[slug]/page.tsx` es un `export { default } from
"@/app/mozo/panel/[slug]/page"` literal — CERO diferencia funcional,
visual, de permisos o de API entre "el panel moderno de Mozo" y "el
panel legacy de Mozo": son EL MISMO ARCHIVO. Lo mismo aplica al
configurador de pedido manual (`/mozo/panel/[slug]/pedido/[mesaId]`,
re-exportado por `/operaciones/mi-panel/[slug]/pedido/[mesaId]`) — ya
confirmado en T46-R2/T47 de esta misma sesión. No existe ninguna
"matriz funcional" que comparar porque no hay dos implementaciones:
hay UNA, servida bajo dos árboles de ruta.

## 12. Navegación y links reales — clasificación completa

Grep exhaustivo (`href="/mozo`, `router.push/replace("/mozo`,
`redirect("/mozo`, `startsWith("/mozo`, literales en
`role-config.ts`/`push.ts`) sobre `src/app`, `src/components`,
`src/lib` (excluidos tests):

| REFERENCIA | ARCHIVO | CLASIFICACIÓN |
|---|---|---|
| `href="/mozo/registro"` | `mozo/iniciar-sesion/page.tsx` | ACTIVE_UI |
| `router.replace("/mozo")` | `mozo/iniciar-sesion/page.tsx`, `mozo/registro/page.tsx` | ACTIVE_UI |
| `redirect("/mozo?accion=unirse")` | `mozo/unirse/page.tsx` | ACTIVE_UI (shim, no linkeado desde otra UI) |
| `homeHref/panelHref: "/mozo..."` | `use-operativo-nav.ts` (MOZO_NAV) | ACTIVE_UI (autoridad de navegación compartida) |
| `pathname === "/mozo" \|\| startsWith("/mozo/")` | `dynamic-manifest.tsx` | PWA_START_URL / PWA identity |
| `pathname === "/mozo" \|\| startsWith("/mozo/")` | `install-prompt.tsx` | PWA install-prompt scoping (T38-adyacente) |
| `pathname === "/mozo" \|\| startsWith("/mozo/")` | `permission-prompt.tsx` | Push permission-prompt scoping |
| `` `/mozo/panel/${slug}` `` | `mesa-order-ready-notification.ts` | PUSH (deep-link **hardcodeado**, nunca `/operaciones/mi-panel`) |
| `startsWith("/mozo/panel/")` | `push.ts:1136` | PUSH (filtro de panelUrl válido) |
| `startUrl/loginUrl: "/mozo"` | `role-config.ts` | PWA_START_URL |
| `startsWith("/mozo/")` → role "mozo" | `role-config.ts:228` (`getRoleFromPath`) | PWA identity fallback |
| `url: "/mozo/panel/..."` | `push-subscription/test/route.ts` | TEST (fixture, no código de producto) |

```text
CURRENT_PRODUCT_LINKS_TO_MOZO=6 (iniciar-sesion, registro, unirse-shim,
  use-operativo-nav MOZO_NAV × 3 propiedades)
CURRENT_OPERATIONS_LINKS_TO_MOZO=0 (ningún archivo bajo
  src/app/operaciones enlaza literalmente a "/mozo" — la reutilización
  ocurre por RE-EXPORT de componente, no por navegación cruzada)
AUTH_REDIRECTS_TO_MOZO=0 (ningún guard de auth redirige a /mozo — el
  único redirect relacionado es interno al propio flujo, "/mozo/unirse"
  → "/mozo?accion=unirse")
```

## 13. PWA Mozo — identidad separada, real y activa hoy

```text
MOZO_SEPARATE_PWA_CURRENTLY_INSTALLABLE=SI
MOZO_SEPARATE_PWA_CURRENTLY_REFERENCED=SI
MOZO_PWA_START_URL=/mozo/
MOZO_PWA_SCOPE=/mozo/
```

`/mozo` **NO** está en `PRINCIPAL_PWA_ROLES` (`src/lib/pwa-identity.ts`:
sólo `cliente|negocio|operaciones|repartidor` emiten su identidad PWA
vía metadata SSR del layout). Mozo usa el mecanismo más antiguo,
`DynamicManifest` (client-side, `src/components/shared/dynamic-manifest.tsx`,
montado GLOBALMENTE en `src/app/layout.tsx:95`): en cualquier página
bajo `/mozo` (o exactamente `/mozo`), inyecta en runtime `<link
rel="manifest" href="/manifest-mozo.json">`, `theme-color=#D97706`
(ámbar), `apple-touch-icon=/icon-mozo-192x192.png`, y cambia
`document.title`.

`public/manifest-mozo.json` existe, está completo (íconos maskable
192/512, `scope: "/mozo/"`, `start_url: "/mozo/"`, `display:
standalone`, `launch_handler.client_mode: navigate-existing`) — es una
PWA instalable HOY, genuinamente separada de "DeliGO Operaciones"
(`manifest-operaciones.json`, scope `/operaciones/`, indigo,
`#4F46E5`). Los archivos de íconos (`icon-mozo-192x192.png`,
`icon-mozo-512x512.png`) existen físicamente en `public/`.

Además, `install-prompt.tsx` y `permission-prompt.tsx` (componentes
compartidos de instalación PWA y permiso de notificaciones) YA
reconocen `/mozo` como su propio ámbito con la misma condición exacta
(`pathname === "/mozo" || pathname.startsWith("/mozo/")`) que
`DynamicManifest` — Mozo es, en la práctica actual, una superficie PWA
de primera clase, no un vestigio inerte.

## 14. Riesgo de instalaciones existentes

```text
LEGACY_MOZO_INSTALLED_PWA_COMPATIBILITY_RISK=ALTO si se toca el
  start_url/scope sin plan de compatibilidad
```

Un usuario que instaló "DeliGO Mozos" HOY tiene una PWA cuyo `scope`
es exactamente `/mozo/`. Si en una futura ronda `/mozo` redirigiera
íntegramente a `/operaciones/mi-panel` (fuera del scope `/mozo/`), la
app instalada perdería su comportamiento `standalone` en esa
navegación (según el navegador, puede degradar a chrome de navegador
normal, "salirse" de la ventana app-like, o —en el peor caso—
mostrarse rota si el navegador trata la salida de scope como
navegación externa). La sesión (`deligo_operativo_session`) seguiría
siendo válida — el riesgo es puramente de experiencia de instalación,
no de autenticación. Cualquier estrategia de consolidación debe decidir
explícitamente: (a) mantener `/mozo/` como scope válido indefinidamente
(compatibilidad total), o (b) diseñar un "upgrade path" que seguiría
funcionando dentro del scope existente antes de redirigir hacia afuera.

## 15. Push — íconos y deep-links (read-only, NO modificado)

```text
MOZO_PUSH_ICON_STILL_REQUIRED=SI
MOZO_PUSH_DEEPLINKS_TO_LEGACY_ROUTE=SI
```

`public/sw.js:467` mapea el rol "mozo" al ícono
`/icon-mozo-192x192.png` para notificaciones push — esto es
INDEPENDIENTE de si la PWA Mozo separada sigue existiendo: el icono de
push seguiría siendo válido aunque la instalación de PWA Mozo
desapareciera, tal como advierte el propio task spec (§19).

`src/lib/mesa-order-ready-notification.ts:237-238` construye el deep
link de la notificación "pedido listo" con
`` `/mozo/panel/${negocioSlug}` `` **hardcodeado**, sin ninguna
condición sobre si el mozo destinatario usa el árbol `/mozo` o
`/operaciones/mi-panel` — TODO push de "pedido listo" abre siempre
`/mozo/panel/[slug]`. El service worker (`public/sw.js:1067-1089`)
tiene lógica de `notificationclick` específicamente atada al string
literal `/mozo/panel/` (para reusar una pestaña ya abierta bajo ese
prefijo). Esto significa que `/mozo/panel/[slug]` es hoy una
DEPENDENCIA DURA de push, independientemente de cuánto se use la UI de
`/mozo` como entrypoint de login.

## 16. Service worker — referencias read-only, sin editar

Mapeado (no modificado): `public/sw.js` líneas 434, 467, 896, 960,
1067-1089 — icono por rol, comentarios de arquitectura de deep-link
("moderno: /mozo/panel/... o legacy: /m/[token]"), y el matching de
cliente abierto por prefijo `/mozo/panel/`. Ningún cambio realizado.

## 17. Empleado / Salón legacy — clasificados individualmente

```text
EMPLOYEE_SEPARATE_PWA_STATE=EXISTE, arquitectura DISTINTA a Mozo
  (`role-config.ts`: "empleado", tokenBased:true, pathPrefix "/e/",
  manifest-empleado.json, magic-link /e/{token} — sin sesión de
  cuenta personal, no comparable 1:1 con el modelo CuentaOperativa)
SALON_SEPARATE_PWA_STATE=EXISTE, arquitectura DISTINTA a Mozo
  ("salon", tokenBased:true, pathPrefix "/s/", manifest-salon.json,
  magic-link /s/{token} — mismo patrón que Empleado, no session-based)
MOZO_SEPARATE_PWA_STATE=EXISTE, arquitectura SESSION-BASED
  (CuentaOperativa + cookie), ÚNICO caso con reutilización de
  componente 1:1 con Operaciones vía re-export literal
```

Empleado y Salón usan magic-links con token en la URL (arquitectura
"tokenBased", sin login/sesión personal) — un modelo estructuralmente
diferente al de Mozo (sesión personal + CuentaOperativa). No se asume
que compartan el mismo estado de "legacy" que Mozo; clasificar su
posible consolidación con las superficies modernas de Salón/PyR de
Operaciones (que sí usan sesión personal) requeriría su propia
auditoría dedicada, fuera del alcance de este A0 centrado en Mozo.

## 18. Clasificación final de `/mozo`

```text
LEGACY_MOZO_ROUTE_FINAL_CLASSIFICATION=CURRENT_REQUIRED
```

Justificación, contra los 6 estados posibles del task spec:

- **NO** es `FUNCTIONALLY_DUPLICATED` en el sentido de "dos
  implementaciones que hacen lo mismo" — es una ÚNICA implementación
  compartida por re-export; no hay nada que "deduplicar" a nivel de
  código de panel/pedido.
- **NO** es `SAFE_TO_REMOVE` ni `SAFE_TO_DEPRECATE` todavía: push
  ("pedido listo") depende HOY de la ruta literal `/mozo/panel/[slug]`
  (§15), el service worker tiene lógica atada a ese string (§16), y
  existe una PWA instalable real con scope `/mozo/` que usuarios reales
  pueden tener instalada (§13-14).
- **SÍ** es `COMPATIBILITY_REQUIRED` en el sentido de que su
  ÚNICO propósito real actual, más allá de esas dependencias técnicas,
  es servir como entrypoint alternativo para quien todavía no migró a
  `/operaciones` — el copy del propio código lo llama "compatibilidad
  temporal".
- Clasificación combinada más precisa: **CURRENT_REQUIRED** — no por
  aportar funcionalidad que Operaciones no tenga, sino porque tres
  sistemas activos (push, service worker, PWA instalada) dependen
  today de su existencia literal como ruta y como scope.

## 19. Opciones futuras (máximo 3, ninguna implementada)

### OPTION_A — Mantener `/mozo` como compatibility entrypoint, quitar identidad PWA separada

Dejar las rutas `/mozo/**` funcionando exactamente igual (login,
registro, home, panel — todas siguen siendo el mismo código
compartido), pero: (1) actualizar `mesa-order-ready-notification.ts`
para construir el deep-link según el árbol real del destinatario (o
simplemente usar siempre `/operaciones/mi-panel/[slug]` una vez
confirmado que el re-export sirve ambos), (2) quitar `/mozo` de
`DynamicManifest`/`install-prompt`/`permission-prompt` (dejar de
ofrecer "instalar DeliGO Mozos" como PWA separada, todo nuevo usuario
instala "DeliGO Operaciones"), (3) decidir qué pasa con quien YA tiene
"DeliGO Mozos" instalada (mantener el manifest sirviendo, aunque ya no
se promueva activamente, para no romper esas instalaciones).
**Riesgo**: bajo. **Complejidad**: media (toca push + 3 componentes
compartidos de PWA, requiere el plan de compatibilidad del punto 3).

### OPTION_B — Redirigir gradualmente `/mozo` al flujo moderno, preservando sesión

Convertir `/mozo`, `/mozo/iniciar-sesion`, `/mozo/registro` en
redirects (server o client) hacia sus equivalentes de
`/operaciones/**`, preservando la cookie `deligo_operativo_session`
(que ya es compartida, cero fricción). `/mozo/panel/[slug]` seguiría
existiendo (dependencia dura de push, §15) o se actualizaría el deep
link de push en paralelo. **Riesgo**: medio-alto — instalaciones
existentes de PWA Mozo (scope `/mozo/`) quedarían navegando fuera de
su propio scope en cada redirect (§14), degradando su experiencia
`standalone` inmediatamente, no de forma gradual. **Complejidad**:
media-alta (requiere resolver el caso de instalación existente ANTES
de activar el redirect, no después).

### OPTION_C — Mantener ambos árboles indefinidamente, sin cambios

No tocar nada: dejar `/mozo` y `/operaciones` coexistiendo como hoy
(ya es virtualmente gratis en mantenimiento, porque son el MISMO
código compartido, no dos bases que divergen). **Riesgo**: ninguno
nuevo. **Complejidad**: nula. **Costo**: la identidad PWA fragmentada
persiste (dos apps instalables para la misma cuenta), y el hallazgo de
T52 original (home sin identidad visual coherente, resuelto en T51)
podría repetirse conceptualmente si en el futuro se percibe que "hay
dos DeliGO Operaciones".

```text
RECOMMENDED_OPTION=OPTION_A
```

Razón: resuelve el objetivo real de consolidación (una sola PWA
promovida activamente, "ONE_OPERATIONS_PWA_TARGET") sin el riesgo de
romper instalaciones existentes de forma abrupta, sin tocar rutas
funcionales (cero regresión de acceso), y sin requerir decisiones aún
no confirmadas (como forzar un redirect que rompería `scope` para
usuarios reales). Requiere, eso sí, corregir primero la dependencia
dura de push (§15) — ver plan R1 en §20.

## 20. Objetivo de arquitectura — confirmado sin contradicción

```text
ONE_EMPLOYEE_ACCOUNT_MODEL=SI (CuentaOperativa, ya unificado)
ONE_OPERATIONS_PWA_TARGET=SI (objetivo — hoy son DOS PWA instalables
  con la misma cuenta: Mozo y Operaciones; ver Option A)
BUSINESS_ASSIGNS_EMPLOYEE_ROLE_AREA=SI (ya implementado, Empleado.areaOperativa)
MOZO_IS_AN_EMPLOYEE_AREA=SI (ya implementado)
LEGACY_MOZO_ROUTE_FINAL_DECISION=PENDING_OPERATOR_DECISION (esta
  auditoría clasifica y recomienda OPTION_A; la decisión de cuál
  ejecutar sigue siendo del operador, no de Claude)
```

## 21. Plan R1 (sólo si el operador autoriza — NO implementado en A0)

| PATH | CURRENT_PURPOSE | PROPOSED_CHANGE | WHY | COMPATIBILITY_RISK | ROLLBACK |
|---|---|---|---|---|---|
| `src/lib/mesa-order-ready-notification.ts` | Construye deep-link de push "pedido listo" hardcodeado a `/mozo/panel/[slug]` | Ninguno urgente — el link sigue siendo válido para AMBOS árboles (re-export); sólo si se ejecuta Option A punto 2, evaluar si conviene apuntar a `/operaciones/mi-panel/[slug]` en su lugar | Reduce la dependencia literal de la palabra "/mozo" en código productivo, sin cambiar comportamiento (misma página física) | BAJO (mismo componente en ambas rutas) | Revertir el string del deep-link |
| `src/components/shared/dynamic-manifest.tsx`, `install-prompt.tsx`, `permission-prompt.tsx` | Tratan `/mozo` como scope PWA/instalación propio | Quitar la condición especial de `/mozo` (dejar de promover instalación separada) — SÓLO tras confirmar plan de compatibilidad para instalaciones existentes | Consolida a una sola PWA promovida (Option A) | MEDIO (afecta usuarios con PWA Mozo ya instalada — requiere entender el `launch_handler`/`scope` real antes de tocar) | Revertir la condición, restaura el comportamiento actual |
| `public/manifest-mozo.json`, íconos `icon-mozo-*` | Manifest/íconos de la PWA Mozo separada | Mantener el archivo sirviendo (nunca borrar mientras existan instalaciones activas) — evaluar sólo si el manifest deja de referenciarse dinámicamente | Instalaciones existentes seguirían resolviendo su manifest | BAJO si sólo se deja de referenciar activamente, ALTO si se borra el archivo | No borrar nunca sin datos de telemetría de instalaciones activas |
| `public/sw.js` | Lógica de notificationclick atada a `/mozo/panel/` | Ninguno en R1 — depende de la decisión de deep-link de arriba | — | — | — |

```text
R1_PRODUCT_FILES_PLANNED=PENDIENTE_DE_AUTORIZACIÓN_DEL_OPERADOR (no se
  fija un número cerrado en A0 — depende de qué punto de Option A se
  autorice ejecutar primero)
R1_TEST_FILES_PLANNED=PENDIENTE
R1_MANIFEST_FILES_PLANNED=0 esperado si sólo se deja de REFERENCIAR el
  manifest dinámicamente (el archivo en sí no se toca)
R1_ASSET_CHANGES_PLANNED=0 (los íconos existentes se preservan)
```

## 22. Plan de tests futuro (diseñado, NO implementado)

```text
A. Una cuenta creada en /operaciones/registro puede iniciar sesión en
   /operaciones/ingresar Y en /mozo/iniciar-sesion (mismo POST, misma
   cookie) — contrato ya cubierto implícitamente por los tests
   existentes de /api/operativo/login, extender con un caso cruzado.
B. Una cuenta vinculada por código recibe el área ya definida por el
   negocio (nunca la elige el usuario) — test de contrato sobre
   /api/operativo/mozos/unirse confirmando que la respuesta nunca
   permite un `area` en el body de request.
C. Un empleado con areaOperativa="mozo" resuelve areaOperativaEfectiva
   === "mozo" sin importar el valor de `rol` — extender los tests
   existentes de resolveAreaOperativaEfectiva si no cubren ya esta
   combinación.
D. La misma cuenta+vínculo no se duplica entrando por /mozo vs
   /operaciones — verificar @@unique([negocioId, cuentaOperativaId])
   más un test de integración que intente unirse dos veces al mismo
   negocio (ya cubierto parcialmente por el caso LINK_EXISTS del
   endpoint, ver §9).
E. Login legacy y moderno no crean identidades distintas — mismo test
   que A, extendido a confirmar que ambos flujos resuelven el MISMO
   `cuentaOperativaId`.
F. Logout preservado — test de que performOperativeLogout() invalida
   la sesión sin importar desde qué árbol se llamó.
G. Permisos preservados — ningún cambio de autorización server-side en
   ninguna opción propuesta; test de regresión sobre los guards
   existentes de /api/operativo/mozo/panel/[slug].
H. Pedido manual preservado — suite ya existente de T46-R2 sirve como
   regresión (mismo endpoint compartido).
I. Salón/PyR preservados — fuera del árbol Mozo, sin cambios
   propuestos; regresión de las suites existentes de esas áreas.
J. Push no regresa — test de que el deep-link de "pedido listo" sigue
   resolviendo a una página funcional (sea cual sea el string elegido
   en R1).
K. PWA Operaciones preservada — regresión de manifest-operaciones.json
   sin cambios (T51 no se toca).
L. Compatibilidad /mozo según la estrategia elegida — test específico
   de la opción A/B implementada (ej. confirmar que /mozo sigue
   respondiendo 200 y sirviendo su propio manifest si se elige NO
   redirigir).
```

## 23. Estados preservados sin cambio (T51 y otras tareas)

```text
P2_T51_STATUS=CLOSED_TESTING_CERTIFIED (no tocado — home visual de
  /operaciones intacto)
P2_T55_STATUS=CLOSED_TESTING_CERTIFIED
P2_T50_STATUS=CLOSED_TESTING_CERTIFIED
P2_T49_STATUS=CLOSED_TESTING_CERTIFIED
P2_T47_STATUS=CLOSED_TESTING_CERTIFIED
P2_T45_STATUS=CLOSED_TESTING_CERTIFIED
P2_T43_STATUS=CLOSED_TESTING_CERTIFIED
P2_T44_STATUS=PAUSED_UNRESOLVED_AFTER_TIMEBOX
P2_T46_ORIGINAL_STATUS=CLOSED_PRODUCTION
P2_T46_R2_STATUS=CLOSED_TESTING_CERTIFIED_AWAITING_PRODUCTION_PROMOTION
CLIENT_MESA_SILENT_DEFAULT_PAYMENT_FINDING=OPEN
T38_TOUCHED=NO
T40_TOUCHED=NO
T44_TOUCHED=NO
T39_TOUCHED=NO
T46_R2_TOUCHED=NO
```

## 24. Cierre de esta ronda (A0)

```text
PRODUCT_FILES_CHANGED_DURING_A0=0
API_FILES_CHANGED_DURING_A0=0
TEST_FILES_CHANGED_DURING_A0=0
MANIFEST_FILES_CHANGED=0
SERVICE_WORKER_CHANGED=0
AUTH_CHANGED=NO
SESSION_CHANGED=NO
DB_CHANGED=NO
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
PRODUCTION_TOUCHED=NO
```
