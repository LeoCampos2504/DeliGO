# P2-T39-R3 — SuperAdmin Push Delivery Implementation

## Estado

`P2_T39_STATUS=R3_IN_PROGRESS_DELTA_AUDIT_COMPLETE`

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
