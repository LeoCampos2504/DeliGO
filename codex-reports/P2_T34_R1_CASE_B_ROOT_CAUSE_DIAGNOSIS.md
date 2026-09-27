# P2-T34-R1 — Case B Android session isolation failure — read-only root cause diagnosis

Fecha: 2026-09-26  
Modo: `READ_ONLY_ROOT_CAUSE_DIAGNOSIS`  
Baseline inspeccionado: `origin/testing-codex` = `82ee16a27e71cd4d438c81f7953a4956a563389d`  
Evidencia física: reporte del operador, Casos A y B. Sin acceso a captura de red, almacenamiento del navegador ni valores de cookies.

## Resultado ejecutivo

El Caso B falló físicamente y reprodujo el síntoma histórico: la pestaña Cliente funcionó antes de abrir Repartidor en otra pestaña del mismo perfil Chrome; tras volver y recargar Cliente, apareció el aviso de rol equivocado. Los Casos C–H no se ejecutaron y la secuencia queda detenida.

El origen visual del aviso sí está identificado en código. La causa que hizo que el estado de la pestaña Cliente llegara a representar un usuario Repartidor no puede confirmarse con la evidencia disponible. No hay base para afirmar sobrescritura de cookie ni para escoger entre estado persistido local y respuesta de `/api/auth/me`. Por eso el cierre es `PASS_WITH_UNCONFIRMED_ROOT_CAUSE`, no una causa confirmada ni un diagnóstico de capa.

```text
P2_T34_R1_DIAGNOSIS_GATE=PASS_WITH_UNCONFIRMED_ROOT_CAUSE
CASE_A=PASS
CASE_B=FAIL
CASE_C=NOT_RUN_AFTER_FAIL
CASE_D=NOT_RUN_AFTER_FAIL
CASE_E=NOT_RUN_AFTER_FAIL
CASE_F=NOT_RUN_AFTER_FAIL
CASE_G=NOT_RUN_AFTER_FAIL
CASE_H=NOT_RUN_AFTER_FAIL
HISTORICAL_FAIL_REPRODUCED=YES
WARNING_SOURCE=src/components/shared/wrong-role-notice.tsx; invoked by src/app/cliente/page.tsx:544-545
WARNING_TRIGGER_CONDITION=authUser truthy AND authUser.type != cliente
WARNING_ACTOR_EXPECTED=cliente
WARNING_ACTOR_DETECTED=repartidor (inferred from the operator-reported DeliGO Delivery notice; not independently captured)
CLIENTE_AUTH_ME_REQUEST=GET /api/auth/me?actorFamily=cliente
CLIENTE_AUTH_ME_ACTOR_FAMILY=cliente
CLIENTE_AUTH_ME_RUNTIME_RESULT=NOT_CAPTURED
CLIENTE_LOCALSTORAGE_USER_TYPE=NOT_CAPTURED
ROOT_CAUSE_CONFIRMED=NO
ROOT_CAUSE_LAYER=UNCONFIRMED
LEGACY_ALIAS_CAUSAL=UNCONFIRMED
PATH_TRAILING_SLASH_CAUSAL=NO_EVIDENCE
PROPOSED_FILESET=NONE_CONFIRMED
PRODUCTION_TOUCHED=NO
NEXT_ACTION=CAPTURE_CLIENTE_AUTH_ME_STATUS_AND_USER_TYPE_PLUS_CLIENTE_STORE_USER_TYPE_DURING_REPRO
```

## Evidencia física recibida

- Baseline indicado: `origin/testing-codex` y despliegue TESTING en `82ee16a27e71cd4d438c81f7953a4956a563389d`.
- Caso A PASS: Chrome normal; se abrió `/cliente`, se inició sesión Cliente y se llegó a `/cliente/`.
- Caso B FAIL: se conservó abierta la pestaña Cliente. En una segunda pestaña del mismo perfil Chrome se inició sesión Repartidor correctamente y se llegó al inicio de Repartidor. Al regresar a Cliente, visualmente seguía normal hasta recargar. La recarga dejó la ruta en `/cliente` (antes `/cliente/`) y apareció el aviso indicando sesión de DeliGO Delivery y ofreciendo ir a esa experiencia o cerrar sesión. No se pulsó ninguna opción.
- El operador reporta que ambas cuentas siguen autenticadas; no cambió de perfil ni usó incógnito. El texto del aviso permite inferir que la UI recibió `currentType=repartidor`, pero no sustituye una lectura del store ni una respuesta de red.
- Android/Chrome exactos y hora del caso: no informados. No se agregan ni se infieren.

## Qué causa el aviso

En `src/app/cliente/page.tsx`, el guard alrededor de las líneas 544–545 devuelve `WrongRoleNotice` cuando `authUser` existe y `authUser.type !== "cliente"`. En `src/components/shared/wrong-role-notice.tsx`, el nombre/acción de rol se derivan de `currentType`: por eso el texto informado como DeliGO Delivery concuerda con `currentType="repartidor"`.

Esto confirma el disparador inmediato de render, no la procedencia del usuario que estaba en `authUser`. El guard no incluye una comprobación explícita de tipo de sesión en sí mismo. La página usa `useHydrated()` para evitar render auth-dependiente en el snapshot de servidor; dicho helper distingue snapshot cliente/servidor, pero no demuestra por sí solo cuándo completó la rehidratación de persistencia respecto de la sincronización de red. En `src/hooks/use-auth.ts`, el fetch de sincronización ocurre en un efecto y una respuesta exitosa llama al login del tipo retornado, escribiendo ese tipo en el store de la familia que corresponde al pathname. La secuencia temporal concreta del Caso B no fue capturada.

## Resolución de cookies y `/api/auth/me`

El código de login en `src/app/api/auth/login/route.ts` pasa `cliente` o `repartidor` a `applyLoginCookies`. `src/lib/auth.ts` define cookies separadas `deligo_session_cliente` y `deligo_session_repartidor`. El proxy asigna `Path=/`, `HttpOnly`, `SameSite=Lax`, `Secure` en producción y no configura `Domain`; por tanto, si ambas existen para el mismo host, el navegador puede enviarlas ambas a una solicitud del mismo origen. La presencia de ambas no significa que se mezclen: el resolver selecciona por familia.

Para `GET /api/auth/me?actorFamily=cliente`, el proxy reconoce el selector en el endpoint compartido `/api/auth/me`; si la cookie de Cliente está presente y válida por formato, selecciona esa cookie. Sólo recurre a `deligo_session` cuando falta la cookie de Cliente. El token seleccionado se reescribe bajo el nombre legacy únicamente en el `Cookie` del request hacia el handler; no es una escritura de cookie de navegador. El handler `/api/auth/me` resuelve ese token y responde con el usuario real, sin caché (`private, no-store`). La sincronización cliente deriva `actorFamily` del pathname de esta pestaña: tanto `/cliente` como `/cliente/` resuelven `cliente`.

El login Repartidor nuevo escribe su cookie familiar y no debería sobrescribir por nombre la cookie familiar Cliente. Sin embargo, no se inspeccionó el estado real de cookies del dispositivo ni se capturó la solicitud/respuesta de `/api/auth/me`. Tampoco se puede descartar que exista una cookie legacy antigua en ese perfil y que la cookie familiar Cliente no estuviera presente/aceptada. Por lo tanto:

| Pregunta | Evidencia del código | Evidencia runtime del Caso B | Conclusión |
|---|---|---|---|
| ¿Login Cliente y Repartidor escriben el mismo nombre de cookie familiar? | No; usan nombres por familia. | No capturada. | No hay evidencia de overwrite cross-family por el login actual. |
| ¿Dos cookies familiares pueden coexistir y viajar al mismo origen? | Sí; ambas usan `Path=/`. | No capturada. | Coexistencia es compatible con el diseño. |
| ¿La selección del proxy para `actorFamily=cliente` elige Repartidor si las dos cookies familiares están presentes? | No; selecciona la cookie Cliente; no elige otra familia. | No capturada. | No según la resolución actual del código. |
| ¿Puede entrar en juego la cookie legacy `deligo_session`? | Sí, como fallback cuando falta la cookie de la familia seleccionada. El login actual no la escribe como alias familiar. | No se sabe si existía ni qué cookie llegó. | Causalidad no confirmada. |
| ¿Qué usuario devolvió `/api/auth/me?actorFamily=cliente` tras la recarga? | El handler retorna el usuario de la sesión resuelta. | No se capturó status ni `user.type`. | Desconocido; señal decisiva pendiente. |

El selector no es autoridad de identidad: el handler valida en servidor la sesión asociada al token. El análisis estático del proxy prueba selección de token bajo escenarios controlados, no qué cookies tenía esta sesión física.

## Zustand, hidratación, pestañas y rutas

`src/store/auth-store.ts` calcula el namespace desde el pathname actual en cada operación: `/cliente` y `/cliente/` pertenecen ambos a `deligo-auth:cliente`; Repartidor usa `deligo-auth:repartidor`. No se lee/escribe un store común de Cliente/Repartidor en el flujo de familia descrito. El listener `storage` de `src/providers/realtime-provider.tsx` ignora claves de otras familias y sólo propaga un logout cuando el valor de la clave correspondiente contiene `user: null`. Un login Repartidor guarda un usuario no nulo en otra clave y, según este código, no cambia directamente el actor de la pestaña Cliente.

La prueba unitaria de persistencia existente valida escrituras segregadas para Cliente/Negocio, y la rehidratación fresca valida Cliente/Negocio; no cubre explícitamente el par Cliente/Repartidor bajo una recarga física con dos cookies de sesión reales. El código genérico usa el mismo mapeo de familia para Repartidor, pero no se debe elevar esa inferencia a reproducción integral.

El path `/cliente` de página no es una ruta protegida por `pathFamily()` del proxy: ese resolver usa prefijos API (`/api/cliente`, etc.). La consulta posterior `/api/auth/me?actorFamily=cliente` sí lleva selector explícito. En el store, ambas formas `/cliente` y `/cliente/` se asignan a Cliente, así que el cambio de barra final informado no cambia la familia por sí mismo. No se encontró evidencia de que la barra final sea causal.

El flujo de login Repartidor navega a su inicio (`src/lib/repartidor-post-login-navigation.ts`); eso no explica un cambio de actor en la otra pestaña. El handoff `deligo_push_handoff` de `applyLoginCookies` es metadata firmada de propietario de Push, aparte de las cookies de sesión de actor; no hay evidencia de que sea un mecanismo de selección auth ni causa del aviso.

## Pruebas relevantes existentes (sólo lectura/ejecución segura)

Resultados ya obtenidos en procesos locales aislados, sin cambios de fuentes:

- `bun test src/proxy.test.ts`: PASS, 55/55. Incluye selección por `actorFamily=cliente` con ambas cookies de prueba presentes y el comportamiento fail-closed relevante. No simula el navegador físico ni la página React.
- `bun test src/store/auth-store.test.ts`: PASS, 11/11. Verifica namespaces y rehidratación por pathname, pero no el caso exacto de convivencia Cliente/Repartidor en navegador real.
- `bun test src/providers/realtime-provider-cross-tab-static-contract.test.ts`: PASS, 7/7. Contrato de evento storage/familia; no la secuencia completa de la interfaz.
- `bun test src/app/api/auth/login/apply-login-cookies.test.ts`: PASS, 6/6. Prueba lógica de cookies/handoff sin un login físico completo.
- `bun test src/lib/repartidor-post-login-navigation.test.ts`: PASS, 3/3. Aísla navegación post-login Repartidor.
- `bun test src/hooks/use-auth-static-contract.test.ts`: FAIL, 10 PASS / 1 FAIL por una aserción textual estática de logout que no encuentra el patrón esperado (`indexOf` devuelve `-1`). Es una falla de contrato estático preexistente/no relacionada que no se corrigió; por sí sola no prueba ni explica el Caso B.

No se ejecutó `src/lib/actor-family-session-coexistence.integration.test.ts`: depende de fixtures de integración y escribe sesiones/usuarios de prueba en DB, fuera del alcance permitido. Los tests de proxy/store/hook tampoco forman un E2E de dos logins reales, recarga Cliente, respuesta `/me` y render de `WrongRoleNotice`.

## Causalidad y capa

```text
ROOT_CAUSE_LAYER=UNCONFIRMED
LEGACY_ALIAS_CAUSAL=UNCONFIRMED
COOKIE_FAMILY_RESOLUTION=STATICALLY_CONSISTENT; RUNTIME_NOT_CAPTURED
PROXY_PATH_RESOLUTION=STATICALLY_CONSISTENT_FOR_API_SELECTOR; RUNTIME_NOT_CAPTURED
AUTH_ME_RESOLUTION=NOT_CAPTURED
ZUSTAND_HYDRATION=NOT_CAPTURED_IN_PHYSICAL_SEQUENCE
POST_LOGIN_REDIRECT=NO_EVIDENCE_OF_CAUSALITY
PATH_TRAILING_SLASH_CAUSAL=NO_EVIDENCE
T02_B1_CAUSAL=NO_EVIDENCE
T40_PUSH_HANDOFF_CAUSAL=NO_EVIDENCE
```

No confirmar `COOKIE_FAMILY_RESOLUTION`, `PROXY_PATH_RESOLUTION`, `AUTH_ME_RESOLUTION`, `ZUSTAND_HYDRATION` ni otra capa como causa raíz: se observó el síntoma de rol equivocado, pero faltan las dos lecturas que separan origen cliente/servidor (tipo persistido bajo `deligo-auth:cliente` y tipo/status de la respuesta `/api/auth/me?actorFamily=cliente`).

## Siguiente diagnóstico mínimo y seguro

En una repetición controlada de sólo el Caso B (no continuar C–H), inmediatamente después de que aparezca el aviso y sin pulsar botones, capturar únicamente:

1. En la solicitud `GET /api/auth/me?actorFamily=cliente`: status HTTP y `user.type` si es 200 (o confirmar 401). No compartir headers `Cookie`, cuerpos con IDs, email, tokens ni datos personales.
2. En DevTools Application/Storage, sólo el nombre de clave `deligo-auth:cliente` y el `state.user.type` almacenado. No compartir el objeto completo ni IDs/email.

Interpretación que habilitaría un diagnóstico posterior:

- `/me` devuelve Cliente, pero la clave Client contiene `repartidor`: investigar escritura/rehidratación/hidratación del store de Cliente.
- `/me` devuelve Repartidor mientras ambas cookies familiares existen: investigar selección efectiva de cookie/proxy/deployment y el estado real de cookies; no culpar al query selector sin capturar request/respuesta.
- `/me` da 401 y la clave Cliente contiene Repartidor: estado local obsoleto o persistido más allá del resultado de sync; capturar el orden temporal del render y sync.
- `/me` devuelve Cliente y la clave Cliente contiene Cliente pero el aviso persiste: capturar una secuencia temporal sin datos personales (tipo antes/después de sincronizar) y revisar si existe otra ruta de escritura/estado en memoria.

No cambiar código como parte de este reporte. Sólo después de obtener esa evidencia se podrá escoger una capa y proponer un fileset acotado. Aún no existe un fileset de reparación confirmado.

## Límites de este trabajo

Sólo se inspeccionó el baseline limpio/remoto `82ee16a27e71cd4d438c81f7953a4956a563389d` y se documentaron pruebas locales ya ejecutadas. No se modificó código/tests, Prisma/schema, cookies/configuración, manifests, Service Worker, Push, variables Railway ni documentación canónica ajena a los dos reportes autorizados. No hubo consultas/escrituras de DB, cambios o redeploys Railway, ni acciones de Production. No se continuó con los Casos C–H ni se inició P2-T38.

```text
CODE_MODIFIED=NO
TESTS_MODIFIED=NO
DB_TOUCHED=NO
RAILWAY_TOUCHED=NO
PRODUCTION_TOUCHED=NO
P2_T38_STARTED=NO
```

## Adenda R2 — auditoría histórica

La reconstrucción del arreglo original y de los cambios posteriores está en [P2_T34_R2_HISTORICAL_SESSION_ISOLATION_REGRESSION_AUDIT.md](P2_T34_R2_HISTORICAL_SESSION_ISOLATION_REGRESSION_AUDIT.md). Aporta un candidato causal concreto y condicional: el callback Google aún escribe `deligo_session` legacy y el proxy la usa como fallback cuando falta la cookie familiar; no se puede afirmar que ocurrió en este Caso B porque el método de login no quedó registrado y no hay resultado runtime de `/api/auth/me`. La clasificación histórica es `HISTORICAL_FIX_INCOMPLETE`; la causa runtime permanece `UNCONFIRMED`. Esta adenda R2 sustituye la propuesta de captura manual descrita antes: no se solicita al operador DevTools ni nuevas pruebas físicas; el próximo paso propuesto es pedir autorización para instrumentación temporal segura en TESTING.

## Adenda R3 — causa confirmada y reparación técnica desplegada

El operador confirmó posteriormente que ambas autenticaciones del Caso B
fueron Google OAuth. La hipótesis condicional sobre el callback global queda
confirmada para esa reproducción. R3 cambió el callback y el cierre del
consentimiento legal a cookies familiares, preservó el fallback legacy del
proxy y mantuvo el handoff T40 limitado al owner anterior de la misma familia.
El commit `38ac6d398fb1bdead11913a347c81162eb260666` está desplegado `SUCCESS`
en TESTING. Todavía falta la recertificación física A/B del operador; R1
continúa como evidencia histórica, no como prueba del fix nuevo.

```text
CASE_B_LOGIN_METHOD=GOOGLE_OAUTH_BOTH
ROOT_CAUSE_CONFIRMED=SI
ROOT_CAUSE_LAYER=GOOGLE_OAUTH_LEGACY_SESSION_COOKIE
REGRESSION_STATUS=HISTORICAL_FIX_INCOMPLETE
REGRESSION_INTRODUCED_BY_COMMIT=NONE
P2_T34_R3_TECHNICAL_GATE=PASS
PHYSICAL_RECERTIFICATION_REQUIRED=SI
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_CASE_A_B_GOOGLE_OAUTH_RECERTIFICATION
REPORT_PATH=C:\Leo Campos\Trabajo\deligo-main-limpio\codex-reports\P2_T34_R3_GOOGLE_OAUTH_FAMILY_SESSION_FIX.md
```

## Adenda R4 — disposición posterior

La afirmación R1 `ROOT_CAUSE_CONFIRMED=NO` describe correctamente el conocimiento disponible en esa etapa y se conserva como historia. Después, el operador confirmó Google OAuth en ambas autenticaciones; R3 confirmó la capa de causa como escritura de la cookie legacy compartida y aplicó cookies por familia. La recertificación física Android A/B post-fix fue PASS: Cliente sobrevivió el reload como Cliente, sin `WrongRoleNotice`, y Repartidor continuó autenticado. T34 cierra en Testing; no se ejecutaron C–H.

```text
R1_HISTORICAL_ROOT_CAUSE_STATUS=UNCONFIRMED_AT_R1
ROOT_CAUSE_CONFIRMED_LATER=SI
ROOT_CAUSE_LAYER=GOOGLE_OAUTH_LEGACY_SESSION_COOKIE
CASE_A_POST_FIX=PASS
CASE_B_POST_FIX=PASS
P2_T34_STATUS=CLOSED_TESTING_CERTIFIED
PRODUCTION_TOUCHED=NO
```

Detalle: [P2_T34_R4_PHYSICAL_RECERTIFICATION_CLOSEOUT.md](P2_T34_R4_PHYSICAL_RECERTIFICATION_CLOSEOUT.md).
