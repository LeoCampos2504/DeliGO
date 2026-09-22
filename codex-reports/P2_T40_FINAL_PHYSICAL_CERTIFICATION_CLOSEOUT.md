# P2-T40 — Final Physical Certification Closeout

**Tipo:** FINAL EVIDENCE RECONCILIATION + TESTING CERTIFICATION CLOSEOUT + DOCUMENTATION. Production prohibido, no tocado.

---

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
HEAD=3baffe15964242b59d32e37295f62c666524ec87
ORIGIN_TESTING_CODEX=3baffe15964242b59d32e37295f62c666524ec87
ORIGIN_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763 (sin cambios)
```

HEAD es el commit documentation-only `docs: report P2-T40-R3 Testing
deployment verification` (propio de esta sesión, ya reportado). Se
confirmó que el commit funcional de R3
(`fa4408dd855675365b9b0c90f4b75ed34ce0eb6e`) es ancestro directo de HEAD
(`git merge-base --is-ancestor` = true). Ningún código producto ajeno
dirty; sólo los 2 archivos de documentación pre-existentes de siempre
(`DELIGO_FULL_CONTEXT_LATEST.md`, `codex-reports/P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md`).
Worktree T39 no tocado. Sin reset/clean/stash/rebase/force.

---

## 2. Resumen técnico autoritativo R1 → R3

**R1** implementó el diseño corregido de A1: handoff firmado server-derived
de un solo uso, limpieza de stale same-family owner, auto-rebind
silencioso, opt-out manual M2 device-scoped, oferta de reactivación en el
próximo login, contratos de UX para permission denied/default/granted,
reconciliación para CuentaOperativa, preservación de multi-bind
cross-family.

**R2** atribuyó inicialmente CASE G a `PUSH_OWNER_HANDOFF_TTL_SECONDS`
(120s → 600s). La recertificación física posterior **refutó** esa causa
como suficiente (`R2_TTL_ROOT_CAUSE_SUFFICIENT=NO`) — CASE G volvió a
fallar de forma inmediata.

**R3** leyó telemetría de runtime REAL (nunca inferencia) y demostró que
login B detectaba a A, minteaba el handoff correcto, B lo presentaba,
`reconcile-stale-owner` corría, resolvía `currentOwner=B`, y
`detachPushSubscriptionByEndpoint` **sí** borraba exitosamente la fila
normalizada de A. La causa raíz real:
`LEGACY_UNION_TARGET_NEVER_CLEARED_BY_STALE_OWNER_CLEANUP` —
`resolveCorePushTargetsFromNormalized()` (el resolver REAL que usa
`createNotification()` para cada notificación física) hace UNION entre
(1) la tabla normalizada `PushSubscription` y (2) el campo legacy
per-modelo (`Negocio.pushSubscription`, etc., diseño intencional de
P2-T05 Stage4 para compatibilidad multi-dispositivo). R1/R2 sólo limpiaban
(1). R3 implementó `detachLegacyPushFieldIfMatches()` (mismo patrón CAS,
comparación endpoint+p256dh+auth, nunca `expirationTime`) invocado
inmediatamente después del detach normalizado. Resultado automatizado:
`A_NOT_TARGETED_AFTER_SWITCH=PASS`, `B_TARGETED_AFTER_SWITCH=PASS`,
`CROSS_FAMILY_MULTI_BIND_PRESERVED=SI`.

---

## 3. Commit/deploy certificado

```text
R3_COMMIT=fa4408dd855675365b9b0c90f4b75ed34ce0eb6e
R3_TESTING_DEPLOY=de1349d9-1f06-43ce-9984-49161554dbdf (SUCCESS, exact commit match)
PRODUCTION_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763 (sin tocar)
PUSH_OWNER_HANDOFF_SECRET=presente en Testing, nunca impreso ni rotado
```

---

## 4-14. Certificación física final (CASE A–J) — autoritativa, reportada por el operador

**CASE A — PASS.** Negocio, Push ON → logout explícito → login misma
cuenta → sin permiso nativo → Push real llega.

**CASE B — PASS.** Manual OFF, misma sesión, navegación entre secciones →
sin oferta/nag.

**CASE C — PASS.** Manual OFF → logout → login misma cuenta → aparece la
oferta de reactivación M2.

**CASE D — PASS.** "Ahora no" → desaparece → no reaparece en la misma
sesión.

**CASE E — PASS.** Tras "Ahora no", nuevo login futuro → la oferta vuelve
a aparecer.

**CASE F — PASS.** "Activar notificaciones" con permiso ya granted →
reactivación directa, sin permiso nativo, Push real llega.

**CASE G — PASS FINAL (post-R3).** Negocio A sin logout → login real de
Negocio B → sesión final B → Push de B llega → **Push de A NO llega.**
`CROSS_ACCOUNT_PUSH_LEAK=RESOLVED_PHYSICALLY`,
`SAME_FAMILY_NEGOCIO_A_TO_B=PASS`. Este era el gate físico bloqueante de
R1/R2, ahora cerrado.

**CASE H — PARTIAL PASS (clasificación explícita, nunca "full PASS")**:
- Cliente + CuentaOperativa cross-family: Cliente activo, sin cerrar
  sesión se inicia CuentaOperativa en otra pestaña de la misma PC — Push
  de Cliente sigue llegando. `CASE_H_CLIENT_BINDING_PRESERVED=PASS`,
  `CROSS_FAMILY_CLIENT_BINDING_SURVIVES_OPERATIVE_LOGIN=PASS`.
- Lado operativo: UI CuentaOperativa mostró "Activadas" pero la
  notificación operativa no llegó. Esto es una superficie YA conocida y
  ya registrada bajo P2-T44 (Operaciones Personal Push UX + PyR
  Coverage) — T40 es lifecycle de sesión/re-enrollment/stale-binding, T44
  es qué producers/avisos existen realmente para CuentaOperativa y sus
  áreas. `CASE_H_OPERATIVE_SIDE=CONDITIONAL_NOT_AVAILABLE_DUE_TO_T44_PUSH_COVERAGE`,
  `CASE_H_T40_BLOCKER=NO`.

**CASE I — PASS.** `Notification.permission` cambiado manualmente a
`denied` → recarga → sin re-prompt nativo, UI muestra "Apagadas",
instrucciones de reactivación manual. Al reactivar el permiso desde el
navegador, la UI DeliGO permaneció "Apagadas" hasta acción explícita; al
pulsar "Activar notificaciones" se activó directamente sin nuevo permiso
nativo. `DENIED_NO_NATIVE_REPROMPT=PASS`, `DENIED_MANUAL_GUIDANCE=PASS`,
`REENABLE_AFTER_BROWSER_PERMISSION_GRANTED=PASS`.

**CASE J — CONDITIONALLY NOT PHYSICALLY VERIFIABLE (nunca PASS total, nunca
FAIL)**: CuentaOperativa A sin logout → login real de CuentaOperativa B
(nueva, nunca había activado Push manualmente) → UI mostró "Activadas"
tras el login — **esto es el comportamiento ESPERADO del contrato de T40**
(permiso granted + subscription física existente + owner autenticado B +
sin opt-out manual de B = auto-rebind silencioso; nunca una herencia
indebida de A). Al intentar generar Push para B, no llegó — mismo
problema de delivery operativo que en H (P2-T44), por lo que NO existe
una señal física válida en esta PC para comprobar "B recibe / A no
recibe" mediante un producer operativo real.
`CASE_J_B_DELIVERY=CONDITIONAL_NOT_AVAILABLE_DUE_TO_T44_PUSH_COVERAGE`,
`CASE_J_CROSS_ACCOUNT_LEAK=NOT_PHYSICALLY_VERIFIABLE_WITH_CURRENT_OPERATIVE_PUSH_PRODUCER`,
`CASE_J_T40_FAIL=NO`. La propiedad de seguridad/lifecycle correspondiente
(`SAME_FAMILY_CUENTA_OPERATIVA_A_TO_B`) queda soportada por el nuevo test
automatizado agregado en este mismo closeout (ver §6) — la entrega Push
funcional de CuentaOperativa en sí permanece bajo P2-T44.

---

## 15. Distinción T40 vs T44

T40 = ciclo de vida de sesión/login, limpieza de bindings stale entre
cambios de cuenta, opt-out manual, oferta de reactivación — todo lo cual
quedó demostrado físicamente PASS (CASE A-G, I) o correctamente acotado
(CASE H/J, donde la mitad "delivery operativo real" es una superficie
distinta). T44 = qué eventos/avisos Push existen y su cobertura/UX real
para CuentaOperativa y sus áreas (Mozo/Salón/PyR) — la ausencia de
delivery operativo observada en H/J es una superficie de T44, no de T40,
y no se corrige en este closeout.

---

## 16. Hallazgo separado — `/api/destacado-solicitud` 403

Confirmado por R3: ambigüedad PRE-EXISTENTE de selección de cookie/sesión
(P2-T18-BLOCKER-AUTH2-R2) en endpoints que no derivan family de su propio
path ni usan el selector `?actorFamily=` explícito de `src/proxy.ts`. Los
endpoints family-aware de T40 (`/api/push/reconcile-stale-owner`, que sí
usa el selector) resolvieron correctamente a B en los logs reales.
`/api/destacado-solicitud` no es family-aware y puede caer al fallback
ambiguo si el navegador de certificación acumuló más de una cookie
candidata (family + legacy residual) a través de las muchas rondas de
prueba de esta sesión.

```text
DESTACADO_403_OBSERVED=SI
DESTACADO_403_T40_BLOCKER=NO
DESTACADO_403_OWNER_TASK=P2-T18-BLOCKER-AUTH2-R2 (arquitectura de
  selección de cookie de family — autoridad ya existente, ver
  src/proxy.ts SELECTOR_ENDPOINT_PREFIXES/ROLE_PROTECTED_ROUTES)
```

No se corrige código en este closeout. No se reabre T40 por este
hallazgo — queda enlazado a su autoridad correcta ya existente para una
decisión futura del operador (posible extensión de
`SELECTOR_ENDPOINT_PREFIXES`/`ROLE_PROTECTED_ROUTES` a más rutas).

---

## 17. Nota técnica — doble reconcile (R3)

Los logs reales de R3 mostraron que la reconciliación de B corrió dos
veces en ~1.1 segundos (primer intento: `detached=true`; segundo intento,
idempotente: `detached=false`, nada que borrar). No causó fuga ni
corrupción — el diseño de detach exact-match ya es naturalmente
idempotente.

```text
DOUBLE_RECONCILE_OBSERVED=SI
DOUBLE_RECONCILE_CAUSED_SECURITY_FAILURE=NO
IDEMPOTENT_SECOND_DETACH=SI
```

No existe deuda/owner autoritativo previo para esto — se registra como
nota técnica futura de robustez (posible causa: doble-disparo del efecto
de `PermissionPrompt`, StrictMode-like o dos renders con dependencias
cambiando en sucesión rápida), sin prioridad artificial asignada. **No se
implementa ningún fix en este closeout.**

---

## 18. Evidencia de test automatizado

Se auditó la cobertura existente antes de agregar nada:
`SAME_FAMILY_NEGOCIO_A_TO_B` y `CROSS_FAMILY_CLIENTE_PLUS_CUENTA_OPERATIVA`
ya estaban cubiertos (`case-g-same-family-account-switch.test.ts`'s
`NEGOCIO_A_TO_B_WITHOUT_LOGOUT`, y
`reconcile-stale-owner/route.test.ts`'s `LEGITIMATE_CROSS_FAMILY_MULTI_BIND`,
respectivamente) — se reportan, no se duplican.

**Gap confirmado**: ningún test existente exercitaba
`SAME_FAMILY_CUENTA_OPERATIVA_A_TO_B` específicamente (CuentaOperativa A
→ CuentaOperativa B, mismo slot de sesión operativa, sin logout). Se
agregó exactamente UN test focal nuevo,
`src/app/api/push/reconcile-stale-owner/cuenta-operativa-same-family-account-switch.test.ts`
(4 casos), encadenando las funciones REALES ya existentes
(`applyOperationalLoginCookies` de `operativo/login/route.ts`, el handler
`POST` real de `reconcile-stale-owner/route.ts`) — **cero cambio de
código producto**. Prueba: A/X deja de ser binding tras el switch, B/X
puede existir, un binding Cliente cross-family en el mismo endpoint
sobrevive intacto, y un re-login del mismo owner nunca se auto-limpia a
sí mismo.

```text
FOCAL_PASS=271 (267 pre-existentes de T40 + 4 nuevos de este closeout)
FOCAL_FAIL=0
REGRESSION_PASS=267 (271 tests totales, 31 archivos)
REGRESSION_FAIL=4 (los mismos pre-existentes ya confirmados independientes
  de T40 en rondas anteriores — colisión cross-file mock.module() entre
  mozos/unirse + pyr/salon push-subscription + pyr/mensajes, más el gate
  de integración DELIGO_TEST_DATABASE_URL de mozos/unirse)
TSC_BASELINE_ERRORS=31
TSC_FINAL_ERRORS=31
TSC_NEW_ERRORS=0
ESLINT=PASS
DIFF_CHECK=PASS
```

(No se re-ejecutó `bun run build` completo en este closeout —
documentation-only + un test focal nuevo, sin cambio de código producto;
`tsc`/`eslint`/`diff-check` ya cubren la única superficie tocada.)

---

## 19. Estado Production

```text
PRODUCTION_TOUCHED=NO
PRODUCTION_PROMOTION_PERFORMED=NO
```

Este closeout NO autoriza ni ejecuta ninguna promoción. `main` permanece
exactamente en `ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`.

---

## 20. Estado final

```text
T40_R3_PHYSICAL_CASE_G=PASS
CROSS_ACCOUNT_PUSH_LEAK_RESOLVED=SI

CASE_A=PASS
CASE_B=PASS
CASE_C=PASS
CASE_D=PASS
CASE_E=PASS
CASE_F=PASS
CASE_G=PASS

CASE_H=PASS_FOR_T40_CROSS_FAMILY_PRESERVATION_WITH_OPERATIVE_DELIVERY_CONDITIONAL_UNAVAILABLE
CASE_H_CLIENT_BINDING_PRESERVED=PASS
CASE_H_OPERATIVE_DELIVERY=CONDITIONAL_NOT_AVAILABLE_T44
CASE_H_T40_BLOCKER=NO

CASE_I=PASS

CASE_J=CONDITIONAL_NOT_AVAILABLE_PHYSICALLY_T44_COVERAGE_AUTOMATED_T40_SECURITY_COVERAGE_PRESERVED
CASE_J_B_DELIVERY=CONDITIONAL_NOT_AVAILABLE_T44
CASE_J_CROSS_ACCOUNT_PHYSICAL_VERIFICATION=NOT_AVAILABLE
CASE_J_T40_FAIL=NO

OPERATIVE_AUTO_REBIND_NEW_ACCOUNT_BEHAVIOR=EXPECTED
OPERATIVE_AUTO_REBIND_REQUIRES_PERMISSION_GRANTED=SI
OPERATIVE_AUTO_REBIND_REQUIRES_PHYSICAL_SUBSCRIPTION=SI
OPERATIVE_AUTO_REBIND_RESPECTS_MANUAL_OPTOUT=SI

SAME_FAMILY_NEGOCIO_A_TO_B_PHYSICAL=PASS
SAME_FAMILY_CUENTA_OPERATIVA_A_TO_B_AUTOMATED=PASS (nuevo test focal
  agregado en este closeout, cero cambio de código producto)
CROSS_FAMILY_CLIENT_PLUS_OPERATIVE_PHYSICAL=PASS

MANUAL_OPTOUT=PASS
FUTURE_LOGIN_REENABLE_OFFER=PASS
DENIED_UX=PASS
NO_NATIVE_REPROMPT=PASS

MODEL_C1_MULTI_BIND_PRESERVED=SI
PHYSICAL_UNSUBSCRIBE_USED=NO
CLIENT_SUPPLIED_OWNER_AUTHORITY=NO

DESTACADO_403_OBSERVED=SI
DESTACADO_403_T40_BLOCKER=NO
DESTACADO_403_OWNER_TASK=P2-T18-BLOCKER-AUTH2-R2

DOUBLE_RECONCILE_OBSERVED=SI
DOUBLE_RECONCILE_SECURITY_IMPACT=NO

SCHEMA_CHANGE=NO
MIGRATION=NO

R3_COMMIT=fa4408dd855675365b9b0c90f4b75ed34ce0eb6e
R3_TESTING_DEPLOY=de1349d9-1f06-43ce-9984-49161554dbdf

PRODUCTION_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_TOUCHED=NO
PRODUCTION_PROMOTION_PERFORMED=NO

T40_TESTING_CERTIFIED=SI
RELEASE_ELIGIBLE_T40=YES_FUTURE_CURATED_PROMOTION_ONLY

P2_T40_STATUS=CLOSED_TESTING_CERTIFIED
```
