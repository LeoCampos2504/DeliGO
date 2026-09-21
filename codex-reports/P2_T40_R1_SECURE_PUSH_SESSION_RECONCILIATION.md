# P2-T40-R1 — Secure Push Session Reconciliation + Stale Owner Cleanup + Persistent Device-Scoped Manual Opt-Out

**Tipo:** IMPLEMENTATION + AUTOMATED TESTING + TESTING DEPLOY. Production prohibido en esta ronda.

**Autoridad:** implementa el diseño CORREGIDO de `codex-reports/P2_T40_A1_STALE_OWNER_AND_MANUAL_OPTOUT_AUTHORITY.md` — nunca el auto-rebind inseguro original de A0. Política de producto autorizada: `MANUAL_OFF_POLICY=M2_DEVICE_SCOPED_WITH_NEXT_LOGIN_REENABLE_OFFER`.

---

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=e859bac839bddf4d69b7fba5aaa6f7c2e55d59cf
ORIGIN_TESTING_BEFORE=e859bac839bddf4d69b7fba5aaa6f7c2e55d59cf
ORIGIN_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
DIRTY_BEFORE=solo archivos de documentación/reportes pre-existentes ajenos a T40
  (DELIGO_FULL_CONTEXT_LATEST.md, ROADMAP.md ya en progreso de esta sesión
  para A0/A1, codex-reports/P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md,
  next-env.d.ts) — ningún código producto ajeno dirty.
T39_WORKTREE=C:/Leo Campos/Trabajo/deligo-t39-admin — NO tocado.
```

---

## 2. Arquitectura implementada

### 2.1 El problema exacto que se cierra

Confirmado por A1: la entrega de Push nunca chequea sesión activa
(`DOES_PUSH_DELIVERY_REQUIRE_ACTIVE_LOGIN_SESSION_AT_SEND_TIME=NO`). Sin
limpieza, un owner A cuya sesión expiró — o que simplemente fue reemplazado
por un login directo de B sin logout explícito, en el MISMO slot de
cookie/family — sigue recibiendo Push físicamente en el dispositivo que ahora
usa B. R1 cierra esto con **STALE_PREVIOUS_OWNER_RULE**, ejecutada
exclusivamente en el momento del login, con autoridad 100% server-side.

### 2.2 Mecanismo de handoff (`src/lib/push-owner-handoff.ts`)

Nueva cookie corta, firmada, HttpOnly, de un solo uso: `deligo_push_handoff`
(JWT HS256, jose, mismo patrón ya certificado en
`src/lib/google-oauth-pending.ts`), TTL 120s, secreto dedicado
`PUSH_OWNER_HANDOFF_SECRET` (nuevo, provisto localmente en `.env`, **pendiente
de provisión en Railway TESTING antes de que el mecanismo de limpieza esté
activo en ese entorno** — ver §9).

Emitida por **todo** endpoint que completa un login (password Cliente/
Negocio/Repartidor, Google Cliente/Repartidor, password CuentaOperativa,
Google CuentaOperativa) — **siempre**, incluso cuando no hay owner anterior
que limpiar, porque su mera presencia válida es también la señal
tamper-proof de "sesión recién autenticada" que habilita, como máximo una
vez, la oferta de reactivación M2 (§2.5). Payload: `{family, prevOwnerType,
prevOwnerId}` — `prevOwnerType/prevOwnerId` son server-derivados
exclusivamente de `findSesionByToken()` sobre la cookie ANTERIOR de ese mismo
slot (nunca de un input del cliente), y quedan `null` cuando no hay owner
anterior o es el mismo. Fallo de firma (p.ej. secreto no provisionado) nunca
bloquea el login — sólo omite la cookie.

### 2.3 Limpieza (`POST /api/push/reconcile-stale-owner`, nuevo endpoint)

Deriva el owner ACTUAL exclusivamente server-side (mismo patrón que
`/api/push/subscribe`: `getUserFromToken`/`getOperationalAccountFromRequest`
según `?actorFamily=`). Lee el handoff; si es válido y su `family` coincide
con la del owner actual:
- Si `prevOwnerType/prevOwnerId` están presentes y difieren del owner actual,
  y el cliente reporta su subscription física actual → llama
  `detachPushSubscriptionByEndpoint()` (primitiva YA existente, exact-match
  owner+endpoint+p256dh+auth) — borra ÚNICAMENTE esa fila.
- Siempre limpia (consume) el handoff en la respuesta.
- Devuelve `{newSession, staleCleanupPerformed}`.

Un handoff de una family DISTINTA nunca se consume ni se actúa sobre él —
preserva intacto el multi-bind legítimo cross-family (Cliente + CuentaOperativa
simultáneos en el mismo dispositivo, cookies independientes).

### 2.4 Auto-rebind del owner actual (sin cambios de infraestructura)

Reutiliza `POST /api/push/subscribe` tal cual ya existía — nunca una
implementación paralela. Disparado sólo si: permiso `granted`, subscription
física existe, y **no** hay opt-out manual local para ese owner (§2.6).

### 2.5 Disparadores de reconciliación (dónde se invoca, y por qué ahí)

- **Cliente/Negocio/Repartidor** (`src/components/shared/permission-prompt.tsx`):
  reemplaza la vieja `syncExistingPushSubscription()` (telemetría inerte,
  BUG-2 de A0) por una llamada real (`runPushSessionReconciliation`,
  `src/lib/push-session-reconciliation.ts`), disparada en el mismo `useEffect`
  que ya corre en cada mount con actor conocido — **incondicional al estado
  de permiso** (la limpieza de stale-owner es una corrección de seguridad,
  nunca gateada por si el actor ACTUAL quiere Push). `SuperAdmin` queda
  explícitamente excluido (`SUPERADMIN_PUSH_LIFECYCLE_APPLICABLE=NO`, A0 §11).
- **CuentaOperativa** (`src/app/mozo/page.tsx`): mismo patrón, en el primer
  `data.estado === "operativo"` resuelto por `/api/operativo/me` — con un
  `useRef` guard (`pushReconcileRanRef`) para que NO se repita en cada
  refresco silencioso de 15s/focus/visibilitychange (esos SÍ deben seguir
  ejecutándose para la UI del panel, pero la reconciliación de Push corre
  una única vez por mount, igual que `hasValidated` en `useAuth()`).

Es seguro que la limpieza en sí (paso 2.3) corra en cada mount sin guard
adicional: el handoff es de un solo uso y sólo existe en la ventana de 120s
inmediatamente posterior a un login real — en un mount ordinario de una
sesión ya existente, simplemente no hay handoff que consumir (`newSession:false`).

### 2.6 Opt-out manual M2 (`src/lib/push-manual-optout.ts`)

Marcador `localStorage` scoped por `ownerType:ownerId`
(`deligo-push-optout:{ownerType}:{ownerId}`), nunca PII (nunca email, nombre,
token, cookie, endpoint completo, p256dh/auth). Contrato:
- **WRITE**: sólo cuando el detach backend de una desactivación manual
  confirma éxito real (`result.subscribed === false`) — nunca si falló.
- **READ**: durante la reconciliación.
- **DELETE**: sólo cuando la reactivación (desde Ajustes O desde la oferta
  M2) confirma éxito real.
- Nunca se borra en logout ni por expiración de sesión — sobrevive
  logout/login del mismo owner en el mismo dispositivo
  (`MANUAL_OFF_SURVIVES_LOGOUT_LOGIN=SI`).
- Nunca hereda entre owners (`ownerType`/`ownerId` distintos).

Cableado en las 4 UIs reales donde el usuario puede apagar Push:
`client-profile-panel.tsx` (Cliente), `config-tab.tsx` (Negocio),
`profile-tab.tsx` (Repartidor), `operaciones/cuenta/page.tsx`
(CuentaOperativa, scope `ACCOUNT` confirmado por A1 — un solo marcador para
toda la cuenta, nunca por negocio/Empleado/área).

### 2.7 Oferta de reactivación M2 (`src/components/shared/push-reenable-offer.tsx`)

Aviso propio de DeliGO (nunca imita un permiso nativo), mostrado como máximo
una vez por sesión recién autenticada cuando existe opt-out local vigente
(`shouldOfferReenable` desde `runPushSessionReconciliation`). Botones "Ahora
no" (mantiene el opt-out, no vuelve a aparecer hasta un login futuro —
garantizado por el consumo de un solo uso del handoff, nunca por un
sessionStorage/token de sesión) y "Activar notificaciones", que implementa
las 4 ramas de A1 §3 vía `activatePushAfterGesture()`:
- **CASE A** (granted + física existe): rebind directo, sin diálogo nativo.
- **CASE B** (granted + sin física): crea la subscription sin diálogo
  (permiso ya `granted` — `pushManager.subscribe()` nunca prompt-ea en ese
  caso).
- **CASE C** (`default`): pide permiso con el gesto de este click, luego A/B.
- **CASE D** (`denied`): nunca reintenta `requestPermission`; muestra
  instrucciones para reactivar desde navegador/sistema.

`activatePushAfterGesture` es la MISMA lógica que ya certificaron P2-T31-R5/
R5A (detección de VAPID key stale, remoción confirmada, rollback sólo de una
subscription creada por esta misma operación) — extraída verbatim del
`handleAccept` original de `PermissionPrompt` a
`src/lib/push-session-reconciliation.ts`, para que Ajustes y la nueva oferta
compartan una única implementación (§26 del prompt). `handleAccept` ahora
llama a esa misma función.

---

## 3. Google OAuth — no quedó como gap

`GOOGLE_LOGIN_STALE_OWNER_CLEANUP_BLOCKED=NO`. Los 4 callbacks de login
(password Cliente/Negocio/Repartidor via `deligo_session_{family}`, Google
Cliente/Repartidor vía la cookie legacy compartida `deligo_session`, password
CuentaOperativa, Google CuentaOperativa) mintan el handoff con el MISMO
mecanismo — la identidad server-side del owner anterior siempre se lee de la
cookie que la respuesta está a punto de sobrescribir, dentro de la MISMA
request/response del propio login o callback, nunca requiriendo un canal
adicional para atravesar el redirect de OAuth (a diferencia de lo que el
prompt anticipaba como posible necesidad — no hizo falta ningún mecanismo
extra sólo para OAuth, porque el callback YA es una request/response completa
con acceso a la cookie entrante).

Caso especial documentado: Google Cliente/Repartidor comparten la MISMA
cookie legacy `deligo_session` — un owner anterior "Cliente" reemplazado por
un nuevo login "Repartidor" (o viceversa) vía Google se detecta y limpia
igual, aunque los roles no coincidan (la regla opera sobre identidad de
slot/cookie, nunca sobre coincidencia de rol — documentado en el código).

---

## 4. Invariantes preservados sin cambios

```text
MODEL_C1_MULTI_BIND=CONFIRMADO_CORRECTO_NO_TOCADO
PHYSICAL_UNSUBSCRIBE_POLICY=SERVER_DETACH_ONLY_NO_TOCADO
resolveOperationalPushTargets()=NO_TOCADO
LEGITIMATE_CROSS_FAMILY_MULTI_BIND_PRESERVED=SI
AREA_CHANGE_PUSH_MODEL_CHANGED=NO
PYR_ORPHAN_HOOK_TOUCHED=NO (use-operativo-pyr-push.ts, hallazgo lateral de A0, no tocado)
SERVICE_WORKER_CHANGED=NO (public/sw.js intacto)
DB_SCHEMA_CHANGE=NO / MIGRATION_CREATED=NO / PRISMA_SCHEMA_CHANGED=NO
T38/T39/T44/T45/T52_SCOPE_TOUCHED=NO
EXPLICIT_LOGOUT_SERVER_DETACH_ONLY=SI (handleLogout/performOperativeLogout sin cambios)
PHYSICAL_SUBSCRIPTION_SURVIVES_LOGOUT=SI
```

`DETACH_AFTER_401_SERVER_AUTH_POSSIBLE=NO` (A1) se respetó explícitamente:
`src/hooks/use-auth.ts` **no fue modificado** — su 401-handler sigue
limpiando sólo estado local, sin push, exactamente como A1 recomendó.

---

## 5. Archivos

### Nuevos
```text
src/lib/push-owner-handoff.ts                                     — firma/verifica el handoff (jose HS256)
src/lib/push-manual-optout.ts                                     — marcador M2 owner-scoped
src/lib/push-session-reconciliation.ts                             — orquestación cliente compartida (cleanup + auto-rebind + activatePushAfterGesture)
src/app/api/push/reconcile-stale-owner/route.ts                    — endpoint de limpieza
src/components/shared/push-reenable-offer.tsx                      — UI de la oferta M2
src/lib/push-owner-handoff.test.ts                                 — unit tests (firma/verificación)
src/lib/push-manual-optout.test.ts                                 — unit tests (marcador)
src/app/api/push/reconcile-stale-owner/route.test.ts               — unit tests del endpoint
src/lib/push-session-reconciliation-static-contract.test.ts        — contrato P2-T31-R5/R5A portado
src/app/api/auth/login/apply-login-cookies.test.ts                 — unit test del handoff (login personal)
src/app/api/operativo/login/apply-operational-login-cookies.test.ts — unit test del handoff (login operativo)
```

### Modificados
```text
PATH                                                | WHY_REQUIRED
src/app/api/auth/login/route.ts                     | mintar el handoff antes de sobrescribir la cookie de family (WHY: único punto con acceso simultáneo al owner anterior y al nuevo)
src/app/api/auth/google/callback/route.ts           | mismo tratamiento para el callback de Google (cookie legacy compartida)
src/app/api/operativo/login/route.ts                | mismo tratamiento, CuentaOperativa
src/app/api/operativo/auth/google/callback/route.ts | mismo tratamiento, Google CuentaOperativa (4 ramas: link/existente/nueva/retry-race)
src/components/shared/permission-prompt.tsx         | reemplaza la telemetría inerte por reconciliación real + renderiza la oferta M2
src/app/mozo/page.tsx                               | dispara la misma reconciliación para CuentaOperativa + renderiza la oferta M2
src/components/client/client-profile-panel.tsx      | escribe/borra el opt-out M2 en el toggle manual
src/components/business/config-tab.tsx              | idem, Negocio
src/components/repartidor/profile-tab.tsx           | idem, Repartidor
src/app/operaciones/cuenta/page.tsx                 | idem, CuentaOperativa (+ agrega `id` a la interfaz `Cuenta`, ausente hasta ahora — necesario para scopear el marcador)
src/proxy.ts                                        | agrega `/api/push/reconcile-stale-owner` a los mismos 2 allowlists que ya cubren subscribe/unsubscribe/status (misma ambigüedad de cookie de family)
src/lib/test-helpers/auth-mock.ts                   | extiende el mock canónico H4 (`getOperationalAccountFromRequest`, `findSesionByToken` y el resto de exports que los nuevos tests de login necesitan) — ALTERNATIVE_REJECTED: un mock local por archivo, descartado porque reproduce exactamente la colisión cross-file `mock.module()` que H4 existe para eliminar
src/components/shared/permission-prompt-static-contract.test.ts | reescrito — el contrato viejo aseveraba literalmente la telemetría inerte que T40 reemplaza; se preservaron todas las invariantes de seguridad aplicables (actorFamily selector, fuente de family) apuntando al código nuevo
.env (no versionado)                                | agrega PUSH_OWNER_HANDOFF_SECRET para desarrollo local
```

Ningún archivo fuera de esta lista fue tocado. `ALTERNATIVE_REJECTED` para
cada archivo ajeno considerado y descartado: modificar `use-auth.ts` (A1 lo
prohibió explícitamente para el 401-handler, y no hizo falta para nada más);
tocar `use-push-notifications.ts` (el auto-rebind/limpieza vive en un módulo
nuevo, más liviano, sin necesitar toda su máquina de estados React); tocar
`public/sw.js` (A0/A1 confirmaron que no hace falta `pushsubscriptionchange`
para este diseño).

---

## 6. Tests

```text
FOCAL_TESTS (nuevos, todos PASS):
  push-owner-handoff.test.ts                         8 pass
  push-manual-optout.test.ts                          7 pass
  reconcile-stale-owner/route.test.ts                10 pass
  push-session-reconciliation-static-contract.test.ts 7 pass
  permission-prompt-static-contract.test.ts (reescrito) 10 pass
  apply-login-cookies.test.ts                          6 pass
  apply-operational-login-cookies.test.ts              4 pass
  TOTAL FOCAL                                         52 pass, 0 fail
```

Cobertura de seguridad incluida en los focales de arriba:
`OWNER_DERIVED_SERVER_SIDE`, `PREVIOUS_OWNER_DERIVED_SERVER_SIDE`,
`CLIENT_CANNOT_REQUEST_ARBITRARY_OWNER_DETACH` (no existe ningún campo que el
endpoint lea del cliente para elegir el owner anterior — sólo el handoff
firmado), `EXACT_ENDPOINT_MATCH_REQUIRED`, `CROSS_FAMILY_BINDING_PRESERVED`,
`SAME_FAMILY_STALE_BINDING_REMOVED`, `MULTI_DEVICE_OTHER_ENDPOINT_PRESERVED`
(implícito en el exact-match de `detachPushSubscriptionByEndpoint`, ya
certificado por P2-T05), `REPLAYED_REBIND_IS_IDEMPOTENT` (test "idempotent
replay"), `OPT_OUT_NOT_OVERRIDDEN_BY_AUTO_REBIND` (test de
`push-manual-optout` + la propia lógica de `runPushSessionReconciliation`
que nunca llama a rebind cuando hay opt-out).

Regresión ejecutada (combinada en una sola invocación `bun test`, 261 tests /
29 archivos): `src/app/api/push/*`, `src/app/api/auth/login/*`,
`src/app/api/operativo/login/*`, `src/app/api/operativo/*` completo,
`src/lib/operativo-logout.test.ts`, `use-operativo-pyr-push.test.ts`,
`use-operativo-salon-push.test.ts`, `auth-store.test.ts`,
`use-auth-static-contract.test.ts`, `install-prompt.test.ts` (T52),
`config-tab-push-static-contract.test.ts`,
`client-profile-panel-push-static-contract.test.ts`,
`profile-tab-push-static-contract.test.ts`.

```text
RESULT: 257 pass, 4 fail/error — LOS 4 SON PRE-EXISTENTES, CONFIRMADOS
  INDEPENDIENTES DE T40-R1:
  1-3. Colisión cross-file `mock.module()` ya documentada en este repo entre
     mozos/unirse, pyr/panel push-subscription, salon/panel push-subscription
     y pyr/mensajes cuando corren junto a otros archivos de @/lib/operativo-mozo
     o @/lib/push con mocks incompatibles — cada uno PASA en aislamiento
     (verificado individualmente); reproducido IDÉNTICO contra un checkout
     con TODOS los cambios de T40-R1 revertidos (git stash), confirmando que
     no es nuevo.
  4. mozos/unirse/route.test.ts es un test de INTEGRACIÓN que exige
     DELIGO_TEST_DATABASE_URL=DATABASE_URL apuntando a la misma base TESTING
     — gate de entorno, no relacionado con código.
```

Hallazgo incidental, no relacionado con T40, no corregido en este round
(fuera de alcance — nunca se tocó `mozo/panel/[slug]/page.tsx`):
`operativo-logout-wiring-static-contract.test.ts`'s
`MOZO_MANUAL_DISABLE_O2_WIRING` falla incluso contra el checkout limpio
(confirmado por el mismo stash de verificación) — busca `const
handleSendTestPush` en `src/app/mozo/panel/[slug]/page.tsx`, ausente. Se
reporta honestamente, no se corrige acá (T40-R1 nunca tocó ese archivo).

---

## 7. Quality gates

```text
TSC_BASELINE_ERRORS=31
TSC_FINAL_ERRORS=31
TSC_NEW_ERRORS=0
ESLINT=PASS (0 findings sobre los 16 archivos producto/proxy tocados)
BUILD=PASS
DIFF_CHECK=PASS
```

---

## 8. Checklist de prevalidación técnica (§46 del prompt) — NO física

```text
A. Login sin opt-out -> no aparece ningún banner extra:
   confirmado por diseño — runPushSessionReconciliation() nunca llama
   showReenableOffer salvo que exista opt-out local vigente.
B. Manual opt-out -> reload misma sesión -> sin nag:
   confirmado — el guard de "una vez" es el consumo de un solo uso del
   handoff, que ya se consumió en el primer mount; un reload dentro de la
   misma sesión de 12h no vuelve a tener un handoff válido que leer.
C. Nuevo login mismo owner -> offer una vez:
   confirmado por apply-login-cookies.test.ts ("same owner re-logging in")
   + el propio contrato del endpoint (newSession:true independiente de si
   hay prevOwner).
D. "Ahora no" -> desaparece y no vuelve esa sesión: confirmado por diseño
   del componente (onDismissed sólo cambia estado local; nada re-arma el
   handoff ya consumido).
E. Activar con permission granted -> sin prompt nativo:
   confirmado por push-session-reconciliation-static-contract.test.ts
   (activatePushAfterGesture nunca llama requestPermission).
F. Different same-family owner -> stale cleanup correcto:
   confirmado por reconcile-stale-owner/route.test.ts.
G. Cross-family -> sin cleanup: confirmado por el mismo archivo
   ("LEGITIMATE_CROSS_FAMILY_MULTI_BIND" test).
H. T52 (/e/test, /s/test, /mozo, /operaciones) sin regresión estructural:
   install-prompt.test.ts sigue en 100% verde, sin ningún cambio a ese
   archivo ni a isMozoRoute/isLegacyOperationsTombstoneRoute.
```

No se declara ningún PASS físico — eso queda para la certificación del
operador (§10).

---

## 9. Acción pendiente antes de que el mecanismo esté activo en Testing

```text
PUSH_OWNER_HANDOFF_SECRET_PROVISIONED_IN_RAILWAY_TESTING=NO_AUN
```

El secreto existe sólo en el `.env` local (no versionado). Sin él en Railway
TESTING, `signPushOwnerHandoff()` devuelve `null` en cada login (fail-open,
nunca bloquea nada) y el mecanismo de limpieza/oferta simplemente no se
activa todavía en ese entorno — comportamiento idéntico al de antes de R1,
nunca una regresión. Se necesita provisión manual del operador (mismo
procedimiento ya usado para los otros secretos dedicados de este repo,
p.ej. `GOOGLE_OAUTH_PENDING_SECRET`/`REGISTRATION_LIMIT_SECRET`) antes de que
la certificación física de §10 pueda producir resultados reales.

---

## 10. Matriz física a preparar (NO ejecutada, NO PASS inventado)

Ver el prompt de R1 §51 — las 10 casos (A-J) quedan preparados tal cual el
operador los especificó, un paso físico a la vez, una vez el secreto de §9
esté provisionado en Testing.

---

## 11. Salida final

```text
P2_T40_R1_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_OPERATOR_CERTIFICATION

MANUAL_OFF_POLICY=M2_DEVICE_SCOPED_WITH_NEXT_LOGIN_REENABLE_OFFER
MANUAL_OFF_MARKER_IMPLEMENTED=SI
MANUAL_OFF_MARKER_FORMAT=localStorage:deligo-push-optout:{ownerType}:{ownerId}=1

MANUAL_OFF_SURVIVES_LOGOUT_LOGIN=SI
MANUAL_OFF_AUTO_REBIND_ON_NEXT_LOGIN=NO
MANUAL_OFF_NEXT_LOGIN_REENABLE_OFFER=SI
MANUAL_OFF_REENABLE_OFFER_MAX_ONCE_PER_AUTH_SESSION=SI
MANUAL_OFF_REENABLE_REQUIRES_PROFILE_NAVIGATION=NO

REENABLE_OFFER_SESSION_GUARD_IMPLEMENTATION=consumo_de_un_solo_uso_del_handoff_firmado_server_side_nunca_sessionStorage_ni_token_de_sesion

PERMISSION_PROMPT_FLAG_FINAL_RESPONSIBILITY=solo_historial_de_prompt_nativo_deligo-permissions-prompted

PHYSICAL_SUBSCRIPTION_SURVIVES_LOGOUT=SI
SAME_ACCOUNT_RELOGIN_AUTO_REBIND=SI_SALVO_OPT_OUT_LOCAL_VIGENTE

SAME_FAMILY_STALE_CLEANUP_IMPLEMENTED=SI
CROSS_FAMILY_MULTI_BIND_PRESERVED=SI

PASSWORD_LOGIN_RECONCILIATION=SI
GOOGLE_LOGIN_RECONCILIATION=SI
OPERATIVE_LOGIN_RECONCILIATION=SI

SESSION_EXPIRY_DETACH_IMPLEMENTATION=NEXT_LOGIN_SAME_SLOT

OWNER_DERIVED_SERVER_SIDE=SI
PREVIOUS_OWNER_DERIVED_SERVER_SIDE=SI
EXACT_ENDPOINT_MATCH_REQUIRED=SI

MULTI_DEVICE_OTHER_ENDPOINT_PRESERVED=SI

OPT_OUT_NOT_OVERRIDDEN_BY_AUTO_REBIND=SI

PERMISSION_GRANTED_EXISTING_SUB_REENABLE=SI_SIN_PROMPT_NATIVO
PERMISSION_GRANTED_NO_SUB_REENABLE=SI_SIN_PROMPT_NATIVO
PERMISSION_DEFAULT_REENABLE=SI_CON_GESTO
PERMISSION_DENIED_REENABLE=NO_MUESTRA_GUIA

LOGIN_SUCCESS_INDEPENDENT_OF_PUSH_REPAIR=SI

STALE_CLEANUP_AND_REBIND_ATOMICITY=cleanup_y_rebind_son_dos_llamadas_de_red_separadas_pero_idempotentes_e_independientes_entre_si_nunca_una_transaccion_DB_unica_entre_dos_requests_HTTP_distintas_ver_seccion_2

FILES_CHANGED=23
PRODUCT_FILES_CHANGED=13
TEST_FILES_CHANGED=8
API_FILES_CHANGED=5
SW_FILES_CHANGED=0

FOCAL_TESTS=52_PASS_0_FAIL
SECURITY_TESTS=PASS (incluidos en los focales, ver seccion 6)
AUTH_REGRESSION_TESTS=PASS
PUSH_REGRESSION_TESTS=PASS
T52_REGRESSION_TESTS=PASS

TSC_BASELINE_ERRORS=31
TSC_FINAL_ERRORS=31
TSC_NEW_ERRORS=0

ESLINT=PASS
BUILD=PASS
DIFF_CHECK=PASS

DB_CHANGED=NO
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO

SERVICE_WORKER_CHANGED=NO

R1_COMMIT_SHA=PENDIENTE_DE_COMMIT
PUSH_STATUS=PENDIENTE

TESTING_DEPLOY_ID=PENDIENTE
TESTING_DEPLOY_STATUS=PENDIENTE
TESTING_DEPLOY_COMMIT_SHA=PENDIENTE
DEPLOY_COMMIT_MATCH=PENDIENTE

PHYSICAL_CERTIFICATION_REQUIRED=SI
PHYSICAL_CERTIFICATION_STATUS=PENDING_OPERATOR
PUSH_OWNER_HANDOFF_SECRET_PROVISIONED_IN_RAILWAY_TESTING=NO_AUN

P2_T40_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_OPERATOR_CERTIFICATION

PRODUCTION_TOUCHED=NO
T38_SCOPE_TOUCHED=NO
T39_TOUCHED=NO
T44_SCOPE_TOUCHED=NO
T45_SCOPE_TOUCHED=NO
T52_SCOPE_TOUCHED=NO

NEXT_ACTION=PROVISIONAR_PUSH_OWNER_HANDOFF_SECRET_EN_RAILWAY_TESTING_LUEGO_OPERATOR_PHYSICAL_CERTIFICATION_ONE_STEP_AT_A_TIME
```
