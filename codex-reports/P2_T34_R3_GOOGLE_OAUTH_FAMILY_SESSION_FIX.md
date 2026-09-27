# P2-T34-R3 — Google OAuth family session isolation fix

Fecha local: 2026-09-26 (deployment Railway registrado el 2026-09-27 UTC)  
Baseline: `origin/testing-codex@82ee16a27e71cd4d438c81f7953a4956a563389d`  
Branch: `work/p2-t34-session-isolation`  
Commit: `38ac6d398fb1bdead11913a347c81162eb260666` — `fix: isolate Google OAuth sessions by actor family`

## Resultado

Se confirmó para la reproducción física del Caso B la causa identificada en
R2: Cliente y Repartidor iniciaron sesión ambos por Google OAuth; el callback
escribía las dos sesiones en `deligo_session`, por lo que el segundo login
Repartidor podía desplazar al Cliente y el fallback legacy del proxy podía
devolver `type=repartidor` a `/api/auth/me?actorFamily=cliente` al recargar.

El callback ahora emite `deligo_session_cliente` o
`deligo_session_repartidor`, según el rol. También se migró el punto de
emisión de sesión del consentimiento legal Google, que era otra salida del
mismo flujo y todavía escribía la cookie global. La lógica común de atributos
se centralizó en `setFamilySessionCookie` y el login por contraseña reutiliza
ese helper sin cambiar sus nombres de cookie ni la semántica del handoff.

```text
P2_T34_R3_TECHNICAL_GATE=PASS
CASE_A_HISTORICAL=PASS
CASE_B_HISTORICAL=FAIL
CASE_B_LOGIN_METHOD=GOOGLE_OAUTH_BOTH
ROOT_CAUSE_CONFIRMED=SI
ROOT_CAUSE_LAYER=GOOGLE_OAUTH_LEGACY_SESSION_COOKIE
REGRESSION_STATUS=HISTORICAL_FIX_INCOMPLETE
REGRESSION_INTRODUCED_BY_COMMIT=NONE
GOOGLE_OAUTH_CLIENTE_FAMILY_COOKIE=SI
GOOGLE_OAUTH_REPARTIDOR_FAMILY_COOKIE=SI
NEW_GOOGLE_OAUTH_LEGACY_SESSION_WRITES=NO
LEGACY_FALLBACK_REMOVED=NO
PASSWORD_LOGIN_REGRESSION=PASS
PROXY_FAMILY_REGRESSION=PASS
T40_PUSH_HANDOFF_PRESERVED=SI
T02_B1_REGRESSION=PASS
WRONG_ROLE_NOTICE_REMOVED=NO
PRISMA_SCHEMA_CHANGED=NO
NEW_MIGRATIONS=0
MANIFEST_FILES_CHANGED=0
SERVICE_WORKER_CHANGED=NO
PRODUCTION_TOUCHED=NO
PHYSICAL_RECERTIFICATION_REQUIRED=SI
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_CASE_A_B_GOOGLE_OAUTH_RECERTIFICATION
```

## Alcance implementado

La ruta de callback conserva verificación OAuth, creación de sesión y
redirects; sólo cambia la cookie de sesión primaria. El lookup de owner para
el handoff firmado T40 primero consulta la cookie familiar. Para una sesión
antigua en transición, usa `deligo_session` sólo cuando falta la familiar y
sólo acepta un owner cuyo `userType` coincide con la familia que inicia
sesión. Así se conserva el handoff mismo-actor sin desalojar la suscripción
Push de la otra familia concurrente.

El proxy continúa priorizando la cookie familiar seleccionada y mantiene el
fallback legacy únicamente cuando esa cookie falta. No se cambió el selector
server-side, logout, Zustand, `WrongRoleNotice`, routing/trailing slash ni
`REPARTIDOR_POST_LOGIN_PATH`. No se amplió a Negocio ni a otros actores.

## Archivos del commit

- `src/app/api/auth/google/callback/route.ts`
- `src/app/api/auth/google/consent/route.ts`
- `src/app/api/auth/google/session-cookie.test.ts`
- `src/app/api/auth/login/apply-login-cookies.test.ts`
- `src/app/api/auth/login/route.ts`
- `src/lib/auth-session-cookie.ts`
- `src/lib/test-helpers/auth-mock.ts`
- `src/proxy.test.ts`
- `src/store/auth-store.test.ts`

La extensión a `google/consent/route.ts` es necesaria porque el callback
redirige allí las identidades que deben aceptar términos: el POST de
consentimiento crea la sesión autenticada y, sin el mismo cambio, seguiría
emitiendo sesiones Google Cliente/Repartidor bajo la cookie global.

## Pruebas y calidad

- Pruebas focales: **86 PASS / 0 FAIL**, 211 assertions, en cinco archivos:
  callback/coexistencia/logout, proxy, store, `applyLoginCookies` (T40 y
  password login) y navegación post-login Repartidor (T02-B1).
- Repetición posterior de la prueba OAuth y password/T40 tras endurecer el
  assert `Secure`: **15 PASS / 0 FAIL**, 54 assertions, en dos archivos.
- ESLint sobre los nueve archivos del fileset: **PASS**.
- `git diff --check`: **PASS**.
- Typecheck global no está limpio en el baseline: el worktree baseline
  `origin/testing-codex` produjo 32 diagnósticos antes de compilar. En el
  checkout de R3 no hay diagnóstico nuevo originado en los fuentes/tests
  modificados; el chequeo posterior al build también reporta errores de tipos
  preexistentes/derivados de `.next/types`, incluido el export preexistente
  `applyLoginCookies` del route de login. No se amplió este fix para reparar
  deuda global ajena.
- `bun run build` con el junction externo de dependencias no pudo continuar:
  Turbopack lo rechazó por estar fuera de la raíz del proyecto. Como
  verificación local alternativa, `next build --webpack` compiló correctamente
  y generó las 158 páginas; `scripts/copy-standalone-assets.js` terminó con
  éxito. En Railway, el build configurado con Turbopack también compiló y
  completó las páginas estáticas.
- Las pruebas usaron mocks aislados. No se ejecutó suite que escriba datos de
  PostgreSQL ni se consultó/modificó directamente ninguna DB. No cambió
  Prisma/schema/migrations. El resultado del predeploy automático existente de
  Railway no se capturó de forma independiente en los logs consultados; no se
  afirma aquí que se haya ejecutado ni que haya aplicado una migración.

## Seguridad y compatibilidad

`setFamilySessionCookie` usa el helper de nombres familiares vigente y
preserva `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=12h` y `Secure` cuando
`NODE_ENV=production`; el test verifica los atributos en modo Production.
No se introdujeron tokens/PII en logs. La instrumentación T40 existente
continúa emitiendo fingerprints no reversibles. No se eliminó el fallback
legacy ni se cambió el esquema de identidad/autorización del proxy.

## Push y deploy TESTING

Antes del push, `origin/testing-codex` seguía en el SHA base autorizado. Se
creó un commit único y se empujó fast-forward sólo a
`refs/heads/testing-codex`; no se hizo push a `main` ni force push.

| Servicio TESTING | Deployment | Commit | Estado |
|---|---|---|---|
| DeliGO Copy | `da0f5913-31db-466d-978b-a554f86b891e` | `38ac6d398fb1bdead11913a347c81162eb260666` | `SUCCESS` |
| Review Moderation Expiry | `b8e21b55-442d-4fd5-a5cc-00640e58a77b` | `38ac6d398fb1bdead11913a347c81162eb260666` | `SUCCESS` |
| chat en vivo | deployment previo | baseline `82ee16a27e71cd4d438c81f7953a4956a563389d` | `SUCCESS`, sin redeploy observado |
| DeliGO Mesa Occupancy Cron | deployment previo | sin cambio observado | `SUCCESS`, detenido/escala cero como antes |
| Postgres | deployment previo | sin cambio observado | `SUCCESS` |

Log gate: **PASS**. El build remoto reportó compilación correcta y páginas
generadas. En los 24 registros runtime leídos de DeliGO Copy no hubo match de
exception/fatal/unhandled/crash ni error; no había evento de login que
produjera líneas OAuth/cookie. Review Moderation Expiry no devolvió registros
runtime para revisar y su deployment terminó `SUCCESS`. No se imprimieron
secretos ni valores de cookies.

HTTP smoke no mutante, sin cookies y únicamente con `GET`:

```text
GET /                                      = 200
GET /api/auth/me?actorFamily=cliente       = 401 (esperado sin sesión)
MUTATING_REQUESTS                          = 0
```

Esto sólo valida disponibilidad/respuesta básica; no sustituye el Caso A/B
físico ni certifica una sesión OAuth real.

## Estado y siguiente acción

```text
TESTING_DEPLOY=SUCCESS
LOG_GATE=PASS
HTTP_SMOKE=PASS_NON_MUTATING
P2_T34_STATUS=FIXED_TESTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_RECERTIFICATION
PHYSICAL_RECERTIFICATION_REQUIRED=SI
PRODUCTION_TOUCHED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_CASE_A_B_GOOGLE_OAUTH_RECERTIFICATION
```

Detener aquí. El operador debe repetir primero sólo Caso A (Cliente Google
OAuth) y luego Caso B (Repartidor Google OAuth en otra pestaña del mismo
perfil, volver/recargar Cliente). Esperado: Cliente continúa autenticado como
`type=cliente`, el aviso `WrongRoleNotice` no aparece por coexistencia y
Repartidor sigue autenticado. No continuar C–H automáticamente. T34 no se
cierra hasta recibir esa recertificación.

## Adenda R4 — recertificación física PASS y cierre

El operador reportó Android real/Chrome normal en el mismo perfil: Case A Cliente Google OAuth PASS (`/cliente/`); Case B Repartidor Google OAuth PASS en segunda pestaña (`/repartidor`). Después del reload, Cliente continuó como Cliente, no apareció `WrongRoleNotice` y Repartidor siguió autenticado. Se conserva íntegra la matriz histórica FAIL. El gate R3 técnico y la evidencia física A/B ahora satisfacen la aceptación pendiente; C–H no son un prerequisito documentado y no se ejecutaron.

```text
P2_T34_R3_TECHNICAL_GATE=PASS
CASE_A_POST_FIX=PASS
CASE_B_POST_FIX=PASS
CLIENT_RELOAD_AFTER_DRIVER_GOOGLE_LOGIN=PASS
CLIENT_REMAINED_CLIENT_AFTER_RELOAD=SI
DRIVER_REMAINED_AUTHENTICATED=SI
WRONG_ROLE_NOTICE_POST_FIX=NO
P2_T34_R4_PHYSICAL_RECERTIFICATION_GATE=PASS
P2_T34_FINAL_GATE=PASS
P2_T34_STATUS=CLOSED_TESTING_CERTIFIED
FUNCTIONAL_FIX_COMMIT=38ac6d398fb1bdead11913a347c81162eb260666
PRODUCTION_TOUCHED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_NEXT_TASK_DECISION
```

Ver [P2_T34_R4_PHYSICAL_RECERTIFICATION_CLOSEOUT.md](P2_T34_R4_PHYSICAL_RECERTIFICATION_CLOSEOUT.md).
