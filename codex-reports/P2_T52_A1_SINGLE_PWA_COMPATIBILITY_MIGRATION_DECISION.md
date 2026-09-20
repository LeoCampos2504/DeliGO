# P2-T52-A1 — Operations Single-PWA Compatibility Migration Decision

Fecha: 2026-09-20
Alcance: AUDITORÍA PROFUNDA + DISEÑO DE COMPATIBILIDAD + CONTRATO DE
IMPLEMENTACIÓN. Cero código de producto, cero cambio de ruta/manifest/
service worker/push/auth/DB/schema/migración, cero Production.

## 0. Autoridad y hallazgos preservados de A0

Preservados sin volver a auditar (ver
`codex-reports/P2_T52_A0_MOZO_OPERATIONS_COEXISTENCE_AND_PWA_CONSOLIDATION_AUDIT.md`):

```text
MOZO_ROUTE_CURRENTLY_FUNCTIONAL=SI
MOZO_USES_CUENTA_OPERATIVA=SI
DO_MOZO_AND_OPERATIONS_SHARE_THE_SAME_ACCOUNT_AUTHORITY=SI
DO_MOZO_AND_OPERATIONS_SHARE_THE_SAME_SESSION_COOKIE=SI
DO_MOZO_AND_OPERATIONS_SHARE_THE_SAME_LOGIN_ENDPOINT=SI
DO_MOZO_AND_OPERATIONS_SHARE_THE_SAME_EMPLOYEE_LINK=SI
DO_MOZO_AND_OPERATIONS_SHARE_THE_SAME_BUSINESS_ROLE_ASSIGNMENT=SI
LEGACY_MOZO_ROUTE_FINAL_CLASSIFICATION=CURRENT_REQUIRED
ONE_EMPLOYEE_ACCOUNT_MODEL=SI
ONE_OPERATIONS_PWA_TARGET=SI (objetivo, no aún alcanzado)
```

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=247e4319a6b766ff2752b57343b2719de69dfa9d (== origin/testing-codex)
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes + next-env.d.ts,
  artefacto auto-generado por `next dev` — ninguno es código de
  producto ajeno)
PRODUCT_CODE_DIRTY_AJENO=NO
```

Worktree T39 no tocado. `origin/main` en lectura únicamente:
`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`, sin cambios.

## 2. Modelo actual — fijado como invariante (sin re-auditar)

```text
CURRENT_EMPLOYEE_IDENTITY=CuentaOperativa
CURRENT_EMPLOYEE_BUSINESS_RELATION=Empleado
CURRENT_OPERATIONAL_AREA_AUTHORITY=Empleado.areaOperativa
MOZO_IS_EMPLOYEE_AREA=SI
MOZO_IS_SEPARATE_ACCOUNT_TYPE=NO
OPERATIONS_AND_MOZO_SHARE_SESSION=SI
OPERATIONS_AND_MOZO_SHARE_PANEL_CODE=SI
```

## 3. El problema real

```text
T52_PRIMARY_PROBLEM=DUPLICATED_INSTALLABLE_IDENTITY_AND_LEGACY_ENTRYPOINT
```

No hay duplicación de auth, panel ni backend (ya descartado en A0). El
problema real y único es que una misma `CuentaOperativa` puede terminar
con DOS PWA instalables distintas (DeliGO Operaciones y DeliGO Mozos)
para la misma identidad y, en gran parte, el mismo código funcional.

## 4. Preservación funcional de `/mozo` — confirmada, sin cambios

```text
KEEP_MOZO_ROUTES_FOR_COMPATIBILITY=SI
MOZO_ROUTE_REMOVAL_IN_R1=NO
```

`/mozo`, `/mozo/iniciar-sesion`, `/mozo/registro`,
`/mozo/panel/[slug]`, `/mozo/panel/[slug]/pedido/[mesaId]` se
mantienen exactamente como están. Ningún R1 de T52 los toca.

## 5. Comportamiento real de una PWA instalada — investigado con fuentes oficiales

No se asumió nada — se consultó documentación oficial de Chrome/web.dev
sobre el mecanismo de actualización de manifest de Chrome/WebAPK.

**Fuentes**:
- [How Chrome handles updates to the web app manifest — web.dev](https://web.dev/articles/manifest-updates)
- [A better way to update your web apps — Chrome for Developers blog](https://developer.chrome.com/blog/improvements-to-web-app-updates)
- [WebAPKs on Android — web.dev / Chrome for Developers](https://developers.google.com/web/fundamentals/integration/webapks)

Hallazgos exactos:

```text
INSTALL_TIME_BEHAVIOR=el manifest presente en la página al momento de
  instalar determina la identidad guardada (id, name, icons, start_url,
  scope, display) — esa identidad queda registrada a nivel de OS
  (WebAPK en Android, bookmark "standalone" en iOS), no se re-deriva
  en cada visita normal en pestaña de navegador.

UPDATE_BEHAVIOR=Chrome verifica actualizaciones del manifest "cuando
  la PWA se lanza" (Android) o al abrir la pestaña, y en Desktop sólo
  si no se verificó en las últimas 24 h. Los campos verificados
  (Desktop): name, short_name, display, scope, shortcuts, start_url,
  theme_color, file_handlers. Android además: icons, background_color,
  orientation, web_share_target. Icono y nombre ahora se tratan como
  "security sensitive" — un cambio ya NO fuerza un diálogo disruptivo,
  se ofrece como sugerencia opcional en un menú, el usuario puede
  ignorarlo indefinidamente. "Los cambios a `start_url` requieren que
  el `id` del manifest esté establecido" (web.dev) — `manifest-mozo.json`
  YA declara `"id": "/mozo?pwa=mozo"` explícito, así que su identidad
  está anclada a ese `id`, no sólo al `start_url`.

LAUNCH_BEHAVIOR=lanzar el ícono instalado navega SIEMPRE al `start_url`
  REGISTRADO al momento de instalar (`/mozo/` para Mozo) — el proceso
  de lanzamiento no "decide" a dónde ir basándose en qué manifest esté
  siendo servido hoy en otras rutas; usa el registro ya guardado por el
  SO/navegador.

EXISTING_INSTALL_BEHAVIOR=una vez lanzada, la verificación de "sigo
  dentro de mi scope" para mantener el modo standalone ocurre contra
  el `scope` REGISTRADO al instalar (`/mozo/`), no contra lo que
  `DynamicManifest` inyecte dinámicamente hoy en esa página. El check
  de actualización (arriba) ocurre en ESE MISMO lanzamiento, contra el
  manifest servido en ESE MOMENTO en esa URL — por eso importa qué
  sirve `/mozo/` HOY, pero sólo en el momento en que la app YA instalada
  se abre, no en cualquier visita de un navegador externo.
```

La documentación no cubre explícitamamente qué ocurre si el manifest
se vuelve completamente inalcanzable/inválido en la URL original — se
registra como un vacío de la documentación oficial, no como un hecho
asumido.

## 6. Hipótesis de compatibilidad — evaluada con evidencia de código, NO sólo teoría

```text
KEEP_LEGACY_MANIFEST_FILE=SI
KEEP_LEGACY_ICON_FILES=SI
KEEP_LEGACY_SCOPE=SI
KEEP_LEGACY_START_URL=SI
STOP_PROMOTING_NEW_MOZO_INSTALLS=SI (**ya es así hoy** — ver §7, no
  requiere ningún cambio de código nuevo)
```

## 7. Hallazgo central de esta ronda — el "problema" de promoción YA está resuelto en código

Este es el hallazgo más importante de A1, y contradice la premisa
implícita del task spec de que `install-prompt.tsx` necesita
modificarse para "dejar de promover" Mozo. **Auditoría de código
confirma que ya NO lo promueve, desde antes de esta sesión**:

```tsx
// src/components/shared/install-prompt.tsx
export function InstallPrompt() {
  const pathname = usePathname()
  if (isMozoRoute(pathname)) return null   // ← YA excluye /mozo por completo
  return <InstallPromptInner pathname={pathname} />
}
```

El banner/FAB de instalación (Android directo, guía manual, banner
iOS) **NUNCA se renderiza** en ninguna página bajo `/mozo/**` —
confirmado leyendo el componente completo (645 líneas). Lo mismo
aplica a `permission-prompt.tsx` (el banner genérico de "activar
notificaciones"), que también excluye `/mozo` por completo
(`if (isMozo) return` en el efecto que decide mostrarse, y en
`handleAccept`).

```text
REMOVE_MOZO_FROM_INSTALL_PROMPT_SAFE=N/A — YA ESTÁ REMOVIDO (no hay
  nada que quitar; la condición de exclusión ya existe en producción)
EFFECT_ON_EXISTING_INSTALLED_MOZO=NINGUNO (nunca se tocó este archivo,
  cero riesgo)
```

Combinado con el hallazgo de A0 (`CURRENT_OPERATIONS_LINKS_TO_MOZO=0`
— ningún archivo bajo `/operaciones` enlaza a `/mozo`), la conclusión
es: **hoy, en código, no existe ningún camino activo que dirija a un
usuario NUEVO hacia instalar "DeliGO Mozos"**. Los únicos caminos
restantes hacia una instalación nueva de Mozo son EXTERNOS al código
(un marcador/enlace viejo guardado por un empleado, comunicación
externa desactualizada, o el ícono del menú nativo "Instalar app" del
propio navegador si alguien llega a `/mozo` por URL directa) — ninguno
de los cuales se resuelve con un cambio de código en esta ronda.

## 8. DynamicManifest — auditado en profundidad, NO se recomienda tocar en R1

```text
REMOVE_MOZO_FROM_DYNAMIC_MANIFEST_SAFE=NO (ver razón exacta abajo)
RESULTING_MANIFEST_ON_MOZO_ROUTE=si se quitara el caso especial, el
  fallback sería getRoleFromPath(pathname) — para CUALQUIER subruta
  con contenido (`/mozo/panel/x`, `/mozo/iniciar-sesion`, etc.) ese
  fallback YA resuelve "mozo" correctamente (getRoleFromPath también
  chequea `pathname.startsWith("/mozo/")`), así que en la práctica
  NO cambiaría nada para esas rutas. PERO para la ruta EXACTA `/mozo`
  (sin barra final, el HOME del panel personal) el fallback de
  getRoleFromPath NO matchea `startsWith("/mozo/")` (falta la barra) y
  cae al default final → "cliente". Quitar el caso especial
  ROMPERÍA la identidad de manifest/tema/ícono exactamente en la
  página más visitada de todo el árbol Mozo (el home).
EXISTING_INSTALL_UPDATE_RISK=NINGUNO si no se toca — el `start_url`
  real registrado en `manifest-mozo.json` es `"/mozo/"` (CON barra
  final), así que el LANZAMIENTO de la app instalada siempre navega a
  esa URL con barra, que YA resuelve "mozo" correctamente incluso sin
  el caso especial. El caso especial de `DynamicManifest` sólo importa
  para la variante SIN barra (`/mozo` exacto, alcanzada por navegación
  interna del propio SPA, no por el lanzador de la PWA instalada) — no
  tocar esta rama no tiene ningún efecto sobre el ciclo de
  actualización de una instalación existente.
```

**Conclusión**: no hay ninguna razón basada en evidencia para tocar
`DynamicManifest` en R1. Su condición especial de `/mozo` NO es
redundante (protege el home exacto) y NO representa ningún riesgo para
instalaciones existentes (el ciclo de lanzamiento/actualización de la
app instalada usa su propio `start_url` registrado, que ya resuelve
correctamente sin necesidad de tocar nada).

## 9. Permission prompt — confirmado, propósito distinto al de instalación

```text
MOZO_PERMISSION_PROMPT_CURRENT_PURPOSE=banner GENÉRICO de activación
  de notificaciones push en el primer login, usado hoy para
  Cliente/Negocio/Repartidor (comentario textual del propio archivo:
  "Notifications: requested here for ALL roles (cliente, negocio,
  repartidor)" — Mozo/Operaciones NUNCA estuvo en esa lista). Mozo
  tiene su PROPIO flujo de suscripción push, contextual, dentro del
  panel compartido (`/mozo/panel/[slug]/page.tsx` →
  `POST /api/operativo/mozo/panel/[slug]/push-subscription`) — no
  depende de este banner genérico en absoluto.
SAFE_TO_REMOVE_MOZO_PERMISSION_SCOPE=NO_APLICA (no se toca — cambiar
  esta exclusión sería una decisión de LIFECYCLE de suscripción push,
  territorio explícito de T40, fuera de alcance de T52)
```

Hallazgo lateral (no accionable en esta ronda, sólo documentado): la
misma exclusión de `permission-prompt.tsx` NO aplica cuando el
pathname es `/operaciones/mi-panel/**` (sólo excluye pathnames que
empiezan con `/mozo`) — es decir, el banner genérico de notificaciones
SÍ podría dispararse mientras un empleado navega
`/operaciones/mi-panel`, algo que nunca ocurre en `/mozo`. Esta
asimetría es preexistente, no introducida por T51/T52, y su
corrección (si corresponde) es una decisión de lifecycle de push
— explícitamente fuera de esta auditoría.

## 10. Push target de "pedido listo" — recomendación con trade-off explícito

```text
RECOMMENDED_MOZO_PUSH_TARGET=/mozo/panel/[slug] (SIN CAMBIOS en esta
  fase — ver razonamiento abajo)
```

Análisis del trade-off real (no hay opción sin costo):

- HOY (`/mozo/panel/[slug]` hardcodeado en
  `mesa-order-ready-notification.ts`): un mozo con "DeliGO Mozos"
  instalada (scope `/mozo/`) recibe el push y el deep-link cae DENTRO
  de su propio scope — reutiliza la ventana instalada, modo standalone
  preservado. Un mozo con "DeliGO Operaciones" instalada (scope
  `/operaciones/`) recibe el MISMO push y el deep-link cae FUERA de su
  scope — el navegador probablemente lo abre en un tab de navegador
  normal en vez de reutilizar la app instalada (degradación de UX, NO
  ruptura funcional: el pedido es el mismo, la sesión es la misma, el
  componente es el mismo).
- Si se cambiara a `/operaciones/mi-panel/[slug]`: se invierte
  exactamente el trade-off (usuarios modernos ganan, usuarios legacy
  con Mozo instalada pierden el mismo tipo de continuidad de scope).
- No existe hoy ningún dato que indique qué PWA (si alguna) tiene
  instalada el destinatario de un push dado — no hay campo en
  `Empleado` ni en la suscripción push que lo registre.

**Decisión para esta fase**: mantener `/mozo/panel/[slug]` sin cambios
(opción A del menú del propio task spec, "mantenerlo durante
transición") — es la única opción con RIESGO CERO hoy, porque:
(1) el conjunto de usuarios con "DeliGO Mozos" instalada es fijo/no
creciente (nadie nuevo la instala, confirmado en §7), mientras que
(2) cambiar el target sin antes actualizar el Service Worker (§11)
perdería la optimización de reutilizar una pestaña ya abierta para
CUALQUIERA de los dos grupos. La migración del push target se registra
como **Fase 4/5 futura** (§13), condicionada a actualizar el Service
Worker en el MISMO cambio, nunca por separado.

## 11. Service Worker — contrato de compatibilidad diseñado, NO implementado

Auditado (`public/sw.js:1072-1104`, `notificationclick` para
`mesa_order_ready`/`salon_new_order`): la lógica actual busca un
`WindowClient` ya abierto cuya URL empiece con `/mozo/panel/` para
reusarlo (`focus()` + `navigate()`); si no encuentra ninguno, reusa
CUALQUIER ventana abierta; si no hay ninguna, abre una nueva
(`clients.openWindow`).

```text
SW_CHANGE_REQUIRED_FOR_NEW_PUSH_TARGET=NO ES REQUERIDO PARA
  CORRECCIÓN (los niveles 2 y 3 de fallback — reusar cualquier
  ventana, o abrir una nueva — ya funcionan sin cambios; sólo se
  pierde la optimización de nivel 1, "reusar la pestaña exacta ya
  abierta en ese path")
SW_COMPATIBILITY_STRATEGY=cuando (en una fase futura) se decida migrar
  el push target, el cambio mínimo y seguro es ampliar el chequeo del
  nivel 1 a AMBOS prefijos:
  `clientUrl.pathname.startsWith("/mozo/panel/") ||
   clientUrl.pathname.startsWith("/operaciones/mi-panel/")`
  — nunca reemplazar uno por otro, siempre aceptar ambos
  simultáneamente (compatibilidad total, cero regresión, ambos grupos
  de usuarios siguen beneficiándose de la reutilización de pestaña).
```

## 12. Dos tipos de usuario — diseño explícito de coexistencia

```text
MODERN_USER_FLOW_TARGET=entra por /operaciones, instala "DeliGO
  Operaciones" (scope /operaciones/) — install-prompt YA lo promueve
  ahí (nunca en /mozo), push apunta hoy a /mozo/panel/[slug] (mismo
  componente, funciona, pierde reutilización de pestaña si tiene
  Operaciones instalada — degradación de UX aceptada en esta fase)
LEGACY_INSTALLED_USER_FLOW_TARGET=ya tiene "DeliGO Mozos" instalada
  (scope /mozo/), sigue abriendo su ícono existente sin ningún cambio
  — start_url /mozo/ intacto, manifest intacto, push apunta a su
  propio scope sin degradación
```

```text
FORCED_MANUAL_REINSTALL_REQUIRED=NO
```

Ningún punto de este diseño requiere que un usuario desinstale y
reinstale nada — ambos flujos coexisten sin fricción.

## 13. Fases de deprecación — diseñadas, ninguna ejecutada

```text
T52_PHASE_1=Dejar de promover una PWA Mozo NUEVA — YA CUMPLIDA hoy en
  código (§7). Ninguna acción de implementación pendiente.
T52_PHASE_2=Mover nuevas dependencias internas a /operaciones — YA
  CUMPLIDA en gran parte: todo enlace/nav interno nuevo desde
  Operaciones ya apunta a /operaciones/**, nunca a /mozo (A0). Sin
  acción pendiente salvo la decisión de push (Fase 4).
T52_PHASE_3=Mantener compatibilidad /mozo — EN CURSO, indefinida,
  sin fecha de fin — mientras existan instalaciones de "DeliGO Mozos"
  activas o el push siga apuntando ahí.
T52_PHASE_4=(futura, requiere autorización explícita y evidencia
  propia, ej. telemetría de instalaciones activas de Mozo) migrar el
  push target a /operaciones/mi-panel/[slug] JUNTO con la actualización
  del Service Worker (§11) en el mismo cambio.
T52_PHASE_5=(muy futura, sólo con evidencia de que Mozo ya no tiene
  instalaciones activas relevantes) considerar retirar /mozo con el
  mismo patrón ya usado y probado en este repo para Empleado/Salón
  (ver §16 — pantalla `LegacyAccessRetired` con redirect a
  /operaciones/ingresar y /operaciones/registro, cero fetch, cero
  estado).
```

## 14. Contrato Option A — sin ambigüedad

```text
FILES_TO_TOUCH_THIS_ROUND=NINGUNO (A1 es diseño/decisión, no
  implementación)
FILES_TO_TOUCH_FUTURE_R1=NINGUNO identificado con evidencia suficiente
  para justificarlo hoy — el objetivo "dejar de promover" YA está
  logrado (§7); el único cambio candidato real (push target + SW,
  §10-11) queda diferido a Fase 4 con su propia autorización
STRINGS_TO_CHANGE=ninguno en esta ronda
FILES_NOT_TO_TOUCH=src/components/shared/dynamic-manifest.tsx,
  src/components/shared/install-prompt.tsx,
  src/components/shared/permission-prompt.tsx,
  src/lib/mesa-order-ready-notification.ts, public/sw.js,
  public/manifest-mozo.json, public/icon-mozo-*.png — TODOS preservados
  intactos en esta fase
MANIFEST_SERVED_ON_MOZO=manifest-mozo.json (sin cambios)
ICONS_REMAINING=icon-mozo-192x192.png, icon-mozo-512x512.png (sin
  cambios)
ROUTES_REMAINING=todas las de /mozo/** (sin cambios)
PUSH_TARGET_REMAINING=/mozo/panel/[slug] (sin cambios en esta fase)
SW_LOGIC_REMAINING=matching por prefijo /mozo/panel/ (sin cambios en
  esta fase)
EXISTING_INSTALL_BEHAVIOR=sin cambios, cero riesgo (nada se toca)
```

**Conclusión honesta de esta ronda**: la auditoría profunda demuestra
que Option A, en su forma más literal ("dejar de promover instalación
separada"), **ya está implementada** desde antes de esta sesión. No
existe hoy un cambio de código de bajo riesgo y alto valor que quede
pendiente de ejecutar para lograr ese objetivo — el trabajo real
restante de T52 es el de la Fase 4 (push target + SW), que
correctamente requiere su propia decisión y evidencia futura, no
esta ronda.

## 15. Archivos legacy — no se borra nada en R1

```text
MANIFEST_MOZO_DELETE=NO
ICON_MOZO_DELETE=NO
MOZO_ROUTE_DELETE=NO
MOZO_PUSH_ICON_PRESERVED=SI (público en sw.js:467, mapeo rol→ícono
  independiente de la instalabilidad de la PWA separada — sigue siendo
  válido aunque la promoción de instalación ya esté detenida)
```

## 16. Empleado y Salón — auditoría completada, clasificación MUY DISTINTA a Mozo

Hallazgo central: **Empleado y Salón YA fueron retirados por completo**,
en una limpieza anterior a esta sesión ("Legacy-Cleanup-1B"),
totalmente distinta al estado de Mozo:

```text
EMPLOYEE_MAGIC_LINK_ROUTE_ACTIVE=NO — `src/app/e/[token]/page.tsx`
  renderiza únicamente `<LegacyAccessRetired label="E" .../>`, un
  componente estático sin `"use client"`, sin fetch, sin efectos, sin
  estado, cuyo único propósito es mostrar "Este acceso fue reemplazado"
  con 3 botones fijos hacia /operaciones/ingresar,
  /operaciones/registro y /. El comentario del propio archivo lo
  confirma: "Legacy-Cleanup-1B: se retiró por completo el panel legacy
  de pedidos + reseñas (fetch a /api/empleado/*, bearer token,
  auto-refresh, push)".
EMPLOYEE_PWA_INSTALLABLE=técnicamente SÍ (role-config.ts aún declara
  "empleado" con manifestFile/iconos/pathPrefix "/e/", y
  DynamicManifest los sigue sirviendo si alguien visita /e/{token}) —
  pero instalarla hoy produce una app que sólo muestra la pantalla de
  "reemplazado", cero funcionalidad real.
EMPLOYEE_CURRENT_PRODUCT_DEPENDENCIES=NINGUNA — `src/app/api/empleado/`
  NO EXISTE en el repo (confirmado, directorio ausente). Push/SW no
  tienen ninguna lógica activa para empleados_new_order/
  empleados_new_review (retirada explícitamente, ver sw.js comentario
  "Legacy-Cleanup-1C.1: se retiraron acá empleados_new_order/
  empleados_new_review (sin consumidor moderno)").

SALON_MAGIC_LINK_ROUTE_ACTIVE=NO — mismo patrón exacto:
  `src/app/s/[token]/page.tsx` → `<LegacyAccessRetired label="S" .../>`,
  mismo comentario "Legacy-Cleanup-1B: se retiró por completo el panel
  legacy de mesas + pedidos (fetch a /api/salon/*, bearer token,
  auto-refresh, push)".
SALON_PWA_INSTALLABLE=técnicamente SÍ (mismo caso que Empleado — role
  "salon" sigue en role-config.ts), mismo resultado: instalarla sólo
  muestra la pantalla de reemplazo.
SALON_CURRENT_PRODUCT_DEPENDENCIES=NINGUNA — `src/app/api/salon/` NO
  EXISTE en el repo (confirmado, directorio ausente).
```

## 17. No confundir Salón/Empleado legacy con Operaciones moderno

```text
LEGACY_VS_MODERN_AUTH_MODEL=completamente distintos — /s/{token} y
  /e/{token} eran magic-links SIN sesión (bearer token en la URL, ya
  retirado); el Salón/PyR MODERNO de Operaciones (áreas
  `areaOperativa=salon|pyr`, servido bajo
  /operaciones/mi-panel/[slug]/salon|pyr) usa exclusivamente la MISMA
  cookie de sesión personal `deligo_operativo_session` que Mozo. No
  hay ninguna equivalencia de auth entre el legacy retirado y el
  modelo moderno — son arquitecturas completamente distintas de
  épocas distintas, ya desacopladas.
```

Dado que Empleado/Salón YA están funcionalmente inertes y sin ninguna
dependencia de producto activa (a diferencia de Mozo, que SÍ tiene
dependencias reales de push/SW/PWA activa), su clasificación es
`SAFE_TO_REMOVE` en el sentido de "cero funcionalidad que preservar" —
pero **retirar sus archivos de manifest/ícono/`role-config.ts` sigue
sin ser parte del alcance autorizado de esta ronda** (§20 lo prohíbe
explícitamente salvo evidencia extremadamente fuerte, y esa decisión
de limpieza de assets no fue solicitada en este task).

## 18. Decisión de alcance — dividir Mozo de Empleado/Salón

```text
RECOMMENDED_T52_IMPLEMENTATION_SPLIT=SI, DIVIDIR:
  T52-R1A = Mozo (compatibility-first, sin remoción, Fase 1-3 ya
    cumplidas, Fase 4 push/SW diferida con su propia autorización)
  T52-R1B = Empleado/Salón legacy asset cleanup (manifest/iconos/
    role-config entries de "empleado"/"salon" — modelo de auth
    COMPLETAMENTE distinto, ya funcionalmente inerte, candidato
    genuino a limpieza de assets, pero requiere su propia auditoría
    de "quién más podría referenciar esos assets" antes de tocar
    nada — NO se audita a fondo en esta ronda, sólo se documenta como
    hallazgo lateral)
```

Justificación: Mozo comparte modelo de auth con Operaciones (sesión
CuentaOperativa) y tiene dependencias activas reales (push/SW/PWA
instalada); Empleado/Salón usan un modelo de auth completamente
distinto (ya retirado) y no tienen ninguna dependencia activa. Mezclar
ambos en un solo R1 arriesgaría tratar dos problemas de naturaleza
opuesta (uno de "no romper algo vivo", otro de "limpiar algo ya
muerto") con el mismo nivel de cautela innecesario para el segundo.

## 19. Matriz de tests futura (diseñada, NO implementada)

```text
A. CuentaOperativa login /operaciones/ingresar — POST /api/operativo/login exitoso
B. CuentaOperativa login /mozo/iniciar-sesion — mismo POST, mismo resultado
C. Ambos (A, B) resultan en la MISMA cookie deligo_operativo_session
D. Ambos (A, B) resuelven el MISMO cuentaOperativaId vía /api/operativo/me
E. Empleado con areaOperativa="mozo" resuelve areaOperativaEfectiva "mozo"
   sin importar `rol` (extender tests existentes de area-operativa.ts)
F. GET /operaciones/mi-panel/[slug] (re-export) sirve contenido idéntico
   a GET /mozo/panel/[slug]
G. GET /mozo/panel/[slug] sigue funcionando sin regresión
H. POST pedido manual desde /operaciones/mi-panel/[slug]/pedido/[mesaId]
   funciona (ya cubierto por T46-R2)
I. POST pedido manual desde /mozo/panel/[slug]/pedido/[mesaId] funciona
   (mismo archivo — regresión trivial de I sobre H)
J. Push "pedido listo" abre un target funcional (contrato actual:
   /mozo/panel/[slug], sin cambios en esta fase)
K. manifest-operaciones.json sin cambios, PWA Operaciones instalable
   sin regresión
L. Nueva visita a /mozo NO dispara InstallPrompt/PermissionPrompt (ya
   verificado por lectura de código — test de regresión estático
   sugerido: assert que ambos componentes retornan null/no-op bajo
   pathname "/mozo" y "/mozo/algo")
M. Una PWA Mozo YA instalada (si hay dispositivo disponible) sigue
   abriendo /mozo/ en modo standalone tras cualquier futuro deploy que
   NO toque dynamic-manifest.tsx/manifest-mozo.json (no verificable sin
   dispositivo real, ver §20)
N. Ícono de push "mozo" (icon-mozo-192x192.png) sigue apareciendo en
   notificaciones reales de mesa_order_ready
O. Badge compartido de DeliGO (T36) sin cambios
P. Salón/PyR (áreas modernas de Operaciones) sin regresión — fuera del
   árbol Mozo, ningún cambio propuesto las afecta
```

## 20. Certificación física futura — dos matrices, sin ejecutar

```text
MATRIX_NEW_USER=Operaciones → login → (si areaOperativa=mozo) panel
  Mozo dentro de /operaciones/mi-panel → instalar "DeliGO Operaciones"
  → recibir push de pedido listo → reabrir la app instalada →
  confirmar que sigue funcionando (aunque el push abra fuera de scope
  en esta fase, según §10 — comportamiento esperado, no una falla)

MATRIX_LEGACY_INSTALLED_USER=CONDITIONAL_NOT_AVAILABLE

No existe en este momento un dispositivo con "DeliGO Mozos" ya
instalada disponible para el operador — no se inventa un PASS. Si en
el futuro se dispone de uno, la matriz debería cubrir: abrir el ícono
existente, confirmar sesión persistida, entrar al panel, tomar un
pedido, recibir un push, reabrir desde la notificación, confirmar que
el modo standalone no se degradó.
```

## 21. Plan de rollback

```text
R1_ROLLBACK_COMPLEXITY=N/A EN ESTA RONDA (no se implementó ningún
  cambio — no hay nada que revertir). Para la futura Fase 4
  (push target + SW), el rollback sería trivial: revertir el string
  del deep-link en mesa-order-ready-notification.ts y la condición
  añadida en sw.js — ningún cambio de DB, ninguna pérdida de sesión,
  ambos archivos son puro código de aplicación sin estado persistente
  propio.
```

## 22. Relación con otras tareas — confirmado sin tocar

```text
T38_FUNCTIONAL_SCOPE_TOUCHED=NO (no se propuso ningún prompt/tutorial/
  estado de instalación nuevo — de hecho se confirmó que install-prompt.tsx
  no requiere ningún cambio en absoluto)
T40_SCOPE_TOUCHED=NO (push re-enrollment/subscription lifecycle
  intactos; la asimetría de permission-prompt.tsx en §9 se documenta,
  no se corrige)
T44_SCOPE_TOUCHED=NO (deep-link iOS de T44 no se reabre; el trabajo de
  push target de esta auditoría es exclusivamente sobre el path de
  Mozo, no sobre el problema de T44)
T39_TOUCHED=NO
```

## 23. Gates de autorización para implementar — evaluados

```text
EXISTING_INSTALL_COMPATIBILITY_UNDERSTOOD=SI (con fuentes oficiales
  citadas, §5)
DYNAMIC_MANIFEST_MIGRATION_SAFE=SI (evaluado: no requiere ningún
  cambio — el objetivo ya está cumplido sin tocarlo, §8)
INSTALL_PROMPT_MIGRATION_SAFE=SI (evaluado: no requiere ningún cambio
  — ya excluye /mozo desde antes de esta sesión, §7)
PUSH_TARGET_MIGRATION_SAFE=SI (con la condición explícita de que
  cualquier migración futura del target se ejecute junto con el
  cambio de SW correspondiente — nunca por separado — y que la
  decisión de EJECUTARLA en Fase 4 requiere autorización explícita
  adicional, no implícita en este A1)
SW_MIGRATION_CONTRACT_DEFINED=SI (§11 — contrato exacto de qué línea
  cambiar y cómo, para cuando se autorice la Fase 4)
EMPLOYEE_SALON_SCOPE_CLASSIFIED=SI (§16-18 — clasificación completa,
  arquitectura de auth completamente distinta a Mozo, ya inerte)
```

Todos los gates quedan en `SI` — pero la conclusión NO es "ejecutar R1
ahora": es que **no existe ningún cambio de código pendiente y seguro
que aporte valor real en esta fase**, porque el objetivo original de
"dejar de promover instalaciones nuevas" ya estaba resuelto en el
código antes de que empezara esta auditoría. El único trabajo real
identificado (push target + SW) queda correctamente diferido a una
Fase 4 futura, sujeta a su propia autorización explícita.

## 24. Cierre de esta ronda (A1)

```text
PRODUCT_FILES_CHANGED_DURING_A1=0
TEST_FILES_CHANGED_DURING_A1=0
MANIFEST_FILES_CHANGED=0
SERVICE_WORKER_CHANGED=0
PUSH_CHANGED=0
AUTH_CHANGED=NO
SESSION_CHANGED=NO
DB_CHANGED=NO
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
PRODUCTION_TOUCHED=NO
```
