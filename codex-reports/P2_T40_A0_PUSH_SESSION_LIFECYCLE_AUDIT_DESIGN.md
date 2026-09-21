# P2-T40-A0 — Push Session Lifecycle + Login Re-Enrollment: Auditoría Completa + Diseño de Rebind Persistente

**Tipo de tarea:** AUDIT + DESIGN (read-only). Cero implementación, cero mutación de push, cero cambio de login/logout/SW/DB/schema/migración, cero Production, cero test físico en esta ronda — por instrucción explícita del propio prompt de T40-A0 (§58).

**Alcance excluido explícitamente:** Terminal (fuera de alcance de Push por diseño del propio prompt), T38/T39/T44/T45/T52 (no se reabren ni se tocan).

---

## 1. Preflight

```text
REPO=C:\Leo Campos\Trabajo\deligo-main-limpio
BRANCH=work/p2-t43-r2
REMOTE_TARGET=origin/testing-codex
PRODUCTION_BRANCH=main
TASK_MODE=AUDIT_AND_DESIGN_ONLY
IMPLEMENTATION_IN_THIS_ROUND=NO
DB_SCHEMA_MIGRATION_IN_THIS_ROUND=NO
LOGIN_LOGOUT_SW_API_CHANGE_IN_THIS_ROUND=NO
PRODUCTION_TOUCHED=NO
T38_T39_T44_T45_T52_REOPENED=NO
TERMINAL_IN_PUSH_SCOPE=NO_BY_DESIGN
```

---

## 2. Mapa global de Push (todos los actores)

| Actor | Sesión/cookie | Hook cliente | Owner-type normalizado | Push settings UI |
|---|---|---|---|---|
| Cliente | `deligo_session` (vía `useAuthStore`, family `cliente`) | `usePushNotifications()` | `cliente` | `client-profile-panel.tsx` |
| Negocio | `deligo_session` (family `negocio`) | `usePushNotifications()` | `negocio` | `config-tab.tsx` |
| Repartidor | `deligo_session` (family `repartidor`) | `usePushNotifications()` | `repartidor` | `profile-tab.tsx` |
| CuentaOperativa (Operaciones/Mozo, cuenta) | `deligo_operativo_session` | `usePushNotifications()` | `cuenta_operativa` | `src/app/operaciones/cuenta/page.tsx` |
| Empleado (vínculo Mozo, fallback legacy) | `deligo_operativo_session` + `Empleado.id` | `use-operativo-salon-push.ts` (montado sólo en `mozo/panel/[slug]/page.tsx`) | `empleado` | Toggle propio dentro del panel Mozo/Salón |
| Empleado (vínculo PyR) | `deligo_operativo_session` + `Empleado.id` | `use-operativo-pyr-push.ts` | `empleado` | **Ninguna** — hook sin ningún punto de montaje (ver §11) |
| SuperAdmin | `deligo_session` (family propia, fuera de `ActiveSessionFamily`) | Ninguno | Legacy-only (`SuperAdmin.pushSubscription` directo, sin tabla normalizada) | Ninguna |
| Terminal | N/A | N/A | N/A | Fuera de alcance por diseño (no es un actor con identidad push) |

**Endpoints backend relevantes:**
- `POST/DELETE /api/push/subscribe` — actores personales (`cliente/negocio/repartidor`) + SuperAdmin legacy.
- `POST/GET/DELETE /api/operativo/mozo/panel/[slug]/push-subscription` — Empleado (fallback legacy, Mozo).
- `POST/GET/DELETE /api/operativo/salon/panel/[slug]/push-subscription` — Empleado (fallback legacy, Salón). `ownerType:"empleado"` confirmado por lectura directa.
- `POST/GET/DELETE /api/operativo/pyr/panel/[slug]/push-subscription` — Empleado (fallback legacy, PyR). `ownerType:"empleado"` confirmado.
- `POST /api/operativo/logout` — detach exacto de la suscripción física del CuentaOperativa saliente (`performOperativeLogout()`).
- `POST /api/auth/logout` — Cliente/Negocio/Repartidor: **cero lógica de push** (sólo borra sesión + cookie).

**Modelo de almacenamiento (`PushSubscription`, tabla normalizada):** clave única compuesta `(ownerType, ownerId, channel, endpoint)`. **MODEL-C1**: el mismo endpoint físico puede estar ligado simultáneamente a múltiples `owner` distintos sin colisión ni sobrescritura cruzada — es multi-bind por diseño, no un defecto.

**Resolución de targets operativos (`resolveOperationalPushTargets()`, `src/lib/operational-push-targets.ts`):** diseño confirmado, intencional y documentado en el propio código: *"Cuenta-level is the authority for new operational subscriptions. Employee rows remain a deliberately narrow compatibility fallback for old sessions: only accounts without any account-level row use them, and every event is deduped by physical endpoint."* Es decir: si el `CuentaOperativa` dueño de un `Empleado` tiene al menos una fila `ownerType:"cuenta_operativa"`, esa fila (compartida entre TODOS sus vínculos/negocios) es la única usada; sólo si no existe ninguna fila de cuenta se cae al fallback legacy per-Empleado.

**Confirmado en esta ronda — todos los envíos operativos usan el resolver unificado** (cero split-brain):
```text
grep resolveOperationalPushTargets src/lib src/app (no test):
  src/lib/mesa-order-ready-notification.ts   (Mozo "pedido listo")
  src/lib/operations-cancellation-notification.ts
  src/lib/pyr-chat-notification.ts
  src/lib/pyr-new-order-notification.ts
  src/lib/pyr-new-review-notification.ts
  src/lib/salon-new-order-notification.ts
```
`mesa-order-ready-notification.ts` lee `empleado.pushSubscription` directamente sólo para CONSTRUIR el objeto `OperationalPushEmployee` que luego pasa a `resolveOperationalPushTargets([mozo])` (línea 257) — no es un bypass, es el insumo del propio resolver. **Conclusión: MOZO_PERSONAL_PUSH_LIFECYCLE=UNIFICADO_VIA_RESOLVER, SPLIT_BRAIN=NO.**

**Service Worker:** un único `sw.js` en `/sw.js`, registrado desde 5 puntos distintos (`register-sw.ts`, `use-push-notifications.ts`, `mozo/panel/[slug]/page.tsx`, `use-operativo-salon-push.ts`, `use-operativo-pyr-push.ts`) — **mismo path, mismo scope implícito `/`** en todos los casos. Esto confirma que **existe una sola `PushManager` subscription física por navegador/origen**, compartida por TODAS las identidades de rol/PWA (Cliente, Negocio, Repartidor, Operaciones, Mozo). Es precisamente por esto que el modelo MODEL-C1 (multi-bind del mismo endpoint a múltiples owners) es necesario y correcto: no hay forma de tener físicamente más de una subscription por navegador aunque haya múltiples "PWAs" instaladas del mismo origen.

`public/sw.js` — confirmado sin listener `pushsubscriptionchange` (`PUSH_SUBSCRIPTION_CHANGE_HANDLER=NO`).

---

## 3. Definición operacional de "Push efectivo"

**Push efectivo** para un actor autenticado = existe una fila en la tabla normalizada `PushSubscription` con `(ownerType, ownerId)` correspondiente al actor ACTUALMENTE autenticado en este dispositivo/navegador, cuyo `endpoint` coincide con la subscription física (`PushSubscription` del navegador) actualmente activa en el `ServiceWorkerRegistration` de este origen, Y el permiso de notificaciones del navegador (`Notification.permission`) es `"granted"`.

Los tres componentes deben coincidir simultáneamente: (a) permiso de navegador `granted`, (b) subscription física viva y no revocada por el push service, (c) fila backend vigente para el owner correcto. La ausencia de cualquiera de los tres implica Push NO efectivo, aunque los otros dos existan (p. ej. permiso granted + física viva pero fila backend de OTRO owner = push no efectivo para el actor actual, aunque el navegador "crea" que está suscrito).

---

## 4. Los 7 estados canónicos (A–G)

| Estado | Permiso navegador | Subscription física | Fila backend (owner actual) | Descripción |
|---|---|---|---|---|
| **A — Óptimo** | granted | viva | vigente, owner correcto | Push efectivo completo. Estado objetivo. |
| **B — Denegado** | denied | (irrelevante) | (irrelevante) | El usuario bloqueó notificaciones a nivel navegador. Sólo reversible manualmente desde ajustes del navegador/SO — nunca desde la app. |
| **C — Default (nunca preguntado)** | default | ninguna | ninguna | Estado inicial de cualquier dispositivo/navegador nuevo, o de un usuario que cerró el prompt sin decidir. |
| **D — Detached (huérfano backend)** | granted | viva | ausente o de OTRO owner | El navegador cree que está suscrito, pero no hay fila backend para el actor actual. **Este es el estado que deja la BUG cabecera de expiración de sesión (§9)** y también el estado de un actor nuevo en un dispositivo que ya tenía Push activado por otro actor. |
| **E — Backend huérfano (fila sin física)** | granted o default | ninguna/revocada | vigente | La fila backend sobrevive pero la subscription física ya no existe (el usuario la revocó desde el navegador, o el push service la invalidó). Auto-detectado hoy vía `checkPersonalPushStatus`/`usePushNotifications` (mismatch de VAPID o ausencia física) pero NUNCA reparado automáticamente. |
| **F — Manual-off (usuario desactivó desde la app)** | granted | viva (política `SERVER_DETACH_ONLY`) | ausente para este owner (detach explícito) | El usuario apagó el toggle desde Ajustes. La física NUNCA se destruye (decisión de diseño ya vigente, ver §8) — sólo se borra la fila backend de este owner. Distinto de "denied": el navegador sigue en `granted`, sólo el backend fue desvinculado a pedido explícito. |
| **G — Logout explícito** | granted (política igual a F) | viva | detach exacto ejecutado antes de cerrar sesión | Ya implementado correctamente para el flujo de botón "Cerrar sesión" (`handleLogout()` en `use-auth.ts`, y `performOperativeLogout()` para CuentaOperativa). Detach específico del actor saliente, sin tocar la física. |

**Transición NO cubierta hoy por ningún código:** de cualquier estado A/D hacia D por **expiración natural de sesión** (no logout explícito) — ver bug cabecera en §9. Hoy, tras una expiración, el sistema queda indefinidamente en D sin que exista ningún código que lo detecte o lo repare, ni siquiera de forma pasiva.

---

## 5. Ciclo de vida por actor: login / login Google / expiración de sesión

**Mecanismo de sesión — confirmado idéntico entre login por contraseña y Google OAuth** para Cliente/Negocio/Repartidor: `src/app/api/auth/google/callback/route.ts` línea 258 llama a `createSession(userId, role)` (mismo `src/lib/auth.ts` que usa `login/route.ts`) y fija la misma cookie `SESSION_COOKIE_NAME`. **No existe ninguna lógica de push específica de Google en el callback** — por lo tanto todo lo que aplica al login por contraseña aplica idénticamente al login por Google, sin necesidad de tratamiento diferenciado.

- **Login (contraseña o Google), Cliente/Negocio/Repartidor:** `useAuthStore` se puebla → `PermissionPrompt` (montado globalmente en `src/app/layout.tsx`, root layout, aplica a toda ruta salvo su propia exclusión interna de `/mozo`) decide mostrar el prompt de navegador SOLO si el flag global `localStorage["deligo-permissions-prompted"]` no existe. Si el permiso YA es `granted` a nivel navegador (por cualquier cuenta anterior en este dispositivo), `syncExistingPushSubscription()` corre pero **sólo telemetría — su resultado nunca se usa para decidir nada** (bug confirmado, ver §9). Ningún código fuerza una reconciliación real (crear/actualizar la fila backend del actor recién logueado) fuera de que el usuario visite manualmente su página de Ajustes (`client-profile-panel.tsx`/`config-tab.tsx`/`profile-tab.tsx`), donde SÍ está montado `usePushNotifications()` con su `checkSubscription()` de sólo lectura al montar.
- **Login CuentaOperativa (`/mozo/iniciar-sesion`, `/operaciones/ingresar`):** cookie separada `deligo_operativo_session`. `PermissionPrompt` NO cubre este actor en absoluto (su `useAuthStore` nunca se puebla para `cuenta_operativa` — la familia `ActiveSessionFamily` sólo admite `cliente|negocio|repartidor`). La única reconciliación posible es visitar `/operaciones/cuenta` (que monta `usePushNotifications()`).
- **Expiración de sesión (TTL, sin logout explícito) — TODOS los actores personales:** `SESSION_DURATION_HOURS = 12` (`src/lib/auth.ts`, confirmado). `useAuth().syncSession()` corre en cada montaje de página autenticada; su manejador de 401 llama SOLO a `store.logout()` (limpieza cliente-side de Zustand) — **cero llamada de red, cero detach físico, cero detach backend.** Este es el hallazgo cabecera del audit (§9): cada expiración natural deja la fila backend del actor expirado viva indefinidamente, huérfana (Estado D para cualquier actor NUEVO que luego use el mismo dispositivo).
- **Expiración de sesión operativa:** no se auditó un manejador de 401 equivalente específico para `deligo_operativo_session` en este round — pendiente para R1 si se autoriza cerrar el gap (ver §14, "trabajo NO cubierto aquí").

---

## 6. Objetivo de persistencia (qué se debe maximizar, qué se debe evitar)

**Correcto (mantener):** nunca volver a pedir el permiso de navegador si ya es `granted` o `denied` — el permiso del navegador es una decisión humana cara de repetir y el propio prompt del task lo prohíbe explícitamente ("no diseñar que cada login vuelva a preguntar por notificaciones").

**Incorrecto hoy (el gap real):** confundir "el permiso del navegador ya está decidido" con "el backend está correctamente vinculado al actor actual". Son cosas independientes. La reconciliación que falta es 100% invisible para el usuario cuando el permiso ya es `granted` — es una llamada de red (crear/renovar la fila del owner correcto), nunca un diálogo de navegador.

---

## 7. Secuenciación de logout (unlink vs unsubscribe)

Distinción ya presente y correctamente implementada en el código existente, documentada aquí porque el propio prompt de T40 la exige explícitamente:

- **Unsubscribe (física):** destruir la `PushSubscription` real del navegador (`subscription.unsubscribe()`). **Política vigente `PHYSICAL_UNSUBSCRIBE_POLICY_FINAL=SERVER_DETACH_ONLY`: la física NUNCA se destruye automáticamente**, ni en logout ni en manual-off — sólo el propio usuario puede hacerlo desde los ajustes del navegador/SO. Motivo documentado en el propio código: soporte de multi-bind (MODEL-C1) — destruir la física de un dispositivo compartido rompería el push de cualquier otro owner atado al mismo endpoint.
- **Unlink (backend):** borrar/invalidar sólo la fila `(ownerType, ownerId, endpoint)` del actor saliente. Esto es lo que SÍ ocurre en logout explícito (`handleLogout()`, `performOperativeLogout()`).

`handleLogout()` (click explícito en "Cerrar sesión") ya hace unlink correctamente ANTES de llamar a `/api/auth/logout`. `performOperativeLogout()` hace lo mismo para CuentaOperativa vía `POST /api/operativo/logout` con "exact-match account-scoped detach". **Ninguno de los dos toca la física** — correcto y consistente con la política.

---

## 8. Seguridad cross-account / cross-actor

- El owner de cada suscripción SIEMPRE se deriva server-side (`getUserFromToken`/`getOperationalAccountFromRequest`) — nunca confiado desde el body del cliente. Confirmado en `/api/push/subscribe/route.ts` y en las 3 rutas operativas (`mozo`/`salon`/`pyr` panel push-subscription).
- MODEL-C1 hace que el multi-bind del mismo endpoint físico a distintos owners sea SEGURO por diseño: escribir la fila de un owner nunca sobrescribe ni borra la fila de otro owner en el mismo endpoint (clave única compuesta por owner, no por endpoint solo).
- DELETE exige match exacto de endpoint antes de limpiar (confirmado en la ruta Mozo/Salón/PyR panel push-subscription) — no se puede borrar a ciegas la suscripción de otro dispositivo.
- **Riesgo real identificado (no nuevo, pero relevante para el diseño de rebind):** si se implementara un auto-rebind ingenuo que reutilice la física existente y la asocie automáticamente al nuevo actor autenticado SIN verificar que el actor anterior fue explícitamente deslogueado, dos usuarios legítimos y distintos compartiendo el mismo dispositivo físico (caso común en Mozo/Operaciones — tablet compartida) podrían terminar con notificaciones cruzadas si el rebind no es estrictamente scoped al owner-actual-en-turno. Esto se resuelve en el diseño de la Opción recomendada (§13) exigiendo que el auto-rebind SOLO actualice/cree la fila del owner autenticado en la request actual, nunca "migre" ni borre la fila de un owner anterior en la misma operación (eso ya lo hace el detach explícito de logout, que es un paso separado y ya implementado).

---

## 9. Hallazgo cabecera (headline bug) y hallazgos secundarios

```text
BUG-1 (headline): syncSession() 401-handler (src/hooks/use-auth.ts) sobre
  expiración natural de sesión (12h TTL) hace SOLO store.logout() —
  cero detach de red, cero unlink backend, cero destrucción física.
  Efecto: cada expiración deja Estado D (detached) indefinidamente.
  Bajo MODEL-C1, un actor DISTINTO que luego use el mismo dispositivo
  jamás limpia esa fila huérfana (su propio subscribe sólo agrega una
  fila independiente, nunca toca la del actor anterior).

BUG-2: syncExistingPushSubscription() en permission-prompt.tsx obtiene
  el resultado de un status-check pero nunca lo inspecciona ni actúa
  sobre él — es telemetría pura, cero reparación.

BUG-3: PermissionPrompt usa una única key global de localStorage
  ("deligo-permissions-prompted"), no scoped por actor/sesión. Un
  permiso ya decidido (granted o denied) por CUALQUIER cuenta anterior
  en este dispositivo silencia el prompt para siempre, incluso para una
  cuenta distinta que en verdad nunca decidió nada y cuyo backend nunca
  quedó vinculado.

GAP-4: usePushNotifications() (el único hook con capacidad real de
  checkSubscription + subscribe) sólo está montado en 4 páginas de
  Ajustes/Perfil (cliente, negocio, repartidor, cuenta operativa). Para
  cualquier actor que no visite esa página específica tras loguearse,
  jamás hay una reconciliación automática — ni siquiera de sólo
  lectura.

GAP-5: use-operativo-pyr-push.ts no tiene NINGÚN punto de montaje en
  toda la base de código (ni en producto ni en ninguna página .tsx,
  confirmado por grep). Es código muerto/huérfano — el toggle de push
  de PyR no es alcanzable desde ninguna UI hoy. (No forma parte del
  bug de sesión; es un hallazgo lateral, documentado sin expandir el
  alcance de este audit.)

GAP-6 (no bug, documentado por completitud): no existe un handler
  equivalente de expiración/401 auditado en este round para
  `deligo_operativo_session` — no se confirmó si el mismo patrón de
  BUG-1 aplica idéntico a CuentaOperativa o si tiene su propio camino;
  queda para R1 si se autoriza continuar sobre ese actor.
```

**Lo que NO es un bug (confirmado, para evitar sobre-diseño):**
- `resolveOperationalPushTargets()` — arquitectura intencional y correcta, no split-brain (§2).
- Multi-bind del mismo endpoint a varios owners (MODEL-C1) — diseño correcto, no una corrupción de datos.
- `SERVER_DETACH_ONLY` (nunca destruir la física) — política ya decidida y correcta, no se debe revertir.
- Exclusión de `/mozo` en `PermissionPrompt`/`install-prompt.tsx` — ya resuelta correctamente en rondas previas (T52).

---

## 10. Áreas fuera de alcance confirmadas sin tocar

`T38`, `T39`, `T44`, `T45`, `T52` — ninguno de sus archivos fue modificado (esta ronda es 100% lectura). `T44`/`T45` cubren *cobertura y arquitectura* de Push/avisos por actor (qué eventos, qué canal) — deslindado explícitamente de T40, que es *lifecycle de sesión/login* (cuándo y cómo se (re)vincula el binding, no qué se notifica). Esta distinción ya estaba registrada en `CODEX_REPORT.md` desde el registro original del backlog de T40 (línea 552: *"T40 vs T44/T45 deslindados explícitamente"*) y se preserva sin cambios en esta auditoría.

---

## 11. Aplicabilidad SuperAdmin y Terminal

- **SuperAdmin:** confirmado inerte. `src/app/api/push/subscribe/route.ts` trata SuperAdmin como rama legacy-only ("dead/inert branch" per comentario del propio código) — sin tabla normalizada, sin hook cliente montado en ningún directorio `src/app/superadmin`/`src/components/superadmin` (confirmado por grep sin resultados). **SUPERADMIN_PUSH_LIFECYCLE_APPLICABLE=NO** — no requiere ningún trabajo de T40.
- **Terminal:** excluido por instrucción explícita del propio prompt de T40 — no se investigó su modelo de sesión en este round.

---

## 12. Máquina de estados UX (A–G) — contrato de comportamiento

| Estado | Acción automática al detectar | Mensaje al usuario | CTA | Persiste en localStorage | Comportamiento en el próximo login |
|---|---|---|---|---|---|
| A — Óptimo | Ninguna (todo correcto) | Ninguno | — | No aplica marca nueva | Se re-verifica silenciosamente (mismo chequeo A) |
| B — Denegado | Ninguna posible (el navegador bloquea `Notification.requestPermission`) | Mensaje pasivo en Ajustes: "Las notificaciones están bloqueadas por tu navegador" + instrucciones para reactivar manualmente | Enlace a instrucciones del navegador (no un botón que reintente pedir permiso) | No requiere flag nuevo — `Notification.permission` ya es la fuente de verdad, consultable en cualquier momento | Se re-detecta como B automáticamente, sin re-preguntar |
| C — Default | Mostrar el prompt de navegador UNA vez por dispositivo (comportamiento ya vigente, preservar) | El prompt nativo del navegador + copy explicativo previo ya existente en `PermissionPrompt` | Botón "Activar notificaciones" | Marca "ya se preguntó en este dispositivo" (ver §16 — recomendación de re-scoping de esta key) | Si sigue en C (usuario cerró el prompt sin decidir), se puede volver a ofrecer tras un intervalo razonable — comportamiento ya existente, no se toca |
| D — Detached | **Auto-rebind silencioso** (crear/renovar la fila backend del owner actual usando la subscription física existente) — CERO diálogo de navegador, es sólo una llamada de red | Ninguno visible si el rebind tiene éxito (transición silenciosa D→A) | — | No aplica | Si el rebind falla (p. ej. red caída), se reintenta en el próximo montaje relevante sin bloquear al usuario |
| E — Backend huérfano | Detectar (ya ocurre hoy vía `checkPersonalPushStatus`) + limpiar la fila backend obsoleta o re-suscribir físicamente si el usuario lo pide desde Ajustes | Mensaje en Ajustes: "Tu suscripción anterior ya no es válida" | Botón "Reactivar" (dispara un nuevo `subscribe()` físico, sí requiere gesto de usuario porque puede implicar un nuevo permiso si `default`) | No aplica | Re-detectado igual en cada visita a Ajustes hasta que el usuario actúe |
| F — Manual-off | Ninguna automática (respetar la decisión explícita) | Toggle reflejando "Desactivado" | Botón "Reactivar" | No aplica (el estado vive en el backend, no en localStorage) | Se mantiene apagado hasta que el usuario reactive explícitamente — el auto-rebind de D NUNCA debe revertir un F explícito |
| G — Logout | Detach ya ejecutado antes de completar el logout (comportamiento ya vigente) | Ninguno (transición limpia) | — | No aplica | El próximo login de OTRO actor en este dispositivo empieza en D (física viva, sin fila) hasta su propio auto-rebind |

**Regla de guardia crítica (session-identity guard):** el auto-rebind de D SOLO puede ejecutarse cuando existe una sesión autenticada válida en el momento de la reconciliation, y SIEMPRE usa el owner derivado server-side de esa sesión (nunca un owner cacheado de una sesión anterior). Esto es750 lo que evita que el rebind "reviva" accidentalmente la fila de un actor ya deslogueado (Estado G no debe poder transicionar espontáneamente de vuelta a A sin un login real).

---

## 13. Disparador de reconciliación recomendado, auto-rebind, y comparación de opciones

**`RECOMMENDED_RECONCILIATION_TRIGGER`:** ejecutar el chequeo de sólo-lectura ya existente (`checkPersonalPushStatus`/equivalente operativo) automáticamente, una vez, justo después de que `syncSession()` confirma una sesión válida (éxito, no 401) — es decir, en el mismo lugar donde hoy corre `PermissionPrompt`, pero desacoplado de si el permiso de navegador ya fue "prompted" o no. Si el chequeo detecta Estado D, dispara el auto-rebind silencioso sin ningún diálogo. Esto cubre login por contraseña, login por Google (mismo `createSession`) y sesiones ya existentes que se recargan (cold start), sin re-preguntar nunca el permiso de navegador.

**`AUTO_REBIND_ALLOWED=SI`**, bajo estas condiciones exactas (todas deben cumplirse):
1. Existe una sesión autenticada válida en el momento de la reconciliación (derivada server-side, nunca del cliente).
2. `Notification.permission === "granted"` y existe una `PushSubscription` física válida en el `ServiceWorkerRegistration`.
3. No existe ya una fila backend vigente para `(ownerType, ownerId)` del actor actual con ese mismo endpoint (si ya existe, no hay nada que hacer — Estado A).
4. La operación es idempotente y exclusivamente aditiva/renovadora para el owner actual: nunca borra ni modifica la fila de ningún otro owner en el mismo endpoint (preserva MODEL-C1 intacto).
5. Nunca se ejecuta si el usuario tiene un manual-off explícito reciente para ese owner específico (Estado F) — el rebind respeta la decisión F y no la revierte automáticamente.

**Comparación de opciones:**

| Criterio | Opción A — Reconciliación centralizada en `useAuth`/hook compartido | Opción B — Reconciliación duplicada por actor (cada Settings page ya la tiene, sólo agregarla también al layout raíz) | Opción C — Rediseño completo del modelo de suscripción (single-owner-per-endpoint, eliminar MODEL-C1) |
|---|---|---|---|
| Reutiliza infraestructura ya hardened (`usePushNotifications`, `checkPersonalPushStatus`) | Sí, la envuelve | Sí, pero duplicada 4+ veces | No — requiere reescribir subscribe/repository/resolver desde cero |
| Riesgo de regresión sobre lo ya certificado (T05/T18/T31) | Bajo — no toca la lógica interna, sólo agrega un disparador | Medio — múltiples puntos de integración divergentes con el tiempo | Alto — toca el corazón de un sistema ya maduro y probado |
| Resuelve BUG-1/BUG-2/BUG-3/GAP-4 de una vez | Sí | Parcial (persiste GAP-4 si se olvida un actor) | Sí, pero como efecto colateral de una reescritura innecesaria |
| Compatible con "nunca re-preguntar el permiso ya decidido" | Sí (el trigger es sólo un chequeo de red, no un diálogo) | Sí | Depende del rediseño |
| Esfuerzo de implementación relativo | Bajo-medio | Medio (repetitivo) | Alto, no justificado por la evidencia (MODEL-C1 no está roto) |
| Riesgo cross-account (§8) | Controlado por la guardia de sesión (§12) | Igual, pero con más superficie para un descuido de copy-paste | Igual, sin beneficio adicional |

**`RECOMMENDED_OPTION=A`** — reconciliación centralizada, montada una vez cerca de `useAuth`/root layout (junto a `PermissionPrompt`, reemplazando su lógica de `syncExistingPushSubscription()` inerte por una llamada real de rebind), con un disparador equivalente separado para el ciclo `deligo_operativo_session` (CuentaOperativa). No se recomienda la Opción C: la evidencia de esta auditoría muestra un sistema de bajo nivel ya maduro y correctamente diseñado (MODEL-C1, `SERVER_DETACH_ONLY`, `resolveOperationalPushTargets`) — el gap real es exclusivamente de "cuándo se dispara la reconciliación", no de modelo de datos.

---

## 14. Plan de archivos para R1 (si se autoriza implementar) — NO ejecutado en este round

```text
Compartido:
  src/hooks/use-auth.ts                         — syncSession() 401-handler: agregar detach real (BUG-1)
  src/components/shared/permission-prompt.tsx   — reemplazar syncExistingPushSubscription() inerte por
                                                    rebind real; re-scoping de STORAGE_KEY si se decide
                                                    (pendiente decisión operador, ver §16)
Cliente/Negocio/Repartidor: sin archivos nuevos — se benefician del cambio compartido arriba.
Operativo (CuentaOperativa):
  src/hooks/use-auth.ts (o un hook operativo equivalente si la sesión operativa no comparte syncSession)
                                                 — mismo tratamiento de 401/expiración para
                                                    deligo_operativo_session (GAP-6, requiere confirmar
                                                    primero si existe un syncSession operativo separado)
API: ningún endpoint nuevo necesario — /api/push/subscribe y las 3 rutas operativas ya soportan
     crear/renovar una fila; el rebind es sólo una llamada más a lo ya existente.
SW: sin cambios (no se requiere pushsubscriptionchange para esta solución).
Tests: nuevos tests focales de contrato puro para el disparador de reconciliación + regresión de los
       suites ya existentes de push (T05/T18/T31) sin modificar su comportamiento.
```

---

## 15. Matriz de tests (19 casos) — diseño, no ejecutado

1. Login contraseña, permiso `default` → se muestra el prompt nativo una sola vez.
2. Login Google, permiso `default` → comportamiento idéntico al caso 1 (mismo `createSession`).
3. Login contraseña, permiso ya `granted` de una sesión anterior del MISMO actor con fila backend vigente → Estado A, sin rebind (no-op).
4. Login contraseña, permiso `granted`, sin fila backend para este actor (Estado D) → rebind silencioso, cero diálogo.
5. Expiración natural de sesión (12h) sin logout explícito → detach ejecutado (corrige BUG-1).
6. Logout explícito (botón) → detach ya verificado como correcto hoy, test de regresión únicamente.
7. Logout CuentaOperativa → detach exacto ya verificado, test de regresión.
8. Actor A hace login, activa push, hace logout explícito; actor B (distinto) hace login en el MISMO dispositivo → B debe rebindearse a su propia fila sin heredar ni sobrescribir la de A.
9. Actor A hace login, activa push, la sesión EXPIRA sin logout (deja Estado D); actor B hace login en el mismo dispositivo → B se rebindea con su propia fila; la fila huérfana de A permanece intacta bajo su propio owner (MODEL-C1 preservado) hasta que A vuelva a loguearse y sea reconciliada o desvinculada explícitamente.
10. Manual-off (Estado F) seguido de un nuevo login del MISMO actor → el rebind automático NO debe revertir el manual-off.
11. Permiso `denied` (Estado B) → nunca se intenta ningún `requestPermission`, mensaje pasivo únicamente.
12. Backend huérfano (Estado E, subscription física revocada externamente) → detectado, no reparado automáticamente, requiere gesto explícito del usuario en Ajustes.
13. CuentaOperativa con push a nivel de cuenta ya vigente + nuevo vínculo Empleado en un negocio distinto → `resolveOperationalPushTargets` sigue usando la fila de cuenta (regresión, ya cubierto por T44 pero re-verificado aquí por no-interferencia).
14. Cambio de `areaOperativa` de un Empleado (p. ej. mozo → salón) → el rebind no debe crear filas duplicadas ni depender del área (el resolver ya es agnóstico al área, sólo depende de `cuentaOperativaId`).
15. Cold start de PWA (app cerrada por completo, reabierta) con sesión aún válida → reconciliación corre una vez al recuperar el foco/montaje inicial, sin diálogo si ya está en A.
16. Múltiples pestañas del mismo navegador con la misma sesión → el rebind debe ser idempotente si corre en más de una pestaña simultáneamente (no debe crear filas duplicadas ni errores de carrera — reutiliza el `LatestOperationGate` ya existente).
17. Multi-PWA (Cliente instalado + Operaciones instalado en el mismo dispositivo, mismo origen) → confirmar que comparten la misma subscription física (ya confirmado arquitectónicamente en §2) y que el rebind de cada actor sólo toca su propia fila.
18. Reintento tras error de red durante el rebind → no debe bloquear el login ni mostrar error visible al usuario; reintento en el siguiente montaje relevante.
19. SuperAdmin → confirmar que el disparador de reconciliación NUNCA se ejecuta para esta familia (rama inerte, sin cambio de comportamiento).

---

## 16. Tests de seguridad obligatorios

- Verificar que el rebind derive el owner EXCLUSIVAMENTE del token/sesión server-side, nunca de un valor enviado por el cliente (regresión sobre el patrón ya vigente en `/api/push/subscribe`).
- Verificar que el rebind de un actor nunca pueda borrar o sobrescribir la fila de otro owner en el mismo endpoint (test directo sobre la clave única compuesta).
- Verificar que un manual-off (F) no sea revertible por ningún camino automático, sólo por acción explícita del usuario.
- Verificar que el DELETE de cualquier ruta de push-subscription siga exigiendo match exacto de endpoint (regresión).
- Verificar que ninguna ruta de reconciliación exponga o acepte `ownerId`/`ownerType` como parámetro de entrada controlable por el cliente.

---

## 17. Matriz de certificación física futura (preparada, NO ejecutada en este round)

1. Caso A — Login nuevo en dispositivo con permiso `default`: confirmar un solo prompt nativo.
2. Caso B — Login con permiso ya `granted` de otra cuenta en el mismo dispositivo: confirmar que NO aparece ningún diálogo y que las notificaciones de la cuenta nueva sí llegan (rebind silencioso funcionando).
3. Caso C — Dejar la sesión expirar naturalmente (esperar 12h o forzar expiración en Testing) sin cerrar sesión, luego loguear otra cuenta en el mismo dispositivo: confirmar que la cuenta nueva recibe sus propias notificaciones sin cruce con la anterior.
4. Caso D — Logout explícito seguido de nuevo login del mismo actor: confirmar continuidad sin re-pedir permiso.
5. Caso E — Manual-off desde Ajustes, luego nuevo login: confirmar que el push sigue apagado hasta reactivación explícita.
6. Caso F — Permiso denegado a nivel navegador: confirmar mensaje pasivo, cero intento de re-preguntar.
7. Caso G — Tablet compartida entre dos cuentas operativas (Mozo/Operaciones) en secuencia con logout explícito entre ambas: confirmar cero cruce de notificaciones "pedido listo".

---

## 18. Salida final (marcadores)

```text
P2_T40_A0_STATUS=AUDIT_AND_DESIGN_COMPLETE
IMPLEMENTATION_PERFORMED=NO
FILES_MODIFIED_OUTSIDE_THIS_REPORT=NO
DB_SCHEMA_TOUCHED=NO
LOGIN_LOGOUT_SW_API_TOUCHED=NO
PRODUCTION_TOUCHED=NO
T38_T39_T44_T45_T52_REOPENED=NO
TERMINAL_IN_SCOPE=NO_BY_DESIGN
SUPERADMIN_PUSH_LIFECYCLE_APPLICABLE=NO
HEADLINE_BUG=SYNC_SESSION_401_HANDLER_NO_PUSH_DETACH_ON_SESSION_EXPIRY
MOZO_PERSONAL_PUSH_LIFECYCLE=UNIFICADO_VIA_RESOLVER_SPLIT_BRAIN_NO
MODEL_C1_MULTI_BIND=CONFIRMADO_CORRECTO_NO_TOCAR
PHYSICAL_UNSUBSCRIBE_POLICY=SERVER_DETACH_ONLY_CONFIRMADO_CORRECTO_NO_TOCAR
RECOMMENDED_OPTION=A_CENTRALIZED_RECONCILIATION_TRIGGER
AUTO_REBIND_ALLOWED=SI_BAJO_CONDICIONES_SECCION_13
LATERAL_FINDING_NO_EXPANDIDO=use-operativo-pyr-push.ts sin punto de montaje en ninguna UI (código huérfano)
NEXT_RECOMMENDED_ACTION=P2_T40_R1_IMPLEMENTATION_PENDING_OPERATOR_AUTHORIZATION
DEPLOY_AUTHORIZED_THIS_ROUND=NO
PRODUCTION_AUTHORIZED_THIS_ROUND=NO
```

**Próxima acción recomendada:** esperar autorización explícita del operador para iniciar P2-T40-R1 (implementación acotada al plan de archivos de §14 — únicamente `use-auth.ts`/`permission-prompt.tsx` y su equivalente operativo), o indicar una prioridad distinta del backlog. Ninguna acción adicional se toma en este round por instrucción explícita del propio prompt de T40-A0 (§58).
