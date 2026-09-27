# P2-T34 — Android session isolation — Physical reproduction preparation

Fecha: 2026-09-26  
Modo: `PHYSICAL_REPRODUCTION_AND_DIAGNOSIS_ONLY`; el operador ejecutó los Casos A y B y reportó sus resultados. Codex no controló el dispositivo.

```text
P2_T34_PREFLIGHT_GATE=PASS
P2_T34_SOURCE_FINDING=F-P2-T31-R23B-01
P2_T34_ROOT_CAUSE_CONFIRMED=NO
ORIGIN_TESTING_CODEX=82ee16a27e71cd4d438c81f7953a4956a563389d
ORIGIN_MAIN=42ca5005d2ecd412de87e454b52820f38aaec5c0
TESTING_DEPLOYMENT_VERIFICATION=PASS_EXACT_BASELINE_COMMIT
TESTING_DELIGO_COPY_STATUS=SUCCESS
TESTING_CHAT_STATUS=SUCCESS
TESTING_DEPLOYMENT_COMMIT=82ee16a27e71cd4d438c81f7953a4956a563389d
ANDROID_VERSION=NOT_REPORTED
CHROME_VERSION=NOT_REPORTED
PHYSICAL_REPRO_STARTED=YES
CASE_A=PASS
CASE_B=FAIL
CASE_C=NOT_RUN_AFTER_FAIL
CASE_D=NOT_RUN_AFTER_FAIL
CASE_E=NOT_RUN_AFTER_FAIL
CASE_F=NOT_RUN_AFTER_FAIL
CASE_G=NOT_RUN_AFTER_FAIL
CASE_H=NOT_RUN_AFTER_FAIL
FAILED_CASE=B
HISTORICAL_ANDROID_FAIL_REPRODUCED=YES
ROOT_CAUSE_LAYER=UNCONFIRMED
PRODUCTION_TOUCHED=NO
NEXT_ACTION=OPERATOR_PROVIDE_CASE_B_DIAGNOSTIC_SNAPSHOT
```

## Adenda R4 — recertificación física post-fix

La evidencia histórica anterior permanece intacta (`CASE_B_HISTORICAL=FAIL`). El operador repitió la secuencia relevante después del fix R3 en Android real, Chrome normal, mismo perfil, sin incógnito ni cambio de perfil. Ambas sesiones comenzaron cerradas. Cliente Google OAuth inició en `/cliente/`; Repartidor Google OAuth inició en `/repartidor` en una segunda pestaña. Al volver y recargar Cliente, éste siguió autenticado como Cliente, no apareció el aviso de rol incorrecto y Repartidor siguió autenticado. No se informó timestamp ni versión de Android/Chrome.

```text
CASE_A_POST_FIX=PASS
CASE_B_POST_FIX=PASS
CLIENT_GOOGLE_ROUTE=/cliente/
DRIVER_GOOGLE_ROUTE=/repartidor
CLIENT_BEFORE_RELOAD=PASS
CLIENT_AFTER_RELOAD=PASS
DRIVER_AFTER_CLIENT_RELOAD=PASS
WRONG_ROLE_NOTICE_POST_FIX=NO
CLIENT_DRIVER_CONCURRENT_GOOGLE_SESSION=PASS
HISTORICAL_CASE_B=FAIL
FAILURE_NOT_REPRODUCED_AFTER_FIX=SI
P2_T34_R4_PHYSICAL_RECERTIFICATION_GATE=PASS
P2_T34_STATUS=CLOSED_TESTING_CERTIFIED
PRODUCTION_TOUCHED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_NEXT_TASK_DECISION
```

La aceptación A/B coincide con R2/R3; C–H no son condición documentada de cierre y no se ejecutaron. Ver [P2_T34_R4_PHYSICAL_RECERTIFICATION_CLOSEOUT.md](P2_T34_R4_PHYSICAL_RECERTIFICATION_CLOSEOUT.md).

## Adenda R3 — método OAuth confirmado y reparación desplegada

La evidencia posterior del operador confirmó que **ambos** logins del Caso B
fueron Google OAuth (`CASE_B_LOGIN_METHOD=GOOGLE_OAUTH_BOTH`). Esto confirma
para esta reproducción la cadena que R1 no podía atribuir con los datos de
entonces: el callback Google escribía la sesión Cliente y luego la Repartidor
en `deligo_session`; al recargar `/cliente`, el fallback legacy del proxy
podía entregar el token Repartidor a `/api/auth/me?actorFamily=cliente`.

P2-T34-R3 migró las emisiones Google OAuth de Cliente/Repartidor a sus cookies
familiares, incluida la finalización posterior al consentimiento legal, y se
desplegó en TESTING como commit `38ac6d398fb1bdead11913a347c81162eb260666`.
El Caso B histórico sigue siendo `FAIL` hasta que el operador repita A y B
físicamente sobre este deployment. No se ejecutaron A/B ni C–H en este cierre.

```text
CASE_A_HISTORICAL=PASS
CASE_B_HISTORICAL=FAIL
CASE_B_LOGIN_METHOD=GOOGLE_OAUTH_BOTH
ROOT_CAUSE_CONFIRMED=SI
ROOT_CAUSE_LAYER=GOOGLE_OAUTH_LEGACY_SESSION_COOKIE
P2_T34_R3_TECHNICAL_GATE=PASS
TESTING_DEPLOY=SUCCESS
PHYSICAL_RECERTIFICATION_REQUIRED=SI
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_CASE_A_B_GOOGLE_OAUTH_RECERTIFICATION
```

Detalle técnico, pruebas, build, logs y límites en
[P2_T34_R3_GOOGLE_OAUTH_FAMILY_SESSION_FIX.md](P2_T34_R3_GOOGLE_OAUTH_FAMILY_SESSION_FIX.md).

## Adenda R2 — auditoría histórica

La auditoría de commits, blame, cookies legacy, auth/me, store, T02-B1 y cobertura histórica quedó registrada en [P2_T34_R2_HISTORICAL_SESSION_ISOLATION_REGRESSION_AUDIT.md](P2_T34_R2_HISTORICAL_SESSION_ISOLATION_REGRESSION_AUDIT.md). Clasifica el alcance histórico como incompleto para las rutas OAuth y la combinación Cliente/Repartidor en Android; el método de login del Caso B no fue consignado, así que el candidato de alias legacy no se declara causa runtime confirmada. Esta adenda sustituye la propuesta R1 de pedir una captura manual: R2 no solicita DevTools ni nuevas pruebas físicas y deja como siguiente paso solicitar autorización para instrumentación temporal segura en TESTING. No se cambia el resultado físico de A/B ni se reanudan C–H.

## Baseline and deployment verification

Se volvió a ejecutar `git fetch origin --prune` desde el worktree limpio de T38. Valores observados:

```text
ORIGIN_TESTING_CODEX=82ee16a27e71cd4d438c81f7953a4956a563389d
ORIGIN_MAIN=42ca5005d2ecd412de87e454b52820f38aaec5c0
T38_WORKTREE_HEAD=82ee16a27e71cd4d438c81f7953a4956a563389d
T38_WORKTREE_STATUS=CLEAN
```

Se consultó únicamente metadata de estado con `railway status --json` y se filtró localmente el ambiente TESTING; no se consultaron variables de entorno, logs de app, DB ni secretos. Estado de los servicios que ejecutan la aplicación:

| Ambiente | Servicio | Estado | Commit desplegado | Rama | Creado (UTC) |
|---|---|---|---|---|---|
| TESTING | DeliGO Copy | `SUCCESS` | `82ee16a27e71cd4d438c81f7953a4956a563389d` | `testing-codex` | `2026-09-26 18:16:20` |
| TESTING | chat en vivo | `SUCCESS` | `82ee16a27e71cd4d438c81f7953a4956a563389d` | `testing-codex` | `2026-09-26 18:16:20` |

El SHA desplegado coincide exactamente con `origin/testing-codex` y con el baseline auditado en el preflight. No se realizó redeploy, restart ni operación de promoción. Production no fue modificada.

## Preflight y controles de ejecución

Autoridad: [P2_T34_ANDROID_SESSION_ISOLATION_PREFLIGHT.md](P2_T34_ANDROID_SESSION_ISOLATION_PREFLIGHT.md).

```text
P2_T34_SCOPE_CONFIRMED=SI
P2_T34_SOURCE_FINDING=F-P2-T31-R23B-01
P2_T34_ROOT_CAUSE_CONFIRMED=NO
PHYSICAL_ANDROID_REQUIRED=SI
TEST_CLIENT_ACCOUNT_REQUIRED=SI
TEST_DRIVER_ACCOUNT_REQUIRED=SI
T34_SETCOOKIE_FINDING=STALE_STATIC_CONTRACT_ASSERTION
T34_SETCOOKIE_CAUSAL_TO_ANDROID=NO_EVIDENCE
```

El aislamiento esperado es lógico por familia dentro del mismo perfil Chrome/origin. No se exige que las PWAs tengan cookie jars separados. El factor de cuenta Google permanece descartado según evidencia física previa.

Para la certificación se necesitan una cuenta TESTING Cliente y una cuenta TESTING Repartidor. No se registrarán emails, contraseñas, cookies, tokens ni IDs personales. El operador aún no informó versión Android, versión Chrome ni dispositivo; no se infieren.

## Registro de casos

La evidencia física de A/B fue proporcionada por el operador. Codex no inició sesión, no navegó a TESTING ni interactuó con el dispositivo. Se detuvo la secuencia en el primer fallo, conforme al procedimiento; no se continuó con los casos siguientes.

| Caso | Escenario | Resultado | Timestamp | Nota |
|---|---|---|---|---|
| A | Chrome normal — sesión Cliente | `PASS` | No informado | Cliente autenticado en `/cliente/` |
| B | Repartidor concurrente en segunda pestaña del mismo perfil Chrome | `FAIL` | No informado | Al volver a la pestaña Cliente y recargar en `/cliente`, se muestra el aviso para usar DeliGO Delivery o cerrar sesión. No se pulsó ningún botón. Ambas cuentas siguen autenticadas. |
| C | Cliente standalone | `NOT_RUN_AFTER_FAIL` | — | Detención obligatoria tras el fallo B |
| D | Repartidor standalone | `NOT_RUN_AFTER_FAIL` | — | Detención obligatoria tras el fallo B |
| E | Cierre completo y reapertura Cliente standalone | `NOT_RUN_AFTER_FAIL` | — | Detención obligatoria tras el fallo B |
| F | Cierre completo y reapertura Repartidor standalone | `NOT_RUN_AFTER_FAIL` | — | Detención obligatoria tras el fallo B |
| G | Logout Cliente y verificación de Repartidor | `NOT_RUN_AFTER_FAIL` | — | Detención obligatoria tras el fallo B |
| H | Logout Repartidor y verificación de Cliente | `NOT_RUN_AFTER_FAIL` | — | Detención obligatoria tras el fallo B |

```text
VISIBLE_ACTOR=Cliente antes de la segunda pestaña; aviso de sesión Repartidor después de recargar (rol deducido del texto informado)
EXPECTED_ACTOR=Cliente
CURRENT_PATH=/cliente (antes de recargar era /cliente/)
LOGIN_STATE=Cliente y Repartidor autenticados; ambas cuentas permanecen logueadas
STANDALONE_OR_CHROME=Chrome normal, mismo perfil, dos pestañas
COLD_OR_WARM=Recarga de pestaña (tipo de arranque no informado)
OTHER_ROLE_STILL_AUTHENTICATED=YES
AUTH_ME_FAMILY_RESULT=NOT_CAPTURED
HTTP_STATUS=NOT_CAPTURED
```

## Diagnóstico y decisión

El Caso B reprodujo el fallo histórico. La causa raíz completa no quedó confirmada: el aviso identifica que la UI recibió un usuario cuyo tipo no es `cliente`, pero no se capturó ni la respuesta de `/api/auth/me?actorFamily=cliente` ni el tipo del usuario rehidratado en `deligo-auth:cliente`. El análisis está en [P2_T34_R1_CASE_B_ROOT_CAUSE_DIAGNOSIS.md](P2_T34_R1_CASE_B_ROOT_CAUSE_DIAGNOSIS.md). No atribuirlo a sobrescritura de cookie, proxy, hidratación, navegación o barra final sin esa evidencia.

No se modificaron código, tests, Prisma/schema, manifests, Service Worker, Push ni handoffs canónicos. No se creó un worktree. No se consultó DB ni se alteraron cuentas.

La ejecución queda detenida inmediatamente después del primer fallo (Caso B). Los Casos C–H no se ejecutaron y no deben iniciarse dentro de este cierre diagnóstico.

```text
P2_T34_PHYSICAL_REPRO_GATE=FAIL_STOP
PHYSICAL_REPRO_STARTED=YES
HISTORICAL_ANDROID_FAIL_REPRODUCED=YES
ROOT_CAUSE_CONFIRMED=NO
IMPLEMENTATION_REQUIRED=UNDETERMINED
PRODUCTION_TOUCHED=NO
NEXT_ACTION=OPERATOR_PROVIDE_CASE_B_DIAGNOSTIC_SNAPSHOT
```
