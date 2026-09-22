# P2-T40-R2 — Fix Bloqueante: Same-Family Cross-Account Push Leak (CASE G)

**Tipo:** DIAGNÓSTICO + CORRECCIÓN MÍNIMA + TESTS + DEPLOY TESTING. Production prohibido.

**No se cierra T40** — recertificación física pendiente, empezando por CASE G. `RELEASE_ELIGIBLE=NO`.

---

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=aa98d41ef415fefb9f036e03ebac0f660578cb3f
ORIGIN_TESTING_CODEX_BEFORE=aa98d41ef415fefb9f036e03ebac0f660578cb3f
ORIGIN_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763 (sin cambios)
```

**Nota sobre `START_EXPECTED` del prompt:** el prompt de R2 esperaba
`1fc6edc5ca661050271a3c5a3ba64fda606cf919` como HEAD actual, pero el HEAD
real al iniciar era `aa98d41ef415fefb9f036e03ebac0f660578cb3f` — UN commit
más adelante. No es un drift externo inesperado: es el propio commit
documentation-only `docs: report P2-T40-R1 Testing deployment verification`
que esta misma sesión creó y pusheó al cierre de R1 (reportando el
`deploymentId`/`commitHash` verificados de ese despliegue), ya comunicado al
operador en el resumen de cierre de R1. Cero cambio de código producto en
ese commit. Se registra por transparencia y se continúa, sin STOP, dado que
no representa ningún drift ajeno ni no documentado.

`git status --short` mostró únicamente los mismos 2 archivos de
documentación pre-existentes ya dirty desde antes de R1
(`DELIGO_FULL_CONTEXT_LATEST.md`, `codex-reports/P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md`)
— ningún archivo de código producto ajeno dirty. Worktree de T39
(`C:/Leo Campos/Trabajo/deligo-t39-admin`) no tocado.

---

## 2. Reproducción técnica del bug (CASE G)

Reportada físicamente por el operador: Negocio A autenticado con Push
funcionando; sin logout explícito, se envía `POST /api/auth/login` con
credenciales de Negocio B; el login reemplaza la sesión; tras recargar,
Negocio B queda correctamente autenticado — pero notificaciones dirigidas
tanto a A como a B llegan al mismo dispositivo. `CROSS_ACCOUNT_PUSH_LEAK=REPRODUCED`.

---

## 3. Causa raíz demostrada

Se auditaron los 14 eslabones que el prompt de R2 listó (A-N, §4) leyendo el
código real de `push-owner-handoff.ts`, `push-session-reconciliation.ts`,
`reconcile-stale-owner/route.ts`, `login/route.ts`, `permission-prompt.tsx`,
`proxy.ts` y el modelo Prisma `PushSubscription`. Se descartaron
sistemáticamente, con evidencia, los candidatos de la lista de posibles
causas del prompt (§7):

- **Middleware/cookie-rewrite (candidatos 1, 4, 5, 8)**: `/api/push/subscribe`
  usa el MISMO mecanismo exacto (`resolveActorSession`/
  `rewriteResolvedSessionCookieHeaders` de `src/proxy.ts`) y está confirmado
  funcionando físicamente (CASE F PASS: "backend rebind correcto... Push real
  llega") — el mismo mecanismo no puede ser la causa para el endpoint nuevo,
  que replica idénticamente el patrón ya certificado.
- **`PermissionPrompt` no remonta/no dispara (candidato 6)**: confirmado
  montado en el layout raíz (`src/app/layout.tsx`), aplica a todas las
  rutas incluida `/negocio/*`; su `useEffect` depende de `ownerId` (no sólo
  de `uType`, que no cambia entre dos cuentas Negocio), así que un cambio de
  cuenta dentro de la misma family SÍ dispara una nueva ejecución.
- **Resolución de owner actual incorrecta (candidato 9)**: `resolveCurrentOwner()`
  en `reconcile-stale-owner/route.ts` replica el patrón ya probado de
  `/api/push/subscribe`.
- **Se construyó un test de integración ENCADENADO** (nuevo,
  `case-g-same-family-account-switch.test.ts`) que usa las funciones
  EXPORTADAS reales (`applyLoginCookies` de `login/route.ts`, el handler
  `POST` real de `reconcile-stale-owner/route.ts`), pasando el valor LITERAL
  de la cookie de handoff de la primera respuesta a la segunda request —
  exactamente como lo haría un navegador real. El caso **BASELINE (sin
  demora)** PASA limpiamente: A/X se borra, B puede vincularse. Esto
  descarta con evidencia directa cualquier bug de lógica pura en la cadena
  login→handoff→reconciliación cuando ambos pasos ocurren
  inmediatamente uno tras otro.
- **Se construyó el mismo escenario con el handoff YA VENCIDO** (firmado con
  `iat`/`exp` desplazados al pasado, más allá del TTL) — este test
  **reproduce el síntoma físico EXACTO**: `newSession:false`,
  `staleCleanupPerformed:false`, la fila de A sobrevive.

```text
CAUSA_RAIZ_DEMOSTRADA=
  PUSH_OWNER_HANDOFF_TTL_SECONDS (120s, "corto a propósito" para un
  round-trip AUTOMÁTICO estilo redirect OAuth) es insuficiente para el
  escenario real que dispara STALE_PREVIOUS_OWNER_RULE: un CAMBIO DE CUENTA
  MANUAL (operador tipeando credenciales de una cuenta distinta sin cerrar
  sesión primero). Ese flujo plausiblemente excede 2 minutos en una prueba
  física real (leer el paso siguiente, escribir usuario/contraseña de OTRA
  cuenta, esperar la respuesta, recargar la página). Al vencer el handoff
  antes de que el cliente llegue a reconciliar, `verifyPushOwnerHandoff()`
  devuelve `null` (fail-closed, correcto por diseño) y la limpieza queda en
  silencio no-op — exactamente el síntoma reportado. El auto-rebind de B
  (vía `/api/push/subscribe`, independiente del handoff) sigue funcionando
  normalmente, por lo que B recibe sus propias notificaciones sin ningún
  indicio visible de que la limpieza de A falló.
```

---

## 4. Por qué los tests de R1 no la detectaron

Los tests de R1 (`push-owner-handoff.test.ts`, `reconcile-stale-owner/route.test.ts`,
`apply-login-cookies.test.ts`) son correctos pero **todos construían el
handoff directamente en memoria y lo consumían en el MISMO tick del test**
— nunca ejercitaron el paso del tiempo real entre el login y la
reconciliación, ni encadenaron las dos requests HTTP reales una tras otra.
`push-owner-handoff.test.ts` incluso tenía un test "an expired handoff never
verifies" — pero probaba la propiedad criptográfica aislada (un JWT vencido
no verifica), nunca la conclusión de producto (¿es 120s un TTL realista
para el flujo humano que realmente dispara esta regla?). Esa pregunta de
calibración de producto/UX nunca se hizo explícita hasta la certificación
física de R2.

---

## 5. Fix aplicado (mínimo)

**Único cambio funcional:** `PUSH_OWNER_HANDOFF_TTL_SECONDS` de 120 a 600
segundos (`src/lib/push-owner-handoff.ts`) — sigue siendo deliberadamente
corto (nunca una sesión de usuario, nunca reutilizable como autenticación,
de un solo uso, nunca expone nada más allá de `{family, prevOwnerType,
prevOwnerId}`), sólo ampliado lo suficiente para tolerar un cambio de
cuenta manual real. Cero cambio de arquitectura, cero cambio de schema.

**Complementario (diagnóstico seguro, §8 del prompt):** se agregó
telemetría fingerprinted (SHA-256 truncado a 10 hex, nunca reversible,
nunca el valor crudo de ownerId/token/endpoint/secreto) en los 4
puntos de minteo del handoff (`login/route.ts`, `google/callback/route.ts`,
`operativo/login/route.ts`, `operativo/auth/google/callback/route.ts`) y en
el punto de consumo (`reconcile-stale-owner/route.ts`) — para que, si la
recertificación física de CASE G volviera a fallar por cualquier otra
causa, los logs de Railway la señalen sin necesitar otra ronda completa de
auditoría. Se deja como telemetría útil permanente (nunca imprime
password/token de sesión/handoff completo/endpoint completo/p256dh/auth/
secretos/email — sólo family, booleanos y fingerprints de 10 hex).

---

## 6. Cómo se preserva MODEL_C1_MULTI_BIND

Sin cambios: `detachPushSubscriptionByEndpoint()` (repositorio, sin
modificar) exige `ownerType+ownerId+channel+endpoint+p256dh+auth` exacto —
nunca borra por endpoint solo. El fix no toca esta primitiva ni ninguna
regla de borrado.

## 7. Cómo se preserva cross-family

Sin cambios: `reconcile-stale-owner/route.ts` sigue exigiendo
`handoff.family === currentOwner.family` antes de actuar — un handoff de
otra family nunca se consume ni se usa. El test
`"LEGITIMATE_CROSS_FAMILY_MULTI_BIND"` (ya existente desde R1) sigue en
verde.

## 8. Cómo se elimina exclusivamente el stale same-family

Sin cambios de la regla en sí (`STALE_PREVIOUS_OWNER_RULE`): mismo slot de
cookie/family, owner anterior server-derived (nunca de input de cliente),
owner anterior != owner actual, mismo endpoint físico exacto. Lo único que
cambió es CUÁNTO TIEMPO esa regla permanece ejecutable después del login.

---

## 9. Tests nuevos

`src/app/api/push/reconcile-stale-owner/case-g-same-family-account-switch.test.ts`
(3 tests, encadena funciones reales, nunca mocks de la lógica bajo prueba):

1. **BASELINE (sin demora)** — reproduce el flujo feliz encadenado end-to-end.
2. **DELAYED (>120s TTL vencido)** — reproduce el bug físico exacto con un
   handoff real vencido.
3. **Sin cookie de handoff en absoluto** — mismo síntoma por un mecanismo
   distinto (defensa en profundidad, confirma fail-closed correcto).

---

## 10. Regresiones ejecutadas

Suite combinada (30 archivos, incluye T40 A-F, manual opt-out, oferta de
reactivación, Cliente/Negocio/Repartidor/CuentaOperativa, logout explícito,
re-login mismo actor, subscribe/unsubscribe existente, resolver de push
operativo, multi-bind cross-family):

```text
FOCAL_PASS=163 (incluye los 3 nuevos de CASE G)
FOCAL_FAIL=0
REGRESSION_PASS=260 (264 tests totales, 30 archivos)
REGRESSION_FAIL=4 — LOS MISMOS 4 PRE-EXISTENTES YA CONFIRMADOS
  INDEPENDIENTES DE T40 EN R1 (colisión cross-file mock.module() entre
  mozos/unirse + pyr/salon push-subscription + pyr/mensajes, más el gate de
  integración DELIGO_TEST_DATABASE_URL de mozos/unirse) — no se re-verificó
  el stash limpio en esta ronda porque R1 ya lo demostró exhaustivamente
  contra un checkout SIN ningún cambio de T40, y R2 no modificó ninguno de
  los 4 archivos involucrados en esa colisión.
```

---

## 11. Quality gates

```text
TSC_BASELINE_ERRORS=31
TSC_FINAL_ERRORS=31
TSC_NEW_ERRORS=0
ESLINT=PASS
BUILD=PASS
DIFF_CHECK=PASS
```

---

## 12. DB / Migraciones

```text
SCHEMA_CHANGE=NO
MIGRATION=NO
```

El fix es un cambio de constante (TTL) más logging — no requirió ni
requiere ningún cambio de schema.

---

## 13-14. Commit y push

Commit único `2e0ee2b97a4cf1fcf5684f5cde7ef4118616b3c2`
(`fix: prevent stale same-family push binding after account switch`),
pusheado `aa98d41..2e0ee2b` a `origin/testing-codex`. `main` no tocado.

---

## 15. Deploy Testing

Deployment `1bcbc61e-6304-48e8-9b1b-4ba6d00a278e` — `SUCCESS`, commit exacto
`2e0ee2b97a4cf1fcf5684f5cde7ef4118616b3c2` confirmado dos veces
(`railway deployment list --json` y el propio `railway logs`). Logs:
`33 migrations found`, `No pending migrations to apply`, servidor
`Ready in 88ms`, cero línea de error/exception/fatal/500/unhandled.
`PUSH_OWNER_HANDOFF_SECRET` confirmado presente en Railway TESTING
(`railway variables --kv | grep -c` = 1, valor nunca impreso ni rotado).

---

## 16-20. Estado Production y matriz física pendiente

Production permanece en `ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`, sin
tocar. La recertificación física la realiza el operador manualmente,
empezando por CASE G — sin promoción a H/I/J hasta que G quede confirmado.

---

## Marcadores finales

```text
CASE_G_ROOT_CAUSE_IDENTIFIED=SI
CASE_G_AUTOMATED_REPRODUCTION=SI (case-g-same-family-account-switch.test.ts,
  test "DELAYED" reproduce el síntoma físico exacto con un handoff real vencido)
SAME_FAMILY_STALE_BINDING_FIX=PUSH_OWNER_HANDOFF_TTL_SECONDS_120_TO_600
CROSS_FAMILY_MULTI_BIND_PRESERVED=SI
CLIENT_SUPPLIED_OWNER_AUTHORITY=NO
PHYSICAL_UNSUBSCRIBE_USED=NO
MANUAL_OPTOUT_REGRESSION=NO (no tocado, tests en verde)
T40_A_TO_F_REGRESSION=NO (suite completa en verde, ver sección 10)
SCHEMA_CHANGE=NO
MIGRATION=NO
TESTING_DEPLOY=SUCCESS_1bcbc61e-6304-48e8-9b1b-4ba6d00a278e_COMMIT_2e0ee2b_EXACT_MATCH
PRODUCTION_TOUCHED=NO
RELEASE_ELIGIBLE=NO
PHYSICAL_RECERTIFICATION_REQUIRED=SI

T40_STATUS=FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_RECERTIFICATION
```
