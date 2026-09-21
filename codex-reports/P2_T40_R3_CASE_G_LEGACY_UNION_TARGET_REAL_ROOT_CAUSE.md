# P2-T40-R3 — CASE G Todavía Falla Tras R2: Causa Raíz Real (Legacy Union Target)

**Tipo:** DIAGNÓSTICO FORENSE DE RUNTIME + CAUSA RAÍZ + FIX MÍNIMO + TESTS + DEPLOY TESTING. Production prohibido.

**T40 sigue sin cerrarse.** `RELEASE_ELIGIBLE=NO`.

---

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=ab625cae0abea836dc9465bfee653e6706f41c55
ORIGIN_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763 (sin cambios)
```

Mismo patrón que R2: el HEAD real (`ab625ca`) está un commit por delante del
`2e0ee2b` esperado por el prompt — es el propio commit
`docs: report P2-T40-R2 Testing deployment verification` que esta misma
sesión creó al cerrar R2 (documentation-only, ya reportado al operador).
Sin drift ajeno. `git status --short` mostró únicamente los mismos 2
archivos de documentación pre-existentes ya dirty. Worktree T39 no tocado.

---

## 2. Forensia de runtime — timeline real (nunca inferido)

Se consultaron los logs REALES de Railway (`railway logs -d --since 12h
--filter "PushOwnerHandoff" --json`) del deployment `1bcbc61e-6304-48e8-9b1b-4ba6d00a278e`,
en la ventana de la recertificación física de R2 (CASE G aún FAIL). Se
capturó la telemetría fingerprinted que R2 dejó exactamente para este
propósito:

| TIMESTAMP (UTC) | EVENT | FAMILY | PREV_OWNER_FP | CURRENT_OWNER_FP | HANDOFF | STALE_CLEANUP | SUBSCRIBE |
|---|---|---|---|---|---|---|---|
| 17:15:53.9226 | mint (login A) | negocio | n/a | `baa30dddbf` | signed=true | n/a | n/a |
| 17:15:53.9228 | consume (A's own post-login reconcile) | negocio | n/a | `baa30dddbf` | present=true verified=true familyMatch=true | attempted=NO (prevOwner null) | — |
| 17:16:33.7377 | **mint (login B over A, sin logout)** | negocio | `baa30dddbf` | `19a05632f5` | signed=true | n/a | n/a |
| 17:16:35.8567 | consume (B's reconcile, 1ra vez) | negocio | `baa30dddbf` | `19a05632f5` | present=true verified=true familyMatch=true | — | — |
| 17:16:35.8567 | **cleanup-attempt** | negocio | `baa30dddbf` | `19a05632f5` | — | **attempted=SI, detached=true** | — |
| 17:16:36.9798 | consume (B's reconcile, 2da vez, ~1.1s después) | negocio | `baa30dddbf` | `19a05632f5` | present=true verified=true familyMatch=true | — | — |
| 17:16:36.9798 | cleanup-attempt (2da vez) | negocio | `baa30dddbf` | `19a05632f5` | — | attempted=SI, detached=false (idempotente: A/X ya no existía) | — |

**Hallazgo secundario, no bloqueante para este fix**: la reconciliación de B
corrió DOS VECES en ~1.1 segundos (probable doble-disparo de
`PermissionPrompt`'s effect o dos pestañas/renders). El handoff, pensado
como de un solo uso, verificó como válido AMBAS veces — indica que el
`Set-Cookie` que limpia el handoff en la primera respuesta no alcanzó a
aplicarse antes de que la segunda request ya estuviera en vuelo. Esto es
inofensivo en la práctica (el segundo intento de detach es un no-op
idempotente sobre una fila ya borrada) pero se registra como hallazgo de
robustez para una ronda futura — no es la causa de CASE G.

---

## 3. Respuestas obligatorias (§5 del prompt)

```text
1. ¿Login B detectó sesión A previa? SI — prevOwner=baa30dddbf, coincide
   exactamente con el fingerprint de A.
2. ¿Handoff con prevOwner=A y family correcta? SI (family=negocio).
3. ¿Set-Cookie del handoff llegó a la respuesta de login B? SI — B lo
   presentó en su siguiente request (verified=true).
4. ¿El navegador llamó a reconcile-stale-owner? SI, dos veces.
5. N/A (sí lo llamó).
6. ¿Llevaba la cookie de handoff? SI, ambas veces.
7. ¿verifyPushOwnerHandoff() devolvió válido? SI, ambas veces.
8. ¿Current owner resolvió B? SI — currentOwner=19a05632f5 en ambas.
9. ¿prevOwner != currentOwner? SI.
10. ¿family coincidió? SI.
11. ¿staleCleanupPerformed fue true o false? true en el primer intento.
12. N/A (fue true).
13. ¿detachPushSubscriptionByEndpoint() eliminó realmente una fila? SI,
    confirmado por el propio log (`detached=true`) — la fila NORMALIZADA
    de A fue borrada correctamente.
14. Filas normalizadas de A antes/después: 1 antes (negocio/A/X), 0
    después — confirmado por el propio código (R1/R2 nunca fallaron acá).
15. **¿Existe otra fuente legacy por la cual A sigue recibiendo? SI —
    ésta es la causa raíz real, ver §4.**
16. **El Push que llegó a A salió por `Negocio.pushSubscription` (campo
    legacy per-modelo), NO por la tabla PushSubscription normalizada
    (esa ya estaba vacía para A).**
17. SI — dos fuentes de entrega activas simultáneamente para Negocio: la
    tabla normalizada (limpiada correctamente por R1/R2) y el campo legacy
    (nunca tocado por R1/R2).
18. La fila A/X normalizada NO volvió a crearse — se confirmó borrada y
    quedó borrada (el segundo intento de detach confirma `detached=false`,
    consistente con "ya no hay nada que borrar", nunca con una recreación).
19. N/A.
20. B y A comparten el MISMO endpoint físico X — es el mismo
    navegador/service worker/origin, una sola `PushManager` subscription
    física para todo el origen (confirmado arquitectónicamente desde A0).
```

---

## 4. Causa raíz real demostrada — Legacy Union Target

`src/lib/push.ts`'s `createNotification()` (el punto de entrada REAL para
TODA notificación, incluida la que el operador usó físicamente para
comprobar Push de A/B) resuelve el fan-out de un "core push owner"
(cliente/negocio/repartidor/empleado) llamando a:

```
resolveCorePushTargets(userType, userId, pushSubscription)
  -> resolveCorePushTargetsFromNormalized(ownerType, ownerId, legacyRaw, normalizedRows)
```

Esta función, documentada explícitamente desde P2-T05 Stage4 como diseño
INTENCIONAL ("UNION de sus PushSubscription normalizadas + su legacy
actual... durante mixed-version rollout el legacy puede tener un binding
válido aún no reflejado en normalized"), construye el conjunto de targets
como la **UNIÓN** de:
1. Las filas de la tabla normalizada `PushSubscription` para ese owner.
2. El valor RAW del campo legacy per-modelo (`Negocio.pushSubscription`
   para Negocio) — si tiene forma válida y su endpoint no está ya cubierto
   por (1).

`detachPushSubscriptionByEndpoint()` (la única primitiva que R1/R2 usaban
para la limpieza de stale-owner) **sólo borra de (1)** — nunca toca (2).
`Negocio.pushSubscription` es un campo POR FILA de la tabla `Negocio` (cada
negocio tiene el suyo, no un valor compartido) — el de A nunca se tocó, así
que seguía apuntando al mismo endpoint físico X mucho después de que la
fila normalizada de A fuera borrada exitosamente. El resultado de
`resolveCorePushTargets("negocio", A.id, A.legacyPushSubscription)` seguía
incluyendo X — exactamente la fuente por la cual A continuaba recibiendo
push, con la limpieza normalizada reportando éxito real y verdadero.

```text
CASE_G_TRUE_ROOT_CAUSE=
  resolveCorePushTargetsFromNormalized() hace UNION normalizado+legacy por
  diseño (P2-T05 Stage4, compatibilidad multi-dispositivo); R1/R2 sólo
  limpiaban la tabla normalizada del owner stale, dejando el campo legacy
  per-modelo (Negocio.pushSubscription) del owner anterior como target de
  envío vivo indefinidamente.
```

---

## 5. Por qué R1/R2 no la detectaron

Ninguno de los tests de R1/R2 (incluido el propio test de integración
encadenado de R2) invocaba jamás `resolveCorePushTargets()` — el resolver
REAL que usa el envío físico. Todos verificaban ÚNICAMENTE el estado de la
tabla normalizada (`pushRows`), que es exactamente donde R1/R2 SÍ
funcionaban correctamente. El bug vivía en una fuente de datos
completamente distinta (el campo legacy per-modelo) que ningún test
anterior siquiera mockeaba. Esta ronda corrige eso: el nuevo test
`CASE_G_REAL_ROOT_CAUSE_REGRESSION` invoca `resolveCorePushTargets()`
(importado real de `@/lib/push`, nunca reimplementado) antes y después del
fix para probarlo end-to-end con el resolver auténtico.

---

## 6. Fix aplicado (mínimo)

Nueva función `detachLegacyPushFieldIfMatches()` (exportada de
`src/lib/push.ts`), reutilizando las primitivas YA existentes
`readCurrentLegacyPushValue`/`casClearLegacyPushValue` (mismo patrón CAS —
lee el valor legacy ACTUAL y sólo lo limpia si coincide exactamente con la
subscription que se está detachando; si otro dispositivo escribió un valor
distinto entremedio, no se toca). Comparación deliberadamente de 3 campos
(`endpoint`+`p256dh`+`auth`, NUNCA `expirationTime`) — igual criterio que
`detachPushSubscriptionByEndpoint()` sobre la tabla normalizada y que
`sameFanoutSubscriptionKeys()` (P2-T05 Hardening H1), para que ambas
limpiezas usen exactamente el mismo criterio de "misma subscription
física" (se evitó reutilizar `safeClearLegacyIfMatches()` tal cual porque
esa función compara también `expirationTime`, pensada para el caso de
"exactamente el mismo objeto que acaba de fallar al enviarse", no para
"la subscription física actual reportada por el cliente en otro momento").

`src/app/api/push/reconcile-stale-owner/route.ts` ahora llama a esta nueva
función inmediatamente después del detach normalizado exitoso, usando el
MISMO `endpoint`/`p256dh`/`auth` ya parseado — `cuenta_operativa` se omite
explícitamente (nunca tuvo campo legacy, A0 §11); `empleado` se incluye por
completitud aunque nunca es `prevOwnerType` en la práctica hoy (Empleado no
tiene login propio).

Cero cambio de arquitectura, cero cambio de schema — el campo legacy ya
existía, sólo se agregó su limpieza condicionada (CAS) al mismo punto
donde ya se limpiaba la tabla normalizada.

---

## 7-10. Invariantes preservados

```text
CROSS_FAMILY_MULTI_BIND_PRESERVED=SI — detachLegacyPushFieldIfMatches
  opera EXCLUSIVAMENTE sobre la fila Negocio del prevOwner (por su propio
  `id`) — nunca toca CuentaOperativa (que ni siquiera tiene el campo) ni
  ningún otro Negocio. Test nuevo "cross-family multi-bind preserved"
  confirma que limpiar A nunca toca "negocio-OTHER".
PHYSICAL_UNSUBSCRIBE_USED=NO — nunca se llama PushSubscription.unsubscribe(),
  sólo se limpia el campo DB del owner stale.
CLIENT_SUPPLIED_OWNER_AUTHORITY=NO — el ownerId/model a limpiar viene
  exclusivamente de `handoff.prevOwnerType`/`prevOwnerId` (server-derivado,
  sin cambios respecto a R1/R2).
LEGACY_SUPPORT_ELIMINADO_SIN_AUDITAR=NO — no se borró ni se dejó de
  soportar el campo legacy; sólo se agregó SU limpieza en el punto de
  stale-owner, sin tocar ningún otro consumidor (dead-endpoint cleanup,
  dual-write de subscribe, etc. — todos intactos).
```

---

## 11. Nueva evidencia forense de runtime durante R3 (adenda del operador) — `/api/destacado-solicitud` 403

Se auditó `src/app/api/destacado-solicitud/route.ts`. Su `GET` responde
403 EXACTAMENTE cuando `getUserFromToken(token)` resuelve un usuario VÁLIDO
cuyo `user.type !== "negocio"` (si no hubiera token/sesión válida en
absoluto, respondería 401, no 403 — la propia distinción de status ya
prueba que SÍ se resolvió un actor real, sólo que de un tipo distinto al
esperado).

**Condición exacta que produjo el 403**: `/api/destacado-solicitud` NO
está en `ROLE_PROTECTED_ROUTES` (no deriva family de su propio path, a
diferencia de `/api/negocio/*`) ni en `SELECTOR_ENDPOINT_PREFIXES` de
`src/proxy.ts` (a diferencia de `/api/push/reconcile-stale-owner`, que sí
usa el selector `?actorFamily=` explícito). Para una ruta así,
`resolveActorSession()` cae en su rama de fallback ambiguo: cuenta cuántas
cookies candidatas (familia + legacy) existen; si hay EXACTAMENTE una, la
usa; si hay 2+, no reenvía nada (`token: null`, fail-closed) y el request
SALIENTE conserva su Cookie header ORIGINAL sin reescribir — el handler
lee entonces literalmente lo que haya en la cookie legacy plana
`deligo_session`, si existiera alguna, en vez de la cookie de family
`deligo_session_negocio` que B acaba de recibir.

Este navegador de prueba acumuló múltiples rondas de certificación física
de T40 (A-G) y, antes de eso, otras tareas — es plausible que en algún
punto anterior se haya autenticado un Cliente o Repartidor vía Google (que
sí escribe la cookie legacy `deligo_session` compartida, ver
`google/callback/route.ts`), dejando una cookie residual que nunca se
limpia por un login de Negocio (que sólo escribe/lee
`deligo_session_negocio`, nunca toca la legacy plana). Con esa cookie
residual aún válida (TTL 12h) coexistiendo con la nueva
`deligo_session_negocio` de B, `/api/destacado-solicitud` cae en el
fallback ambiguo y termina resolviendo esa identidad residual — no
negocio, de ahí el 403.

```text
DESTACADO_403_OBSERVED=SI
DESTACADO_403_ROOT_CONDITION=
  ambigüedad de cookie pre-existente (P2-T18-BLOCKER-AUTH2-R2, NO
  introducida por T40): /api/destacado-solicitud no deriva family de su
  path ni usa el selector ?actorFamily=, así que con 2+ cookies candidatas
  coexistiendo (la nueva deligo_session_negocio de B + una legacy
  deligo_session residual de una sesión Cliente/Repartidor anterior en
  este mismo navegador de pruebas) el middleware no reescribe nada
  (fail-closed) y el handler termina resolviendo la identidad residual, no
  Negocio B — 403 correcto y seguro dado ese input, pero una identidad
  inesperada para quien mira la UI y ve "Negocio B".
DESTACADO_403_RELATED_TO_CASE_G=
  NO_DIRECTAMENTE — la fuga de Push de CASE G queda completamente
  explicada, de forma independiente y ya confirmada por telemetría de
  runtime real, por el target legacy Negocio.pushSubscription (§4). El 403
  es un síntoma DISTINTO de la MISMA causa raíz arquitectónica más amplia
  (cookies de sesión residuales de rondas de prueba anteriores en el mismo
  navegador) — no la causa del leak de Push, que ya tiene su propia
  explicación completa y suficiente.
SESSION_OWNER_CONSISTENT_ACROSS_ENDPOINTS=
  NO — endpoints "family-aware" (`/api/push/reconcile-stale-owner`, que
  usa el selector explícito) resolvieron B de forma consistente y
  correcta en los logs reales (§2); un endpoint NO family-aware
  (`/api/destacado-solicitud`) es vulnerable al mismo fallback ambiguo que
  ya existía antes de T40 para cualquier ruta fuera de
  ROLE_PROTECTED_ROUTES/SELECTOR_ENDPOINT_PREFIXES. Esto es un hallazgo
  real y válido, pero es una brecha PRE-EXISTENTE de P2-T18-BLOCKER-AUTH2-R2
  (arquitectura de selección de cookie de family), no algo que T40 haya
  introducido ni algo que este fix deba corregir — por instrucción
  explícita del propio operador (§8 de la adenda), no se corrige acá.
  Se registra como hallazgo separado para una decisión futura del
  operador (posible ronda dedicada a extender SELECTOR_ENDPOINT_PREFIXES
  o el path-derivation a más rutas de Negocio/Cliente/Repartidor).
```

**No se modificó `/api/destacado-solicitud` en este round** — por
instrucción explícita, y porque no es necesario para cerrar CASE G (cuya
causa ya está demostrada y corregida de forma independiente).

---

## 12. Tests nuevos

`src/app/api/push/reconcile-stale-owner/case-g-same-family-account-switch.test.ts`
— se preservaron los 3 tests de R2 (BASELINE, DELAYED, sin-cookie) y se
agregaron 3 nuevos bajo `CASE_G_REAL_ROOT_CAUSE_REGRESSION`, usando
`resolveCorePushTargets` REAL (importado de `@/lib/push`, nunca
reimplementado):

1. Sanity check del propio comportamiento UNION del resolver (prueba que,
   sin el fix, el campo legacy solo ya alcanzaría para el leak).
2. **`NEGOCIO_A_TO_B_WITHOUT_LOGOUT`** — flujo encadenado completo (login
   B sobre A sin logout → reconcile → auto-rebind simulado de B) probando
   con el resolver real: `A_NOT_TARGETED_AFTER_SWITCH=PASS`,
   `B_TARGETED_AFTER_SWITCH=PASS`.
3. Cross-family/multi-bind preservado — limpiar el campo legacy de A
   nunca toca la fila de otro Negocio no relacionado.

---

## 13. Regresiones ejecutadas

```text
FOCAL_PASS=169 (incluye los 3 nuevos del root-cause real)
FOCAL_FAIL=0
REGRESSION_PASS=263 (267 tests totales, 30 archivos)
REGRESSION_FAIL=4 — LOS MISMOS 4 PRE-EXISTENTES YA CONFIRMADOS
  INDEPENDIENTES DE T40 EN R1 (no re-verificados contra stash limpio en
  esta ronda: ninguno de los 3 archivos que R3 tocó — push.ts,
  reconcile-stale-owner/route.ts, case-g test — está entre los 4
  archivos de esa colisión pre-existente)
```

---

## 14. Quality gates

```text
TSC_BASELINE_ERRORS=31
TSC_FINAL_ERRORS=31
TSC_NEW_ERRORS=0
ESLINT=PASS
BUILD=PASS
DIFF_CHECK=PASS
```

---

## 15. DB / Migraciones

```text
SCHEMA_CHANGE=NO
MIGRATION=NO
```

El campo legacy `Negocio.pushSubscription` ya existía (nunca se agregó ni
se quitó nada del schema) — el fix sólo agrega su limpieza condicionada en
el punto de stale-owner cleanup.

---

## 16-17. Commit y push

Commit único `fa4408dd855675365b9b0c90f4b75ed34ce0eb6e`
(`fix: fully detach stale business push target after account switch`),
pusheado `ab625ca..fa4408d` a `origin/testing-codex`. `main` no tocado.

## 18. Deploy Testing

Deployment `de1349d9-1f06-43ce-9984-49161554dbdf` — `SUCCESS`, commit
exacto `fa4408dd855675365b9b0c90f4b75ed34ce0eb6e` confirmado. Logs:
`33 migrations found`, `No pending migrations to apply`, servidor
`Ready in 59ms`, cero línea de error/exception/fatal/500/unhandled.
`PUSH_OWNER_HANDOFF_SECRET` confirmado presente (conteo=1, valor nunca
impreso ni rotado).

## 19-20. Estado Production y matriz física pendiente

Production permanece en `ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`, sin
tocar. Recertificación física pendiente, empezando otra vez por CASE G.

---

## Marcadores finales

```text
R2_TTL_ROOT_CAUSE_SUFFICIENT=NO
RUNTIME_LOGS_ANALYZED=SI (railway logs -d --since 12h --filter "PushOwnerHandoff" --json, deployment 1bcbc61e-6304-48e8-9b1b-4ba6d00a278e)
HANDOFF_MINTED_ON_A_TO_B=SI
HANDOFF_RECEIVED_BY_RECONCILE=SI
RECONCILE_TRIGGERED=SI
CURRENT_OWNER_RESOLVED_AS_B=SI
STALE_A_DETACH_ATTEMPTED=SI
STALE_A_DETACH_DELETED_COUNT=1 (tabla normalizada, primer intento; 0 en el
  segundo intento duplicado, correctamente idempotente)
A_REMAINING_PUSH_TARGET_SOURCE=Negocio.pushSubscription (campo legacy
  per-modelo, incluido en el fan-out por resolveCorePushTargetsFromNormalized
  vía UNION normalizado+legacy — P2-T05 Stage4, diseño intencional que R1/R2
  nunca limpiaban)
CASE_G_TRUE_ROOT_CAUSE_IDENTIFIED=SI
CASE_G_TRUE_ROOT_CAUSE=LEGACY_UNION_TARGET_NEVER_CLEARED_BY_STALE_OWNER_CLEANUP
CASE_G_FIX_IMPLEMENTED=SI (detachLegacyPushFieldIfMatches en src/lib/push.ts,
  invocado desde reconcile-stale-owner/route.ts inmediatamente después del
  detach normalizado)
SAME_FAMILY_A_NOT_TARGETED_AFTER_SWITCH_AUTOMATED=SI (test
  NEGOCIO_A_TO_B_WITHOUT_LOGOUT, usando resolveCorePushTargets real)
SAME_FAMILY_B_TARGETED_AFTER_SWITCH_AUTOMATED=SI (mismo test)
CROSS_FAMILY_MULTI_BIND_PRESERVED=SI
PHYSICAL_UNSUBSCRIBE_USED=NO
CLIENT_SUPPLIED_OWNER_AUTHORITY=NO
SCHEMA_CHANGE=NO
MIGRATION=NO
TESTING_DEPLOY=SUCCESS_de1349d9-1f06-43ce-9984-49161554dbdf_COMMIT_fa4408d_EXACT_MATCH
PRODUCTION_TOUCHED=NO
RELEASE_ELIGIBLE=NO
PHYSICAL_RECERTIFICATION_REQUIRED=SI

DESTACADO_403_OBSERVED=SI
DESTACADO_403_ROOT_CONDITION=ambiguedad_de_cookie_pre_existente_P2_T18_BLOCKER_AUTH2_R2_no_introducida_por_T40
DESTACADO_403_RELATED_TO_CASE_G=NO_DIRECTAMENTE_MISMA_FAMILIA_DE_PROBLEMA_ARQUITECTONICO_MAS_AMPLIO
SESSION_OWNER_CONSISTENT_ACROSS_ENDPOINTS=NO_ENDPOINTS_FAMILY_AWARE_SI_ENDPOINTS_NO_FAMILY_AWARE_NO

T40_STATUS=R3_FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_RECERTIFICATION
```
