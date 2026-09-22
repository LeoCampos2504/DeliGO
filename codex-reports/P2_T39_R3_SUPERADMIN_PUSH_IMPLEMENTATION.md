# P2-T39-R3 — SuperAdmin Push Delivery Implementation

## Estado

`P2_T39_STATUS=R3_IMPLEMENTED_TESTING_AWAITING_PHYSICAL_CERTIFICATION`

Worktree `C:\Leo Campos\Trabajo\deligo-t39-admin`, rama `work/p2-t39-r3`, creada
desde `origin/testing-codex` en `e1fee008d326b800cb311f5a65a391601c4dc1ab`. La
rama histórica `work/p2-t39-admin-notifications` (R0/R1/R2) queda intacta.

## §3 — Recuperación de autoridad R0/R1/R2

```text
T39_R0_R1_AUTHORITY_FOUND=SI (git show de work/p2-t39-admin-notifications,
  codex-reports/P2_T39_R0_R1_ADMIN_BUSINESS_REQUEST_NOTIFICATION.md, 209 líneas, leído completo)
T39_R2_AUTHORITY_FOUND=SI (git show de la misma rama,
  codex-reports/P2_T39_R2_SUPERADMIN_NOTIFICATION_DELIVERY_ARCHITECTURE.md, 467 líneas, leído completo)
```

## §4 — Delta audit: R2 (pre-T40, HEAD `74e4939`) vs realidad actual (HEAD `e1fee008`)

| # | R2_ASSUMPTION | CURRENT_REALITY | STILL_VALID | CHANGE_REQUIRED | REASON |
|---|---|---|---:|---:|---|
| A | `PushSubscriptionOwnerType` enum no incluye `superadmin` | Confirmado igual en `prisma/schema.prisma:1336-1342` (`cliente,negocio,repartidor,empleado,cuenta_operativa`) | SI | SI | T40 no tocó el enum; sólo agregó lógica de detach sobre owners ya existentes |
| B | `push-subscription-repository.ts` `OWNER_TYPES` no incluye `superadmin` | Confirmado igual, línea 34-40 | SI | SI | Mismo — es un simple `Array.includes`, agregar el valor del enum basta, cero cambio estructural |
| C | Rutas compartidas `/api/push/{subscribe,status,unsubscribe}` tienen sólo rama `case "superadmin"` legacy/dead (gateada por `SESSION_COOKIE_NAME`, que SuperAdmin nunca usa) | Confirmado igual en las 3 rutas; `NORMALIZED_OWNER_TYPES` sigue excluyendo `superadmin` explícitamente con el mismo comentario P2-T17 | SI | SI | Sin cambios de T40 en esta rama específica |
| D | Precedente reutilizable: rama `actorFamily=cuenta_operativa` chequeada ANTES del cookie de sesión compartida, con su propio auth dedicado | Confirmado — `subscribe/route.ts:25-43` usa exactamente este patrón con `getOperationalAccountFromRequest` | SI | N/A (decisión de diseño, no gap) | T40 no la modificó; sigue siendo el mejor precedente a espejar para `superadmin` en vez de crear rutas nuevas dedicadas — más consistente con la evolución post-T40 del propio repo |
| E | `CorePushOwnerType` (en `push.ts`) no incluye `superadmin` | Confirmado, línea 410: `"cliente" \| "negocio" \| "repartidor" \| "empleado" \| "cuenta_operativa"` | SI | SI | Sin cambio; agregar `superadmin` es aditivo |
| F | `public/sw.js` no tiene rama `actorFamily`/dispatch para SuperAdmin | Confirmado — única mención es un comentario en la línea 429 sobre `data.role`; no hay lógica real | SI | SI | T44 (que iba a tocar este archivo) sigue `PAUSED_UNRESOLVED_AFTER_TIMEBOX`; sus cambios de SW nunca se mergearon a testing-codex |
| G | Los 6 productores (`verify-email`, `destacado-solicitud`, `denuncias`, `cliente/pedidos/[id]`, `review-moderation-server`, `review-moderation-business`) siguen exactamente como R2 los documentó, línea por línea | Releídos completos en esta ronda — `tipo`, `datos`, transacción/best-effort, e idempotencia coinciden exactamente con R2 | SI | NO (para persistencia); SI (para agregar el post-commit dispatch) | Ningún productor cambió su forma de negocio desde R2; sólo falta agregar el paso de Push después del commit |
| H | `SuperAdmin.pushSubscription` (legacy) es un campo muerto/inerte para el flujo real de auth de SuperAdmin | Confirmado — la rama `case "superadmin"` en las 3 rutas compartidas sigue gateada detrás de `SESSION_COOKIE_NAME`, que `/admin` nunca setea (usa `deligo_superadmin_session`) | SI | NO | Sigue inalcanzable en la práctica; no se toca ni se elimina en R3 (fuera de alcance quitar compat legacy) |
| I | T40 cambió sustancialmente la arquitectura de Push compartida (handoff cookie, stale-owner cleanup, legacy dual-clear) | Confirmado — `src/lib/push-owner-handoff.ts`, `/api/push/reconcile-stale-owner`, `detachLegacyPushFieldIfMatches` son todos nuevos desde R2 | SI | SI (compatibilidad, no reimplementación) | R3 debe construir el owner moderno de SuperAdmin de forma que, si en el futuro se decide extender el handoff/reconciliación a SuperAdmin-a-SuperAdmin, sea pura ADICIÓN de un nuevo valor soportado — nunca modificación del comportamiento ya certificado de los otros 4 owners. Esta ronda NO implementa esa extensión (fuera del alcance explícito del prompt: T40 debe preservarse exactamente cerrado); sólo se documenta como gap de seguimiento |
| J | `usePushNotifications()` (hook compartido) ya acepta `options.actorFamily`/`options.actorKey` genéricos, reutilizados hoy por CuentaOperativa vía `?actorFamily=` | Confirmado en `src/hooks/use-push-notifications.ts:379-384,587,860` — el hook es 100% genérico, no requiere ningún hook nuevo dedicado a Admin | Parcialmente nuevo respecto a R2 (R2 sugería "hook admin equivalente aislado" como posible necesidad) | SI, pero MENOS trabajo del que R2 anticipaba | El hook compartido ya resuelve `actorFamily` sin acoplarse a `useAuthStore` cuando se pasa explícito — reutilizarlo directo para `/admin` es más seguro y consistente que crear un hook paralelo |

### Conclusión del delta audit

Ningún supuesto de R2 quedó invalidado por T40. T40 amplió la arquitectura de
Push (handoff, stale-owner cleanup, legacy dual-clear) pero no tocó ninguno de
los archivos que R2 identificó como pendientes para SuperAdmin, y no agregó
`superadmin` al enum ni al owner allowlist. El único ajuste real de diseño
respecto a R2 es un **alcance menor**, no mayor: el hook compartido ya sirve
tal cual (ítem J), y el patrón de rama-en-archivo-compartido (`actorFamily=`)
que T40 mismo siguió usando para `cuenta_operativa` es la opción de más bajo
riesgo — se descarta la alternativa de R2 de rutas dedicadas
`/api/superadmin/push/*`.

## §5 — Revalidación del inventario de 5 tipos / 6 triggers (contra HEAD actual)

Los 6 callsites fueron releídos completos en esta ronda. Todos coinciden
exactamente con el inventario de R2 — ninguna línea de negocio, `tipo`,
`datos` o guarda de idempotencia cambió.

| TYPE | CALLSITE (línea actual) | RECIPIENT_POLICY | NAVIGATE_TO | ENTITY_ID | IDEMPOTENCY_GUARD | CAMBIO_DESDE_R2 |
|---|---|---|---|---|---|---|
| `negocio_pendiente` | `src/app/api/auth/verify-email/route.ts:96` (dentro de tx) | todos los SuperAdmin activos | `pendientes` | `negocio.id` | CAS `id+verificationToken+expiración+emailVerified=null` | NINGUNO |
| `destacado_solicitud` | `src/app/api/destacado-solicitud/route.ts:83` (best-effort post-create, try/catch) | todos los SuperAdmin activos | `solicitudes-destacado` | `solicitud.id` | `existingPending` único por Negocio | NINGUNO |
| `denuncia_nueva` | `src/app/api/denuncias/route.ts:286` (dentro de tx Serializable) | todos los SuperAdmin activos | `denuncias` | `denuncia.id` | unicidad de denuncia + tx serializable | NINGUNO |
| `negocio_deuda` | `src/app/api/cliente/pedidos/[id]/route.ts:337` (dentro de tx financiera) | todos los SuperAdmin activos | `deudas` | `negocio.id` | `crossedDebtAlertThreshold` sólo en el cruce real | NINGUNO |
| `review_moderation` (nueva solicitud) | `src/lib/review-moderation-server.ts:154` (tx Serializable) | revisor preferido si existe; si no, todos los activos | `moderacion-resenas` | `solicitudId` (no `entityId` flat) | máquina de estados + tx | NINGUNO |
| `review_moderation` (información aportada) | `src/lib/review-moderation-business.ts:112` (tx Serializable) | revisor preferido si existe; si no, todos los activos | `moderacion-resenas` | `solicitudId` | transición válida + tx | NINGUNO |

## Infraestructura confirmada reutilizable sin cambio estructural

- `registerPushSubscription`, `getPushSubscriptionsForOwner`,
  `getPushSubscriptionsForOwners`, `detachPushSubscriptionByEndpoint`,
  `hasPushSubscriptionForOwnerEndpoint` (`src/lib/push-subscription-repository.ts`)
  ya son 100% genéricas sobre `PushSubscriptionOwnerType` — agregar
  `superadmin` al enum Prisma las habilita automáticamente, sin tocar este
  archivo salvo el array `OWNER_TYPES`.
- `resolveCorePushTargets`/`resolveCorePushTargetsFromNormalized`
  (`src/lib/push.ts`) — requieren agregar `"superadmin"` a `CorePushOwnerType`
  y (dado que SuperAdmin SÍ tiene un campo legacy real, aunque inerte)
  potencialmente decidir si se una-unión con ese legacy o se ignora
  deliberadamente (decisión: threading el legacy sería reactivar una rama
  muerta sin ningún escritor activo que la mantenga consistente — se trata
  como huérfano y se ignora explícitamente, ver R3 más abajo).
- `requireSuperadminSession`/`SUPERADMIN_SESSION_COOKIE_NAME`/`SuperadminIdentity`
  (`src/lib/superadmin-auth.ts`) — auth dedicado ya existente, listo para
  usarse en las 3 rutas compartidas exactamente como `cuenta_operativa`.
- `usePushNotifications({ actorFamily: "superadmin" })`
  (`src/hooks/use-push-notifications.ts`) — reutilizable tal cual, sin hook
  nuevo.

Próximo paso: diseño e implementación del dispatcher post-commit (§6-§7),
seguido de la migración mínima del enum (§8/§17) y el cableado de las 3 rutas
compartidas + productores + SW + UI (§9-§14).

## §6-§14 — Implementación

### Migración y owner moderno

- `prisma/schema.prisma`: `superadmin` agregado a `enum PushSubscriptionOwnerType`
  (valor aditivo, comentario explícito de que el legacy queda inerte).
- `prisma/migrations/20260921120000_add_superadmin_push_owner/migration.sql`:
  `ALTER TYPE "PushSubscriptionOwnerType" ADD VALUE IF NOT EXISTS 'superadmin';`
  — mismo patrón exacto que la migración previa de `cuenta_operativa`
  (`20260914100000_account_level_personal_push`). Sin backfill: no hay filas
  legacy que migrar a un owner nuevo que nunca existió.
- `src/lib/push-subscription-repository.ts`: `superadmin` agregado al array
  `OWNER_TYPES` — habilita automáticamente `registerPushSubscription`,
  `getPushSubscriptionsForOwner(s)`, `detachPushSubscriptionByEndpoint`,
  `hasPushSubscriptionForOwnerEndpoint` para este owner sin ningún otro cambio
  estructural (ya eran genéricas sobre el enum).
- `src/lib/push.ts`: `superadmin` agregado a `CorePushOwnerType`; 5 nuevos
  valores de `NotificationType` (`negocio_pendiente`, `destacado_solicitud`,
  `denuncia_nueva`, `negocio_deuda`, `review_moderation`) para el `data.type`
  del payload de Push — nunca se usan para dispatch por tipo en el SW.

### Dispatcher post-commit

`src/lib/superadmin-push-dispatch.ts` — `dispatchSuperadminPush(recipientIds,
envelope)`: resuelve `resolveCorePushTargets("superadmin", id, null)` por cada
recipientId (nunca lee el campo legacy — `legacyRaw` siempre `null`), dedupea
por endpoint físico con `mergePushFanoutTargets` (ya existente, sin cambios),
envía con `sendPushToTargets` (ya existente). Try/catch exterior best-effort:
nunca lanza, sólo loguea con `safeErrorForLog` (nunca endpoint/p256dh/auth/
VAPID/cookies/JWT/payload completo).

### Rutas compartidas (subscribe/status/unsubscribe)

Las 3 rutas (`src/app/api/push/{subscribe,status,unsubscribe}/route.ts`)
ganaron una rama `req.nextUrl.searchParams.get("actorFamily") === "superadmin"`
— chequeada ANTES de la lógica basada en `SESSION_COOKIE_NAME`, mismo lugar y
mismo patrón exacto que la rama ya existente de `cuenta_operativa`. Usa
`requireSuperadminSession(req)` (import dinámico, igual que
`getOperationalAccountFromRequest` en la rama hermana) — owner/ownerId
siempre server-derived del admin autenticado, nunca del body/query. La rama
legacy `case "superadmin":` original (gateada por `SESSION_COOKIE_NAME`, que
`/admin` nunca setea) queda intacta y sigue siendo inalcanzable en la
práctica — no se tocó ni se eliminó (compatibilidad legacy preservada).

### Productores (6 callsites)

Cada uno de los 6 callsites ahora captura `{ recipientIds }` del helper
correspondiente (`notifySuperadmins`/`notifyReviewModerationSuperadmins`,
ambos con return type extendido a `{ count, recipientIds }`, back-compat:
nada consumía antes el valor de retorno salvo los tests actualizados) y llama
a `dispatchSuperadminPush(...)` DESPUÉS de que la transacción de negocio
resuelve (fire-and-forget, `.catch(() => {})` defensivo — la función interna
ya nunca lanza):

- `src/app/api/auth/verify-email/route.ts` — dispatch tras `db.$transaction`.
- `src/app/api/destacado-solicitud/route.ts` — ya no transaccional; dispatch
  dentro del mismo `try/catch` best-effort que ya envolvía la persistencia.
- `src/app/api/denuncias/route.ts` — `superadminRecipientIds` viaja en el
  `PostOutcome` union (`kind: "creada"`); dispatch tras el `try/catch` externo.
- `src/app/api/cliente/pedidos/[id]/route.ts` — nuevo campo `debtAlert` en
  `ConfirmOutcome` (`kind: "confirmed"`); dispatch sólo si hubo cruce real de
  umbral.
- `src/lib/review-moderation-server.ts` / `review-moderation-business.ts` —
  `createReviewModerationRequest`/`addBusinessReviewModerationInformation`
  capturan el resultado del `db.$transaction` en una variable (antes
  `return await db.$transaction(...)` directo), despachan, y devuelven el
  resultado público sin el campo interno `superadminRecipientIds` (nunca
  expuesto a los callers/tests existentes).

Ningún productor cambió su guarda de idempotencia (CAS de `negocio_pendiente`,
unicidad+tx serializable de `denuncia_nueva`, `crossedDebtAlertThreshold` de
`negocio_deuda`, máquina de estados de `review_moderation`) — todas
verificadas releídas línea por línea contra el inventario de R2 antes de
tocar el archivo.

### Service Worker

`public/sw.js`: en el handler `push`, `data.data?.actorFamily` decide el
ícono (`/icon-admin-192x192.png`) ANTES que `role`/`notifType`, y se copia a
`notification.data.actorFamily` para que `notificationclick` lo pueda leer.
En `notificationclick`, una rama nueva (la PRIMERA, antes de la de
Operaciones) chequea `notificationData.actorFamily === "superadmin"`: navega/
enfoca una ventana existente en `/admin` o `/admin/`, o `openWindow("/admin")`
si no hay ninguna — el destino es SIEMPRE el literal fijo `/admin`,
independiente de `entityId`/`navigateTo`/`type`/cualquier `url` del payload
(no hay parsing de URL externa que pueda inyectarse). No se tocó ninguna otra
rama (Operaciones/personal/salón/mozo), ni la lógica pausada de T44.

### UI

`src/components/superadmin/superadmin-push-settings.tsx` (nuevo) — switch
ON/OFF único, sin preferencias por tipo, reutiliza
`usePushNotifications({ actorFamily: "superadmin", actorKey: "superadmin" })`
tal cual (ya era suficientemente genérico — no hizo falta un hook nuevo,
ítem J del delta audit). Montado en `ConfiguracionTab` de `/admin`
(`src/components/superadmin/configuracion-tab.tsx`), junto a la tarifa de
plataforma. La campana y el polling interno de `/admin` no se tocaron —
siguen siempre activos, independientemente del switch.

## §15-§17 — Idempotencia, fallos y migración

```text
IDEMPOTENCY_PRESERVED=SI (ningún CAS/guardia de unicidad tocado en los 6 productores)
FAILURE_MODEL=BEST_EFFORT_POST_COMMIT_NEVER_ROLLS_BACK_BUSINESS_OP
FORBIDDEN_LOG_FIELDS_VERIFIED_ABSENT=SI (endpoint raw, p256dh, auth, VAPID private key, cookies, JWT/session, payload completo del proveedor)
MIGRATION_TYPE=ADDITIVE_ENUM_VALUE_ONLY
MIGRATION_BACKFILL_REQUIRED=NO
MIGRATION_APPLIED_TESTING=SI (ver §22)
```

## §18-§19 — Tests y quality gates

```text
NEW_TEST_FILES=src/lib/superadmin-push-dispatch.test.ts (7 tests),
  src/lib/sw-superadmin-push-routing.test.ts (10 tests)
UPDATED_TEST_FILES=src/lib/push-subscription-repository.test.ts (contrato MD57
  del enum, ahora incluye superadmin),
  src/lib/superadmin-notifications.integration.test.ts (return shape
  {count, recipientIds} en 3 de sus propios usos)
FOCAL_PURE_TESTS=254 pass / 0 fail / 604 expect() calls, 11 archivos
  (push.test.ts, superadmin-push-dispatch.test.ts, push-subscription-
  repository.test.ts, sw-push-role-icon-routing.test.ts, sw-
  notificationclick-target-routing.test.ts, sw-superadmin-push-routing.test.ts,
  sw-push-dedupe.test.ts, sw-icon-cache-bypass-static-contract.test.ts,
  push-owner-handoff.test.ts, push-manual-optout.test.ts, push-session-
  reconciliation-static-contract.test.ts)
DB_INTEGRATION_TESTS_EXECUTED=NO (worktree aislado sin DATABASE_URL — mismo
  gap de entorno ya documentado en R0/R1/R2; superadmin-notifications.
  integration.test.ts, review-moderation-notifications.integration.test.ts y
  el resto de la suite de integración de push quedan pendientes de ejecución
  por el operador/CI con DELIGO_TEST_DATABASE_URL configurada antes de la
  certificación física)
TSC_BASELINE=31 errores preexistentes (confirmado releyendo cada uno: ninguno
  en archivos tocados por esta ronda salvo 1 preexistente ya documentado en
  push.ts:801, no relacionado a los cambios de este round)
TSC_NEW_ERRORS=0 (2 errores auto-inducidos por este mismo round — tipos union
  ConfirmOutcome/PostOutcome sin los campos nuevos — se encontraron y
  corrigieron ANTES de este conteo final)
ESLINT=PASS (0 warnings/errors en los 19 archivos producto+test tocados)
BUILD=NOT_RUN (next build completo no se ejecutó este round; el runtime real
  del deploy Testing, abajo, sirve como verificación equivalente de arranque)
```

Nota de entorno: `node_modules` no existía en este worktree aislado (mismo
hallazgo de R0/R1/R2). Para poder correr `tsc`/`eslint`/`bun test` se copió
`node_modules` desde el worktree principal (`deligo-main-limpio`) — un
efecto colateral no destructivo, local a este worktree, nunca comprometido a
Git (`node_modules/` está en `.gitignore`). El cliente Prisma se regeneró
desde el propio `schema.prisma` de este worktree (`prisma generate`) para que
el enum `superadmin` estuviera disponible en los tipos antes de typecheckear.

## §20-§22 — DB safety, commit, deploy

```text
TESTING_DATABASE_MUTATED=NO (ningún test de integración se ejecutó este round)
COMMIT_1=a808453fd8ca8120412c4c257ed211098f8ea819 (implementación)
COMMIT_2=7441866 (reconciliación de authority docs)
PUSH_RESULT=SUCCESS origin/testing-codex (fast-forward desde e1fee008)
TESTING_DEPLOYMENT_ID=081f9509-2321-4af2-87d2-b65850d9cfb4
TESTING_DEPLOYMENT_STATUS=SUCCESS
TESTING_DEPLOYMENT_COMMIT_MATCH=SI (a808453fd8ca8120412c4c257ed211098f8ea819)
TESTING_MIGRATION_APPLIED=20260921120000_add_superadmin_push_owner (confirmado en logs: "Applying migration", 34 migraciones encontradas, todas aplicadas)
TESTING_BOOT_LOG=LIMPIO (Next.js Ready in 67ms, cero error/exception/fatal/unhandled/failed en logs)
TESTING_SMOKE=GET /admin -> 200
PRODUCTION_ORIGIN_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763 (verificado sin cambio antes y después)
PRODUCTION_TOUCHED=NO
```

## §23 — Matriz de certificación física (preparada, NO ejecutada)

Claude no ejecutó ni simuló ninguna certificación física — esta matriz es
exclusivamente para que el operador la corra manualmente contra Testing.

### Caso headline: `negocio_pendiente`

```text
PRECONDICIÓN: sesión SuperAdmin real en /admin, en un browser/dispositivo
  con Web Push soportado (Chrome/Edge/Firefox de escritorio, o Android).
PASO 1: en /admin -> Configuración, activar el switch "Notificaciones push".
  Confirmar permiso del navegador si se solicita.
PASO 2: confirmar visualmente switch=ON y (F12 -> Application -> Service
  Workers -> Push) una subscription física registrada.
PASO 3: cerrar la pestaña/ventana de /admin (o minimizarla) — dejar el
  browser abierto en background, no cerrar el proceso del browser entero
  si se quiere probar "PWA cerrada pero browser vivo"; para el caso más
  estricto, cerrar el browser por completo también.
PASO 4: en otra sesión (otro browser/perfil/dispositivo), registrar un
  Negocio de prueba nuevo y verificar su email por el link real recibido
  (o el link de testing si el operador tiene ese atajo).
PASO 5: confirmar en DB (o por el propio dashboard admin cuando se reabra)
  que ese Negocio quedó aprobado=false, emailVerified != null.
PASO 6: EVIDENCIA ESPERADA — llega exactamente una notificación Push nueva
  en el dispositivo del PASO 1-3, con título "Nuevo negocio pendiente" y
  cuerpo mencionando el nombre del negocio de prueba.
PASO 7: tocar/hacer click en la notificación -> debe abrir (o enfocar si ya
  hay una ventana) /admin — nunca otra ruta, nunca fallar silenciosamente.
PASO 8: reabrir la campana en /admin -> confirmar que la fila persistente
  también está ahí (independiente del Push, ya cubierto por R0/R1) y que el
  switch de Configuración sigue mostrando ON.
RESULTADO_ESPERADO: PASS si 6-8 se cumplen exactamente; documentar cualquier
  desviación (retraso, ícono incorrecto, tap a ruta distinta, duplicados).
```

### Casos secundarios (opcionales, cubren productores transaccionales distintos)

```text
CASO_DENUNCIA_NUEVA: repetir el mismo dispositivo/switch ON de arriba;
  hacer que un Negocio real denuncie a un Cliente real (flujo de pedido +
  denuncia). Esperado: Push "Nueva denuncia registrada", tap -> /admin.
CASO_REVIEW_MODERATION: un Negocio solicita revisión de una reseña propia
  (tab Reseñas -> solicitar revisión). Esperado: Push "Nueva solicitud de
  revisión", tap -> /admin.
CASO_MULTI_SUPERADMIN (si hay 2+ SuperAdmin activos disponibles para la
  prueba): activar Push en dos sesiones SuperAdmin distintas (dispositivos
  distintos) y repetir el caso headline — esperado: AMBOS dispositivos
  reciben el Push (una fila lógica por SuperAdmin activo, fan-out físico
  real).
CASO_TOGGLE_OFF: desactivar el switch, repetir el caso headline —
  esperado: la fila Notificacion se sigue creando (campana/badge la
  reflejan), pero NO llega ningún Push a ese dispositivo.
CASO_AUTH_REJECTION (rápido, en DevTools o curl): un POST a
  /api/push/subscribe?actorFamily=superadmin sin la cookie
  deligo_superadmin_session debe responder 401, nunca aceptar un owner
  del body.
```

## Markers finales

```text
P2_T39_STATUS=R3_IMPLEMENTED_TESTING_AWAITING_PHYSICAL_CERTIFICATION
P2_T39_R3_DELTA_AUDIT=COMPLETE_NO_R2_ASSUMPTION_INVALIDATED
P2_T39_R3_IMPLEMENTATION=COMPLETE
P2_T39_R3_COMMIT=a808453fd8ca8120412c4c257ed211098f8ea819
P2_T39_R3_DOCS_COMMIT=7441866
P2_T39_R3_TESTING_DEPLOY=081f9509-2321-4af2-87d2-b65850d9cfb4_SUCCESS_EXACT_COMMIT
P2_T39_R3_PRODUCTION_TOUCHED=NO
P2_T39_R3_PHYSICAL_CERTIFICATION=NOT_EXECUTED_MATRIX_PREPARED_FOR_OPERATOR
P2_T39_R3_T40_COMPATIBILITY=PRESERVED_UNCHANGED
P2_T39_R3_T44_UNTOUCHED=SI
P2_T39_R3_STOP=SI (no T38, no T33, no otra tarea, no Production, no certificación física ejecutada por Claude)
```
