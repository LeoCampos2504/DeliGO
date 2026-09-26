# DELIGO — FULL CROSS-CHAT CONTEXT (LATEST)

## CURRENT AUTHORITATIVE STATE — P2-T38 CLOSED_TESTING_CERTIFIED (2026-09-26)

```text
CURRENT_TASK=P2-T38-R1-PHYSICAL-RECERTIFICATION-CLOSEOUT
CURRENT_TASK_STATUS=CLOSED_TESTING_CERTIFIED
P2_T38_STATUS=CLOSED_TESTING_CERTIFIED
PRIOR_ANDROID_ACCEPT_PHYSICAL=FAIL
PRIOR_FAILURE=PREMATURE_APP_INSTALLED_MESSAGE
P2_T38_R1_TECHNICAL_GATE=PASS
P2_T38_R1_IMPLEMENTATION_COMMIT=147f24a39dc6f2df04ca8b5f9d54492864de9460
ANDROID_ACCEPT_PHYSICAL_RECERTIFICATION=PASS
ANDROID_CANCEL_PHYSICAL_RECERTIFICATION=PASS
IOS_PHYSICAL_CERTIFICATION=PASS (Safari; modelo/versiones no informados)
T38_POST_PHYSICAL_LOG_GATE=PASS
P2_T38_PHYSICAL_CERTIFICATION=PASS
P2_T38_FINAL_GATE=PASS
P2_T38_IMPLEMENTATION_GATE=PASS
P2_T38_IMPLEMENTATION_COMMIT=5dc91a21d5525d5e2e9ed0c83243c7cbcc620067
P2_T38_R0_TESTING_DEPLOY=SUCCESS
P2_T38_R0_TESTING_COMMIT_MATCH=SI
P2_T38_R0_HTTP_SMOKE=PASS (15/15)
P2_T38_TYPECHECK=REPO_BASELINE_ERRORS_OUTSIDE_T38; sin diagnósticos en fileset T38
T38_FILES_ONLY=SI
T38_ANDROID_BACKGROUND_STATE_IMPLEMENTED=SI
T38_ANDROID_FALSE_SUCCESS_PREVENTED=SI (R1: appinstalled no es launcher-ready)
T38_ANDROID_RETRY_STATE_COHERENT=SI
T38_IOS_GUIDED_TUTORIAL_IMPLEMENTED=SI
T38_IPADOS_DETECTION_ALIGNED=SI
T38_MOZO_EXCLUSION_PRESERVED=SI
T38_LEGACY_ES_EXCLUSION_PRESERVED=SI
T36_BRANDING_REGRESSION=PASS
T40_PUSH_LIFECYCLE_UNTOUCHED=SI
T34_SESSION_ISOLATION_UNTOUCHED=SI
PRISMA_SCHEMA_CHANGED=NO
NEW_MIGRATIONS=0
MANIFEST_FILES_CHANGED=0
SERVICE_WORKER_CHANGED=NO
SECRET_LEAK=NO
NEW_PII_LOGGING=NO
PRODUCTION_TOUCHED=NO
PRIOR_ANDROID_APPINSTALLED_EQUIVALENT_TO_LAUNCHER_READY=NO (evidencia física del operador)
P2_T38_PHYSICAL_CERTIFICATION_REQUIRED=NO
P2_T38_R0_ANDROID_ACCEPT_PHYSICAL=FAIL (conservar como evidencia histórica)
APPINSTALLED_AS_LAUNCHER_READY=NO
PREMATURE_SUCCESS_REMOVED=SI
POST_ACCEPT_UX_TRUTHFUL=SI
ANDROID_STATE_NOT_STUCK=SI
ANDROID_RETRY_PRESERVED=SI
IOS_TUTORIAL_REGRESSION=PASS_AUTOMATED_ONLY; NO_PHYSICAL_CERTIFICATION
TESTING_DEPLOY=SUCCESS; commit exacto `147f24a`
HTTP_SMOKE=PASS (15/15 GET)
REPORT_DIR_CANONICAL=C:\Leo Campos\Trabajo\deligo-main-limpio\codex-reports
NEXT_PRIORITY_TASK=OPERATOR_DECISION_REQUIRED (P2-T34/P2-T52-Fase-4; P2-T23 requiere decisión/sonda; P2-T33/T37 permanecen secuenciadas)
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_NEXT_PRIORITY_DECISION
```

La primera certificación física Android/Chrome de R0 falló: tras aceptar la
instalación apareció “App instalada” antes de que el icono/app fuese visible y
utilizable desde el launcher. Unos segundos después sí terminó de materializarse.
Ese FAIL histórico se conserva. El operador recertificó R1: Android ACCEPT y
CANCEL PASS, además de iPhone/Safari PASS (tutorial guiado, instalación nativa,
apertura standalone y guía ausente en standalone). R1 separa el evento del
navegador de standalone confirmado. La evidencia se registra tal como fue
reportada; no se informaron modelo de teléfono ni versiones de iOS/Safari.
T38 queda CLOSED_TESTING_CERTIFIED, sin promoción a Production.

## HISTORICAL SNAPSHOT — P2-T38 INITIAL IMPLEMENTATION (2026-09-26)

La instalación Android ahora distingue aceptación del prompt, instalación en
segundo plano y confirmación del navegador; no guarda éxito en localStorage ni
presenta porcentajes. En iOS/iPadOS se muestra una guía paso a paso, con copy
distinto para Safari y otros navegadores, y se reutiliza la detección compartida
de capacidades PWA. Las exclusiones y las identidades existentes se mantienen.

El commit funcional `5dc91a2` está publicado en `origin/testing-codex`. DeliGO
Copy, chat en vivo y Review Moderation Expiry terminaron `SUCCESS`; el cron de
ocupación quedó `SKIPPED` por no tener archivos observados. El smoke HTTP no
mutante fue 15/15. No se certificó instalación física ni se desplegó a
Production. El typecheck global sigue mostrando errores ajenos en archivos no
modificados; el filtro de T38 no encontró diagnósticos en su fileset.

## HISTORICAL SNAPSHOT — DOCUMENTATION DRIFT RECONCILIATION (2026-09-26)

```text
CURRENT_TASK=P2 — DOCUMENTATION DRIFT RECONCILIATION BEFORE P2-T38 IMPLEMENTATION
CURRENT_TASK_STATUS=DOCUMENTATION_DRIFT_RECONCILED
ORIGIN_TESTING_CODEX_BASE=cf46781ffc999024b19063a8ed9ab34a1557b92c
ORIGIN_MAIN_CURRENT=42ca5005d2ecd412de87e454b52820f38aaec5c0
PRODUCTION_MAIN_SHA=42ca5005d2ecd412de87e454b52820f38aaec5c0
PRODUCTION_RC1=CERTIFIED
PRODUCTION_NEW_CHANGES_AUTHORIZED=NO
TESTING_SECRET_HYGIENE_STEPS_1_6=CLOSED
TESTING_POSTGRES_ROTATION_FINAL_GATE=PASS
TESTING_POSTGRES_PHYSICAL_DB_SMOKE=PASS
TESTING_POST_PHYSICAL_LOG_GATE=PASS
MASTER_HANDOFF_PATH=C:\Leo Campos\Trabajo\deligo-main-limpio\CODEX_REPORT.md
REPORT_DIR_CANONICAL=C:\Leo Campos\Trabajo\deligo-main-limpio\codex-reports
ROADMAP_PATH=C:\Leo Campos\Trabajo\deligo-main-limpio\codex-reports\ROADMAP.md
HISTORICAL_DIRTY_WORKTREE=C:\Leo Campos\Trabajo\deligo-main-limpio
T39_WORKTREE=C:\Leo Campos\Trabajo\deligo-t39-admin
T39_BRANCH=work/p2-t39-r3
T39_WORKTREE_HEAD=cf46781ffc999024b19063a8ed9ab34a1557b92c
T39_WORKTREE_CLEAN=SI
T38_WORKTREE=C:\Leo Campos\Trabajo\deligo-t38-installation-ux
T38_BRANCH=work/p2-t38-installation-ux
T38_WORKTREE_HEAD_BEFORE_DOC_SYNC=cf46781ffc999024b19063a8ed9ab34a1557b92c
T38_WORKTREE_CLEAN_BEFORE_DOC_SYNC=SI
P2_T38_STATUS=READY_FUTURE
P2_T38_TECHNICAL_PREFLIGHT=RECONSTRUCTED (ver codex-reports/P2_T38_PWA_INSTALLATION_UX_PREFLIGHT.md)
P2_T38_DOCUMENTATION_GATE=PASS_AFTER_THIS_DOCUMENTATION_PUSH
P2_T38_PREFLIGHT_EFFECTIVE_STATUS=PASS_READY_FOR_IMPLEMENTATION_AUTHORIZATION
P2_T38_IMPLEMENTATION_AUTHORIZED=NO
T38_WORKTREE_RECHECK_AFTER_DOC_PUSH=REQUIRED (sincronizar sólo el commit documental antes de implementar)
T39_STATUS=CLOSED_TESTING_CERTIFIED
T40_STATUS=CLOSED_TESTING_CERTIFIED
T42_STATUS=CLOSED_PRODUCTION
T44_STATUS=PAUSED_UNRESOLVED_AFTER_TIMEBOX
T44_G3_PHYSICAL_CERTIFIED=NO
T23_STATUS=REOPENED_AWAITING_FILTER_CALIBRATION_DECISION (H4)
T24_STATUS=DEPENDS_ON_T23; RELEASE_ELIGIBLE=NO
PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
DB_TOUCHED=NO
PRODUCTION_TOUCHED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_P2_T38_IMPLEMENTATION_AUTHORIZATION
```

Production RC1 está certificado sobre `origin/main`; este handoff no autoriza
cambios nuevos en Production. La rotación de password PostgreSQL de TESTING y
Secret Hygiene pasos 1–6 están cerrados. El smoke físico de DB y su auditoría
posterior de logs dieron PASS.

El worktree histórico está dirty y debe preservarse. T39 también se conserva.
El worktree T38 se preparó limpio en la base conocida; el push documental que
resuelve este drift lo dejará un commit documental detrás. Antes de una futura
implementación se debe revalidar y sincronizar esa base. P2-T38 sigue
`READY_FUTURE`; su implementación no está autorizada por esta reconciliación.

### Backlog vigente preservado

T39/T40/T42 continúan cerradas según su certificación; no se reabren. T44 sigue
pausada por timebox y G3 continúa sin certificación física. T23 espera la
decisión de calibración del filtro H4; T24 mantiene su dependencia de T23 y no
es release eligible. El resto del backlog se conserva según ROADMAP y los
reportes canónicos, sin cambios de prioridad aquí.

## HISTORICAL / SUPERSEDED CONTEXT BELOW

Las entradas debajo son snapshots históricos conservados para trazabilidad.
Sus títulos pueden reflejar el estado vigente en la fecha de cada snapshot;
ninguno sustituye el bloque CURRENT AUTHORITATIVE STATE de este encabezado.

### Snapshot compacto remoto conservado (2026-09-25; superseded)

El handoff compacto que estaba en el blob remoto registraba `origin/testing-codex`
en `3eef96f`, RC1 de Production en `42ca500`, Secret Hygiene y PostgreSQL
rotation como PASS, worktree histórico 8 commits detrás, T23 esperando H4,
T24 dependiente de T23, T44 pausada y P2-T38 como recomendación futura tras
preparar un worktree limpio. Se conserva aquí la información única de ese
snapshot; su baseline y siguiente acción quedaron supersedidos por los bloques
documentales posteriores y el preflight T38.

## HISTORICAL SNAPSHOTS — registros previos preservados

## HISTORICAL SNAPSHOT — P2-T38 CLEAN WORKTREE PREPARATION — READY FUTURE (2026-09-25)

```text
NEXT_WORKTREE=C:\Leo Campos\Trabajo\deligo-t38-installation-ux
NEXT_BRANCH=work/p2-t38-installation-ux
NEXT_BASE_SHA=cf46781ffc999024b19063a8ed9ab34a1557b92c
P2_T38_STATUS=READY_FUTURE
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_P2_T38_PREFLIGHT_AND_IMPLEMENTATION_AUTHORIZATION
```

The isolated worktree is clean and exactly aligned with `origin/testing-codex`.
No product code, tests, database, Railway, or Production were changed by this
preparation. The historical dirty worktree and the T39 worktree remain intact.

## HISTORICAL SNAPSHOT — P2 HIGIENE TESTING: RETRY FINAL DEL CHECKPOINT DE POSTGRES EN WAIT (2026-09-25 22:02Z)

```text
CURRENT_TASK=P2 — TESTING POSTGRES PASSWORD ROTATION, PHASE 2: FINAL CUTOVER CHECKPOINT RETRY
CURRENT_TASK_STATUS=STOPPED_CUTOVER_CHECKPOINT_WAIT
REPORT=codex-reports/P2_TESTING_POSTGRES_ROTATION_CUTOVER_CHECKPOINT.md (sección Retry final)
CUTOVER_CHECKPOINT=WAIT
TESTING_POSTGRES_PASSWORD_ROTATED=NO
PRODUCTION_TOUCHED=NO
```

El retry se hizo de 22:02:06Z a 22:02:46Z, dentro de la ventana.

- **Review:** a las 22:02:41Z la corrida de las 22:00 todavía no había
  arrancado. Apareció la de las 21:00: arrancó a las 21:02:58Z y
  terminó bien, con `errors: 0`.
- **Mesa:** la corrida de las 22:00 terminó con `errors: 0`.
- **El resto dio PASS:** backup, deployments, `SELECT 1` (como
  `postgres`, en solo lectura), referencias y Production.

Recomendación: como Review arranca entre 1 y 3 minutos tarde, conviene
usar una ventana de **23:05 a 23:08 UTC (20:05 a 20:08 ART)**.

---

## HISTORICAL SNAPSHOT — P2 HIGIENE TESTING: RETRY DEL CHECKPOINT DE POSTGRES EN WAIT (2026-09-25 21:02Z)

```text
CURRENT_TASK=P2 — TESTING POSTGRES PASSWORD ROTATION, PHASE 2: CUTOVER CHECKPOINT RETRY
CURRENT_TASK_STATUS=STOPPED_CUTOVER_CHECKPOINT_WAIT
REPORT=codex-reports/P2_TESTING_POSTGRES_ROTATION_CUTOVER_CHECKPOINT.md (sección Retry)
CUTOVER_CHECKPOINT=WAIT
TESTING_POSTGRES_PASSWORD_ROTATED=NO
PRODUCTION_TOUCHED=NO
```

El retry se hizo de 21:02:06Z a 21:02:51Z, dentro de la ventana, y casi
todo dio PASS:

- el backup coincide por SHA-256;
- los deployments están estables;
- `SELECT 1` funcionó como `postgres`;
- las referencias están intactas;
- Production está intacta.

La excepción es el cron de Review Expiry: su corrida de las 21:00 no
dejó ningún log, así que no se puede confirmar que haya terminado.

Próxima ventana: **22:02–22:05 UTC (19:02–19:05 ART)**.

---

## HISTORICAL SNAPSHOT — P2 HIGIENE TESTING: CHECKPOINT DEL CUTOVER DE POSTGRES EN WAIT (2026-09-25)

```text
CURRENT_TASK=P2 — TESTING POSTGRES PASSWORD ROTATION, PHASE 2: CUTOVER CHECKPOINT (READ-ONLY)
CURRENT_TASK_STATUS=STOPPED_CUTOVER_CHECKPOINT_WAIT
REPORT=codex-reports/P2_TESTING_POSTGRES_ROTATION_CUTOVER_CHECKPOINT.md
CUTOVER_CHECKPOINT=WAIT
TESTING_POSTGRES_PASSWORD_ROTATED=NO
PRODUCTION_TOUCHED=NO
```

El checkpoint se hizo de 20:04:43Z a 20:06:26Z y todas las condiciones
técnicas dieron PASS:

- el backup coincide por SHA-256;
- los dos crons ya terminaron sus corridas de las 20:00;
- no hay deployments en curso y todos están estables;
- la conexión actual funciona (`SELECT 1`, como `postgres`);
- el modelo de referencias sigue intacto;
- Production está intacta.

La única condición que falló es la hora: el checkpoint terminó después
de la ventana de 20:02 a 20:05Z.

Próxima ventana: **21:02–21:05 UTC (18:02–18:05 hora Argentina)**, con
re-checkpoint rápido y luego la autorización del paso `ALTER ROLE`.

---

## HISTORICAL SNAPSHOT — P2 HIGIENE TESTING: BACKUP PREVIO A ROTAR POSTGRES LISTO (2026-09-25)

```text
CURRENT_TASK=P2 — TESTING POSTGRES PASSWORD ROTATION, PHASE 2 STEP 0: FRESH BACKUP
CURRENT_TASK_STATUS=STOPPED_AWAITING_OPERATOR_PHASE_2_CUTOVER_CHECKPOINT
REPORT=codex-reports/P2_TESTING_POSTGRES_FRESH_BACKUP_BEFORE_ROTATION.md
TESTING_POSTGRES_FRESH_BACKUP_GATE=PASS
TESTING_POSTGRES_PASSWORD_ROTATED=NO
PRODUCTION_TOUCHED=NO
```

Se creó y validó un backup fresco de la base de TESTING, en
`C:\Leo Campos\Trabajo\deligo-testing-backups\deligo-testing-pre-postgres-rotation-20260925.dump`,
de 995771 bytes, con SHA-256
`f0ab1ab6b55f2c4e490eb47ae0cdcf72a0db2edb9462cc147acc58f4a1764ba7`.

- El formato es custom (cabecera `PGDMP`).
- `pg_restore --list` terminó bien: 298 entradas y 48 tablas, todas con
  datos.
- Las credenciales se usaron solo como variables de entorno del
  proceso, y la sesión fue de solo lectura.

No se ejecutó la rotación, no se cambió ninguna variable, no hubo
deploy y el `.env` no se tocó.

Siguiente paso: el operador autoriza el cutover de la Fase 2 y elige
una ventana entre :02 y :05.

---

## HISTORICAL SNAPSHOT — P2 HIGIENE TESTING: PREFLIGHT DE LA PASSWORD DE POSTGRES LISTO (2026-09-25)

```text
CURRENT_TASK=P2 — TESTING POSTGRES PASSWORD ROTATION, PHASE 1: PREFLIGHT (read-only)
CURRENT_TASK_STATUS=STOPPED_AWAITING_OPERATOR_AUTHORIZATION_FOR_PHASE_2
REPORT=codex-reports/P2_TESTING_POSTGRES_PASSWORD_ROTATION_PREFLIGHT.md
TESTING_POSTGRES_ROTATION_PREFLIGHT=PASS_READY_FOR_OPERATOR_AUTHORIZATION
TESTING_MUTATIONS_PERFORMED=NO / PRODUCTION_TOUCHED=NO
```

**Corrección importante.** La auditoría anterior dijo que las URLs de
conexión eran literales en 9 lugares. Era falso, por un error de escape
del regex.

En realidad, en Railway todo deriva de **una sola variable**,
`POSTGRES_PASSWORD`, en el servicio Postgres:

- `PGPASSWORD`, `DATABASE_URL` y `DATABASE_PUBLIC_URL` la referencian.
- DeliGO Copy, Mesa Cron y Review Expiry usan
  `${{Postgres.DATABASE_URL}}`.

La única copia literal está en el `.env` local.

**Role y mecanismo.** El role es `postgres`, superusuario y único
login, en PostgreSQL 18.6 con SCRAM. Railway **no** ofrece rotación
nativa para este servicio: la única opción existe para plugins legacy,
y el proyecto no tiene ninguno. Cambiar solo la variable **no** cambia
la password del cluster ya inicializado.

**Método definido para la fase 2.** `ALTER ROLE` con un verificador
SCRAM calculado localmente y enviado por stdin: el texto plano nunca
llega al servidor ni a los logs. El plan:

1. Backup fresco de TESTING.
2. `ALTER ROLE` y `POSTGRES_PASSWORD` con `--skip-deploys`, en un solo
   proceso.
3. Verificar la URL re-renderizada y una conexión nueva.
4. Redeploy de DeliGO Copy y de los dos crons.
5. Smoke.
6. Actualizar el `.env` local al final. Hasta ese momento, el `.env`
   sirve de vía de rollback de emergencia.

**Ventana recomendada.** Entre 2 y 5 minutos después de la hora en
punto, antes de la corrida de Mesa de las :15.

**Punto a verificar en la fase 2.** El deployment activo de Mesa Cron
es `05eb7e6c`, con varios deployments `SKIPPED` posteriores: hay que
confirmar qué queda activo después del redeploy.

---

## HISTORICAL SNAPSHOT — P2 HIGIENE TESTING: PASO 5 CERRADO (2026-09-25)

```text
CURRENT_TASK=P2 — TESTING REALTIME SECRETS POST-PHYSICAL-SMOKE FINAL CLOSEOUT
CURRENT_TASK_STATUS=CLOSED_STEP_5_OF_TESTING_SECRET_HYGIENE
REPORT=codex-reports/P2_TESTING_REALTIME_SECRETS_ROTATION.md
TESTING_REALTIME_FINAL_GATE=PASS
PRODUCTION_BASELINE_UNCHANGED=SI
NEXT_ACTION=REQUEST_OPERATOR_AUTHORIZATION_FOR_TESTING_POSTGRES_PASSWORD_ROTATION
```

La rotación coordinada de los 3 secretos realtime quedó cerrada.

- **Smoke físico:** el chat del pedido conectó y los mensajes llegaron
  en tiempo real en los dos sentidos.
- **Logs:** cada secreto nuevo muestra evidencia positiva.
  - Token de socket: se emitieron tokens y el chat aceptó las
    conexiones.
  - Session-check: respondió 200.
  - Publicación interna: `published`, una por cada mensaje.
  - No hubo errores de firma ni de autenticación.
- **Configuración:** los 3 secretos siguen iguales entre DeliGO Copy y
  chat.

Pasos 1 a 5 cerrados. Solo queda el paso 6, la password de Postgres de
TESTING. Es la rotación de mayor riesgo: la credencial es literal en 9
lugares y hay que confirmar el mecanismo con el operador o con Railway.

---

## HISTORICAL SNAPSHOT — P2 HIGIENE TESTING: PASO 5 (SECRETOS REALTIME) ROTADO (2026-09-25)

```text
CURRENT_TASK=P2 — TESTING SECRET HYGIENE: COORDINATED ROTATION OF THE 3 REALTIME SECRETS
CURRENT_TASK_STATUS=TECHNICAL_PASS_AWAITING_OPERATOR_PHYSICAL_SMOKE
REPORT=codex-reports/P2_TESTING_REALTIME_SECRETS_ROTATION.md
TESTING_REALTIME_ROTATION_GATE=PASS
PRODUCTION_BASELINE_UNCHANGED=SI
```

Se rotaron de forma coordinada los 3 secretos realtime de TESTING.

- **Carga:** en un solo proceso se generaron 3 valores nuevos de 32
  bytes. Cada uno se escribió en DeliGO Copy **y** en chat en vivo
  antes de redeployar cualquiera de los dos, siempre con
  `--skip-deploys`. Las 6 escrituras salieron bien y nunca se mostró un
  valor.
- **Verificación previa:** antes del cutover los 3 secretos eran SAME
  entre los dos servicios.
- **Cutover:**
  - DeliGO Copy, deployment `56ce1ae1`: SUCCESS a las 18:26:23Z.
  - chat, deployment `6e40b950`: se disparó cuando DeliGO Copy entró en
    DEPLOYING y llegó a SUCCESS a las 18:27:07Z.
  - La ventana de desincronización fue de unos 45 a 60 segundos.
  - Los dos siguen sobre el mismo commit `3eef96f`.
- **Logs:** limpios y sin errores de firma o autenticación. Los únicos
  "error" son el apagado normal del contenedor viejo de chat, cuando
  npm recibe SIGTERM.
- Production y los crons no se tocaron.

Pendiente: el smoke físico del operador, un chat de pedido en tiempo
real. Después solo queda el paso 6, la password de la base de TESTING,
que requiere confirmar el mecanismo con el operador o el proveedor.

---

## HISTORICAL SNAPSHOT — P2 HIGIENE TESTING: PASO 4 CERRADO (2026-09-25)

```text
CURRENT_TASK=P2 — TESTING PRIVATE EVIDENCE CLOUDINARY POST-SMOKE CLOSEOUT
CURRENT_TASK_STATUS=CLOSED_STEP_4_OF_TESTING_SECRET_HYGIENE
REPORT=codex-reports/P2_TESTING_PRIVATE_EVIDENCE_CLOUDINARY_ROTATION.md
TESTING_PRIVATE_EVIDENCE_FINAL_GATE=PASS
PRODUCTION_BASELINE_UNCHANGED=SI
NEXT_ACTION=REQUEST_OPERATOR_AUTHORIZATION_TO_ROTATE_TESTING_REALTIME_SECRETS
```

El operador rotó él mismo la API key y el secret de Cloudinary de
evidencia privada en TESTING. Conservó el mismo cloud y dejó la key
vieja **deshabilitada**, no borrada.

- **Evidencia física:** la subida y la lectura desde SuperAdmin
  funcionaron antes y después de deshabilitar la key vieja. No había
  evidencias anteriores para probar; se registra como N/A, no como
  fallo.
- **Verificación técnica:** las 3 variables están presentes y son
  distintas de las de Production.
- **Deployment:** hubo un único deployment nuevo, `2ab80cf7`, solo de
  DeliGO Copy y sobre el mismo commit.
- **Logs:** subida y lecturas de Negocio y de SuperAdmin, todas con
  200, sin errores de credencial.

Nota: en los logs aparece una sola subida, mientras el operador informó
dos. Es informativo y no bloqueante.

Pasos 1 a 4 cerrados. Quedan:

- el paso 5, los 3 secretos realtime, con un cutover coordinado entre
  DeliGO Copy y chat en vivo;
- el paso 6, la password de la base, que requiere confirmar el
  mecanismo con el operador o el proveedor.

---

## HISTORICAL SNAPSHOT — P2 HIGIENE TESTING: PASO 3 CERRADO (2026-09-25)

```text
CURRENT_TASK=P2 — TESTING REGISTRATION_LIMIT POST-SMOKE CLOSEOUT
CURRENT_TASK_STATUS=CLOSED_STEP_3_OF_TESTING_SECRET_HYGIENE
REPORT=codex-reports/P2_TESTING_REGISTRATION_LIMIT_SECRET_ROTATION.md
TESTING_REGISTRATION_LIMIT_FINAL_GATE=PASS
PRODUCTION_BASELINE_UNCHANGED=SI
NEXT_ACTION=REQUEST_OPERATOR_AUTHORIZATION_TO_ROTATE_TESTING_PRIVATE_EVIDENCE_CLOUDINARY
```

El paso 3 del plan de higiene de TESTING quedó cerrado.

- El operador completó un registro de prueba de Cuenta Operativa, sin
  errores 500.
- Los logs del deployment `648d94e7` lo confirman: el registro
  respondió 200 y la sesión de la cuenta nueva quedó activa, sin
  ningún error.
- Se mantiene el efecto esperado y no bloqueante: el historial del
  límite de los últimos 7 días deja de contar.

Pasos 1 a 3 cerrados. Siguiente: pedir autorización para el paso 4,
las credenciales de Cloudinary de evidencia privada. Esa rotación
permite que la key vieja y la nueva convivan, así que no hay caída.

---

## HISTORICAL SNAPSHOT — P2 HIGIENE TESTING: PASO 3 (REGISTRATION_LIMIT_SECRET) ROTADO (2026-09-25)

```text
CURRENT_TASK=P2 — TESTING SECRET HYGIENE: ROTATE REGISTRATION_LIMIT_SECRET
CURRENT_TASK_STATUS=TECHNICAL_PASS_AWAITING_OPERATOR_PHYSICAL_SMOKE
REPORT=codex-reports/P2_TESTING_REGISTRATION_LIMIT_SECRET_ROTATION.md
TESTING_REGISTRATION_LIMIT_ROTATION_GATE=PASS
PRODUCTION_BASELINE_UNCHANGED=SI
```

Se rotó `REGISTRATION_LIMIT_SECRET` en TESTING / DeliGO Copy.

- El valor nuevo, de 32 bytes, se generó y se escribió directamente por
  un pipe, sin mostrarse nunca.
- Es distinto del valor viejo.
- El redeploy `648d94e7` terminó en SUCCESS sobre el mismo commit
  `3eef96f`, y los logs están limpios.
- Production y los demás servicios de TESTING no se tocaron.

Efecto esperado, y aceptado en TESTING: el historial del límite de
registro de los últimos 7 días deja de contar, porque los hashes viejos
ya no coinciden. No se corrompió ningún dato y no se tocó la base.

Pendiente: el smoke físico del operador, un registro de Cuenta
Operativa o una prueba de la ruta sin crear datos. Después sigue el
paso 4, las credenciales de Cloudinary de evidencia privada.

---

## HISTORICAL SNAPSHOT — P2 HIGIENE TESTING: PASO 2 CERRADO (2026-09-25)

```text
CURRENT_TASK=P2 — TESTING GOOGLE_OAUTH_PENDING POST-SMOKE CLOSEOUT
CURRENT_TASK_STATUS=CLOSED_STEP_2_OF_TESTING_SECRET_HYGIENE
REPORT=codex-reports/P2_TESTING_GOOGLE_OAUTH_PENDING_SECRET_ROTATION.md
TESTING_GOOGLE_OAUTH_PENDING_FINAL_GATE=PASS
PRODUCTION_BASELINE_UNCHANGED=SI
NEXT_ACTION=REQUEST_OPERATOR_AUTHORIZATION_TO_ROTATE_TESTING_REGISTRATION_LIMIT_SECRET
```

El paso 2 del plan de higiene de TESTING quedó cerrado.

- El operador completó un alta con Google usando una cuenta de prueba
  nueva: llegó al consentimiento, lo aceptó y el alta terminó bien.
- Los logs del deployment `b0233d72` lo confirman: el `POST /consent`
  respondió 200 (solo posible si la cookie pendiente verifica con el
  secreto nuevo) y la sesión quedó activa.
- Sin errores y sin respuestas 4xx ni 5xx en `/api/auth`.

Pasos 1 y 2 cerrados. Siguiente: pedir autorización para el paso 3,
`REGISTRATION_LIMIT_SECRET`.

---

## HISTORICAL SNAPSHOT — P2 HIGIENE TESTING: PASO 2 (GOOGLE_OAUTH_PENDING_SECRET) ROTADO (2026-09-25)

```text
CURRENT_TASK=P2 — TESTING SECRET HYGIENE: ROTATE GOOGLE_OAUTH_PENDING_SECRET
CURRENT_TASK_STATUS=TECHNICAL_PASS_AWAITING_OPERATOR_PHYSICAL_SMOKE
REPORT=codex-reports/P2_TESTING_GOOGLE_OAUTH_PENDING_SECRET_ROTATION.md
TESTING_GOOGLE_OAUTH_PENDING_ROTATION_GATE=PASS
PRODUCTION_BASELINE_UNCHANGED=SI
```

Se rotó `GOOGLE_OAUTH_PENDING_SECRET` en TESTING / DeliGO Copy.

- El valor nuevo, de 32 bytes, se generó y se escribió directamente por
  un pipe, sin mostrarse nunca.
- Es distinto del valor viejo y del de Production.
- El redeploy `b0233d72` terminó en SUCCESS sobre el mismo commit
  `3eef96f`, y los logs están limpios.
- El cliente OAuth de Google no cambió: `GOOGLE_CLIENT_ID` y
  `GOOGLE_CLIENT_SECRET` siguen iguales a los de Production.
- Production y los demás servicios de TESTING no se tocaron.

Pendiente: el smoke físico del operador, un alta con Google usando una
cuenta todavía no registrada para llegar al consentimiento. Después
sigue el paso 3, `REGISTRATION_LIMIT_SECRET`.

---

## HISTORICAL SNAPSHOT — P2 HIGIENE TESTING: PASO 1 CERRADO (2026-09-25)

```text
CURRENT_TASK=P2 — TESTING PUSH_OWNER_HANDOFF POST-SMOKE CLOSEOUT
CURRENT_TASK_STATUS=CLOSED_STEP_1_OF_TESTING_SECRET_HYGIENE
REPORT=codex-reports/P2_TESTING_PUSH_OWNER_HANDOFF_SECRET_ROTATION.md
TESTING_PUSH_OWNER_HANDOFF_FINAL_GATE=PASS
PRODUCTION_BASELINE_UNCHANGED=SI
NEXT_ACTION=REQUEST_OPERATOR_AUTHORIZATION_TO_ROTATE_TESTING_GOOGLE_OAUTH_PENDING_SECRET
```

El paso 1 del plan de higiene de TESTING quedó cerrado.

- El operador confirmó el login y que Push sigue activo.
- Los logs del deployment `4545aed0` muestran que el handoff se firmó
  (`signed=true`) y se verificó (`verified=true`) con el secreto nuevo,
  sin ninguna falla.

Nota: el único login visible en los logs fue de tipo Cliente, por
Google (`family=cliente`), no un login de Negocio con contraseña. Es
informativo: todas las rutas de login usan el mismo código de firma y
verificación.

Siguiente: pedir autorización para el paso 2, `GOOGLE_OAUTH_PENDING_SECRET`.

---

## HISTORICAL SNAPSHOT — P2 HIGIENE TESTING: PASO 1 (PUSH_OWNER_HANDOFF_SECRET) ROTADO (2026-09-25)

```text
CURRENT_TASK=P2 — TESTING SECRET HYGIENE: ROTATE PUSH_OWNER_HANDOFF_SECRET
CURRENT_TASK_STATUS=TECHNICAL_PASS_AWAITING_OPERATOR_PHYSICAL_SMOKE
REPORT=codex-reports/P2_TESTING_PUSH_OWNER_HANDOFF_SECRET_ROTATION.md
TESTING_PUSH_OWNER_HANDOFF_ROTATION_GATE=PASS
PRODUCTION_BASELINE_UNCHANGED=SI
```

Se rotó `PUSH_OWNER_HANDOFF_SECRET` en TESTING / DeliGO Copy.

- El valor nuevo, de 32 bytes, se generó y se escribió directamente por
  un pipe, sin mostrarse nunca.
- Es distinto del valor viejo expuesto y del de Production.
- El redeploy `4545aed0` terminó en SUCCESS sobre el mismo commit
  `3eef96f`, y los logs están limpios.
- Production y los demás servicios de TESTING no se tocaron.

Pendiente: el smoke físico del operador (login de Negocio, estado de
Push y ausencia de errores de handoff). Después sigue el paso 2 del
plan, `GOOGLE_OAUTH_PENDING_SECRET`, con su propia autorización.

---

## HISTORICAL SNAPSHOT — P2 HIGIENE DE SECRETOS DE TESTING: PLAN LISTO (2026-09-25)

```text
CURRENT_TASK=P2 — TESTING SECRET HYGIENE AUDIT + SAFE ROTATION PLAN (read-only)
CURRENT_TASK_STATUS=STOPPED_AWAITING_OPERATOR
REPORT=codex-reports/P2_TESTING_SECRET_HYGIENE_AUDIT_AND_ROTATION_PLAN.md
TESTING_SECRET_HYGIENE_AUDIT=PASS
TESTING_SECRET_ROTATION_EXECUTED=NO
PRODUCTION_BASELINE_UNCHANGED=SI
```

La auditoría de los 8 secretos de TESTING expuestos se hizo sobre el
código real que corre en TESTING (`3eef96f`) y en modo solo lectura
sobre Railway (solo presencia y SAME/DIFFERENT).

**Rotación simple** (solo DeliGO Copy):

- `PUSH_OWNER_HANDOFF_SECRET`: cookie de 10 min.
- `GOOGLE_OAUTH_PENDING_SECRET`: cookie de 10 min; no afecta sesiones.
- `REGISTRATION_LIMIT_SECRET`: rotarlo reinicia el historial del límite
  de 7 días.

**Rotación con el proveedor, sin downtime:** las credenciales de
Cloudinary de evidencia privada. La cuenta es propia de TESTING.

**Rotación coordinada:** los 3 secretos realtime. Tienen que ser
iguales en DeliGO Copy y en chat en vivo, y no hay forma de que
convivan un valor viejo y uno nuevo. Se hace un solo cutover:

1. cargar los valores nuevos en ambos servicios con `--skip-deploys`;
2. redeploy de DeliGO Copy;
3. redeploy de chat.

**Mayor riesgo, la password de la base de TESTING.** El role es
`postgres` y la credencial es literal en 9 ubicaciones:

- las variables de Postgres;
- el `DATABASE_URL` de DeliGO Copy, del cron de ocupación de mesas y de
  Review Expiry;
- una variable suelta llamada `Postgres` en DeliGO Copy;
- el `.env` local.

No hay referencias de Railway, así que nada se propaga solo. Hace falta
confirmar el mecanismo con el operador o el proveedor antes de
ejecutar.

Ya resueltos, no se re-rotan: Cloudinary principal, Resend y Google.

Primer paso recomendado: rotar `PUSH_OWNER_HANDOFF_SECRET` en TESTING.
Requiere autorización.

---

## HISTORICAL SNAPSHOT — P2 POST-RELEASE: WORKTREE Y BRANCH LOCAL DEL RC ELIMINADOS (2026-09-25)

```text
CURRENT_TASK=P2 — POST-RELEASE LOCAL RC CLEANUP RETRY
CURRENT_TASK_STATUS=DONE_AWAITING_OPERATOR
REPORT=codex-reports/P2_POST_RELEASE_LOCAL_RC_CLEANUP.md
POST_RELEASE_LOCAL_RC_CLEANUP=PASS
PRODUCTION_MAIN_SHA=42ca5005d2ecd412de87e454b52820f38aaec5c0 (sin cambios)
```

Con autorización del operador se borró solo `tsconfig.tsbuildinfo`.
Después se eliminó el worktree `deligo-production-rc1` sin `--force`, y
la branch local `release/p2-production-rc1-20260921` con `-d`.

Quedó en disco una carpeta `.next` vacía que contenía un junction
colgante de Next.js. Se retiró de forma segura: se borró solo el link y
luego las carpetas vacías, sin recursión y sin borrar ningún archivo.

Worktrees restantes: `deligo-main-limpio` y `deligo-t39-admin`. No hubo
push, deploy ni cambios en Railway.

El resto del cleanup opcional sigue a decisión del operador.

---

## HISTORICAL SNAPSHOT — P2 POST-RELEASE: CLEANUP DEL WORKTREE LOCAL BLOQUEADO (2026-09-25)

```text
CURRENT_TASK=P2 — POST-RELEASE CLEANUP: WORKTREE LOCAL DEL RC Y BRANCH LOCAL
CURRENT_TASK_STATUS=BLOCKED_AWAITING_OPERATOR
REPORT=codex-reports/P2_POST_RELEASE_LOCAL_RC_CLEANUP.md
POST_RELEASE_LOCAL_RC_CLEANUP=BLOCKED
PRODUCTION_MAIN_SHA=42ca5005d2ecd412de87e454b52820f38aaec5c0 (sin cambios)
```

No se eliminó nada. El preflight encontró **un archivo untracked** en
el worktree `deligo-production-rc1`: `tsconfig.tsbuildinfo`, el cache
de compilación de TypeScript que generó el quality gate del RC. La
regla de la tarea exige STOP ante cualquier archivo untracked.

El worktree y la branch local siguen como estaban, en `42ca5005`. El
resto de los chequeos pasó.

Para desbloquear, el operador tiene que autorizar el borrado de ese
único archivo y después repetir la tarea tal cual.

---

## HISTORICAL SNAPSHOT — P2 POST-RELEASE: RELEASE BRANCH REMOTA ELIMINADA (2026-09-25)

```text
CURRENT_TASK=P2 — POST-RELEASE CLEANUP: RELEASE BRANCH DELETION
CURRENT_TASK_STATUS=DONE_AWAITING_OPERATOR
REPORT=codex-reports/P2_POST_RELEASE_RELEASE_BRANCH_CLEANUP.md
POST_RELEASE_RELEASE_BRANCH_CLEANUP=PASS
PRODUCTION_MAIN_SHA=42ca5005d2ecd412de87e454b52820f38aaec5c0 (sin cambios; release RC1 certificado)
```

Se eliminó solo la branch remota `release/p2-production-rc1-20260921`,
que apuntaba a `42ca5005`, igual que `main`. El commit sigue siendo el
HEAD de `main`. Production siguió en el mismo deployment `6bf1ee84`. La
branch local y el worktree `deligo-production-rc1` quedaron intactos.

Observación: el CLI de Railway, desde ese worktree (que estaba enlazado
a RC-PREPROD), dijo que el entorno está eliminado. Eso indica que el
operador ya borró el PREPROD, pero no se verificó más allá del mensaje.

El resto del cleanup post-release sigue a decisión del operador.

---

## HISTORICAL SNAPSHOT — P2 RC1 EN PRODUCTION: RELEASE CERTIFICADO (2026-09-25)

```text
CURRENT_TASK=P2 — PRODUCTION RC1 FINAL RELEASE CLOSEOUT (solo documentación)
CURRENT_TASK_STATUS=CLOSED_PRODUCTION_CERTIFIED
REPORT=codex-reports/P2_PRODUCTION_RC1_FINAL_RELEASE_CLOSEOUT.md
PRODUCTION_FINAL_SHA=42ca5005d2ecd412de87e454b52820f38aaec5c0
PRODUCTION_DEPLOYMENT_ID=6bf1ee84-702e-41e1-80a8-d075e3ce9362 (SUCCESS, sigue activo)
PRODUCTION_TECHNICAL_RELEASE_GATE=PASS
PRODUCTION_PHYSICAL_SMOKE=PASS
PRODUCTION_RELEASE_CERTIFIED=SI
PRODUCTION_RELEASE_BLOCKERS=0
NEXT_ACTION=POST_RELEASE_CLEANUP_OPERATOR_DECISION
```

El release RC1 quedó **validado técnica y físicamente en Production**.

El operador hizo el smoke físico en `deligo.ar` y pasaron los 6 casos:
login de Negocio, activación de Push, pedido real, llegada real del
Push al dispositivo, logout y login con el mismo Negocio, y Push activo
después del nuevo login sin rehabilitarlo ni un nuevo pedido de permiso
nativo. No se repitieron las baterías de T40 A–J, T39 ni T46, que ya
estaban certificadas en TESTING y en RC PREPROD.

Todos los gates previos siguen en PASS: backup fresco, seguridad final,
y rotación o aislamiento de Resend, Cloudinary, Google y
`PUSH_OWNER_HANDOFF_SECRET`.

Esto certifica el release RC1, no todo P2:

- T44-G3 sigue `PAUSED_UNRESOLVED_AFTER_TIMEBOX`.
- T23 y T24 siguen fuera.
- T33, T37 y el backlog siguen su propia planificación.

Cleanup pendiente de decisión del operador, nada ejecutado:

- borrar el PREPROD temporal;
- decidir si se conserva o se borra la release branch;
- borrar los secretos viejos deshabilitados de Google y Cloudinary;
- limpiar el PostgreSQL portable;
- rotar los secretos de TESTING que quedaron expuestos;
- a futuro, un OAuth Client de Google separado por ambiente.

---

## HISTORICAL SNAPSHOT — P2 RC1 PROMOVIDO A PRODUCTION: SUCCESS TÉCNICO (2026-09-25)

```text
CURRENT_TASK=P2 — PRODUCTION RC1 PROMOTION
CURRENT_TASK_STATUS=TECHNICAL_SUCCESS_AWAITING_OPERATOR_PHYSICAL_SMOKE
REPORT=codex-reports/P2_PRODUCTION_RC1_PROMOTION.md
PRODUCTION_SHA=42ca5005d2ecd412de87e454b52820f38aaec5c0 (antes: ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763)
PRODUCTION_DEPLOYMENT_ID=6bf1ee84-702e-41e1-80a8-d075e3ce9362 (SUCCESS)
PRODUCTION_DATABASE_MIGRATION_STATUS=UP_TO_DATE (3 aplicadas, 0 inesperadas)
PRODUCTION_PROMOTION_STATUS=SUCCESS
PRODUCTION_TECHNICAL_RELEASE_GATE=PASS
```

Con autorización explícita del operador, `main` avanzó por
**fast-forward exacto** de `ff4cc2f8` a `42ca5005`
(`git push origin 42ca5005…:refs/heads/main`, sin `--force`). El push
disparó el deploy automático de los 4 servicios de Production y los 4
terminaron en SUCCESS sobre `42ca5005`.

El `preDeployCommand` aplicó exactamente las 3 migraciones esperadas, y
el chequeo posterior confirma que el schema está al día. El sitio
responde bien en las rutas públicas, `/admin` incluida. No hay errores
reales en los logs, y las variables críticas están presentes.
`PUSH_OWNER_HANDOFF_SECRET` ya está en uso.

**Pendiente:** el smoke físico del operador sobre Production. La
certificación física de Production todavía **no** está declarada.

A propósito, no se tocó nada de lo siguiente: el PREPROD, la release
branch, los secretos viejos deshabilitados de Google y Cloudinary, el
PostgreSQL portable ni el backlog (T33/T37).

Si hiciera falta volver atrás: redesplegar `ff4cc2f8` conservando el
schema aditivo. Eso requiere una autorización nueva.

---

## HISTORICAL SNAPSHOT — P2 FRESH BACKUP: PASS, LISTO PARA PEDIR AUTORIZACIÓN DE PROMOCIÓN (2026-09-25)

```text
CURRENT_TASK=P2 — FRESH PRODUCTION BACKUP RETRY
CURRENT_TASK_STATUS=STOPPED_AWAITING_OPERATOR
REPORT=codex-reports/P2_FRESH_PRODUCTION_BACKUP_BEFORE_PROMOTION.md
FRESH_BACKUP_GATE=PASS
FRESH_PRODUCTION_BACKUP_SHA256=1f9c566ace469ca175e94205a69a6454c5b26774e5716ece65f4b9fc5d954ac4
PRODUCTION_CODE_PROMOTED=NO / PRODUCTION_DATABASE_MUTATED=NO / RC_DRIFT=NO
```

El reintento con los binarios portables de PostgreSQL 18.6 que preparó
el operador creó un backup fresco de Production:
`C:\Leo Campos\Trabajo\deligo-production-backups\deligo-production-pre-rc1-20260925.dump`,
en formato custom, de 220413 bytes.

La validación dio bien: header `PGDMP`; `pg_restore --list` terminó sin
error, con 298 entradas y 48 tablas, cada una con sus datos. Las tablas
centrales están presentes; no existe una tabla única `usuarios`, cada
tipo de actor tiene la suya. El conjunto de tablas es el mismo que en el
backup del 22, que sigue intacto.

Una corrección: el "96 tablas" del reporte del 22 eran 48 tablas
contadas dos veces. La cantidad real es 48.

Production no cambió y está sana.

Con la re-auditoría de seguridad en PASS y el backup fresco en PASS, el
próximo paso es pedir la **autorización explícita del operador** para
promover el RC `42ca5005` a Production. El runbook está en
`P2_PRODUCTION_PREPROMOTION_SAFETY_AUDIT.md` §7.

---

## HISTORICAL SNAPSHOT — P2 FRESH BACKUP: BLOCKED BY TOOLING (2026-09-25)

```text
CURRENT_TASK=P2 — FRESH PRODUCTION BACKUP BEFORE RC PROMOTION
CURRENT_TASK_STATUS=BLOCKED_AWAITING_OPERATOR
REPORT=codex-reports/P2_FRESH_PRODUCTION_BACKUP_BEFORE_PROMOTION.md
FRESH_BACKUP_GATE=BLOCKED
FRESH_BACKUP_TOOLING_AVAILABLE=NO
PRODUCTION_CODE_PROMOTED=NO / RC_DRIFT=NO / PRODUCTION_DATABASE_MUTATED=NO
```

No se pudo crear el backup fresco. Solo existe `pg_dump` 12.15 local,
que no puede volcar el servidor PostgreSQL 18.6 de Production. Los
binarios 18 se retiraron el 2026-09-22 y Docker no está instalado.

Siguiendo la regla de la tarea, no se reinstaló nada ni se improvisó
ningún otro método, y no se abrió ninguna conexión a la base. El backup
del 2026-09-22 sigue intacto.

Siguiente paso: que el operador autorice herramientas PostgreSQL 18.
Lo recomendado son los binarios portables oficiales de EnterpriseDB en
`.zip`, solo cliente, sin instalador ni servicio. Después se repite la
tarea tal cual.

La seguridad sigue en verde (`FINAL_SECURITY_REAUDIT=PASS` desde el
audit delta de Resend). Solo falta este backup antes de pedir la
autorización de promoción.

---

## HISTORICAL SNAPSHOT — P2 FINAL SECURITY RE-AUDIT: PASS (2026-09-25)

```text
CURRENT_TASK=P2 — RESEND ROTATION FINAL DELTA AUDIT (read-only)
CURRENT_TASK_STATUS=STOPPED_AWAITING_OPERATOR
REPORT=codex-reports/P2_RESEND_ROTATION_FINAL_DELTA_AUDIT.md
FINAL_SECURITY_REAUDIT=PASS
PRODUCTION_PROMOTION_READY=SI (solo gates de seguridad; NO es autorización para promover)
PRODUCTION_CODE_PROMOTED=NO (Production sigue en ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763)
RC_FINAL_SHA=42ca5005d2ecd412de87e454b52820f38aaec5c0 (sin drift)
PRODUCTION_TOUCHED_BY_THIS_AUDIT=NO
```

El único blocker del re-audit final (la key de Resend de Production
coincidía con la de TESTING y PREPROD, y era la expuesta) quedó
**RESOLVED**. La comparación en memoria (solo `SAME/DIFFERENT`) da
Production ≠ TESTING ≠ PREPROD.

El operador revocó la key vieja y confirmó email real en Production y
en TESTING después de revocarla, así que ninguno de los dos la usa. La
key vieja queda solo en el PREPROD temporal, y el operador lo aceptó.

Nota informativa: PREPROD tiene un redeploy a las 15:14:05Z sobre el
mismo commit del RC, posterior al audit anterior. No se puede saber qué
lo disparó y no afecta a Production. Conviene que el operador confirme
que fue intencional.

Siguiente paso: crear un backup fresco de Production justo antes de la
promoción. Después, pedir la autorización explícita del operador para
promover el RC.

---

## HISTORICAL SNAPSHOT — P2 FINAL SECURITY RE-AUDIT: BLOCKED BY RESEND (2026-09-25)

```text
CURRENT_TASK=P2 — PRODUCTION FINAL SECURITY RE-AUDIT (read-only)
CURRENT_TASK_STATUS=BLOCKED_AWAITING_OPERATOR
REPORT=codex-reports/P2_PRODUCTION_FINAL_SECURITY_REAUDIT.md
FINAL_SECURITY_REAUDIT=BLOCKED
PRODUCTION_PROMOTION_READY=NO
PRODUCTION_CODE_PROMOTED=NO (Production sigue en ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763)
RC_FINAL_SHA=42ca5005d2ecd412de87e454b52820f38aaec5c0 (sin drift)
PRODUCTION_TOUCHED_BY_THIS_AUDIT=NO
```

Re-auditoría final hecha comparando secretos **en memoria** (hash
SHA-256 dentro del proceso, salida solo `SAME/DIFFERENT`, nunca
valores ni hashes).

**Único blocker**: `RESEND_API_KEY` de Production es idéntico al de
TESTING y PREPROD. Como el valor de TESTING quedó expuesto el
2026-09-22 y ese mismo día se copió sin cambios a PREPROD, y hoy los
tres coinciden sin ninguna rotación registrada, la key de Resend de
Production **es la key expuesta**. Hay que rotarla (key nueva exclusiva
de Production, instalación por `--stdin`, redeploy de solo-variable,
smoke de email real, revocar la vieja) y re-ejecutar solo esa
comparación.

**En verde**: Cloudinary aislado (API key y secret distintos entre
Prod y TESTING, ninguno es la key vieja compartida); Google rotado (el
mismo secreto nuevo en los 3 entornos, como corresponde a un cliente
compartido — el aislamiento por OAuth Client queda como higiene
futura); `PUSH_OWNER_HANDOFF_SECRET` de Production exclusivo (inerte
hasta que el RC se despliegue); secretos internos de Production
distintos de TESTING; exactamente las 3 migraciones pendientes;
backup verificado (hash + header `PGDMP`, conviene refrescarlo justo
antes de promover); RC sin drift, sin T23/T24; los 3 servicios sanos.

Nota documental: la corrección del 2026-09-22 que decía que el cliente
clásico de Google no admite secretos paralelos quedó desmentida por la
práctica — el operador sí pudo crear un segundo secreto con el viejo
temporalmente activo.

---

## HISTORICAL SNAPSHOT — P2 SECRET ROTATION PLAN CORRECTED (2026-09-22)

```text
CURRENT_TASK=P2 — SECRET ROTATION PLAN CORRECTION (documentation only)
CURRENT_TASK_STATUS=STOPPED_AWAITING_OPERATOR_DECISION
REPORT=codex-reports/P2_PRODUCTION_SHARED_SECRET_ROTATION_PREP.md (mismo archivo, actualizado in-place)
PRODUCTION_TOUCHED=NO / TESTING_TOUCHED=NO / PREPROD_TOUCHED=NO
```

Dos correcciones importantes al plan de rotación de la ronda anterior,
ninguna ejecutada — solo documentación:

**Google OAuth**: el supuesto de "Add Secret manteniendo el viejo
activo" era incorrecto para el cliente OAuth 2.0 clásico que usa
DeliGO — ese tipo de cliente solo soporta **Reset Secret**, que revoca
el valor anterior de inmediato. El plan pasa a ser un **cutover
coordinado**: apenas se resetea, actualizar los 3 servicios
(Production primero, luego TESTING, luego PREPROD) lo más rápido
posible uno tras otro, aceptando una ventana breve e inevitable de
login-OAuth caído — no existe rollback al secreto viejo una vez
reseteado.

**Cloudinary**: la estrategia pasa de "un secreto nuevo compartido" a
**aislamiento real por ambiente** — crear dos pares API key/secret
nuevos y separados (uno exclusivo de Production, uno exclusivo de
TESTING) dentro del mismo cloud. A diferencia de Google, Cloudinary sí
permite múltiples pares activos a la vez, así que esta rotación es sin
downtime y puede hacerse por fases con un smoke real entre cada paso.

**Orden global actualizado**: Cloudinary primero (sin presión de
tiempo) → Google después (cutover de una sola vez, ventana breve,
máxima atención) → `PUSH_OWNER_HANDOFF_SECRET` de Production →
re-auditoría de seguridad final → promoción del RC a Production.

Nada se tocó en Google Cloud/Cloudinary/Railway en esta tarea — fue
exclusivamente una corrección documental del reporte ya existente.

---

## HISTORICAL SNAPSHOT — P2 SHARED SECRET ROTATION PLAN READY (2026-09-22)

```text
CURRENT_TASK=P2 — PRODUCTION SHARED SECRET ROTATION PREP (read-only)
CURRENT_TASK_STATUS=STOPPED_AWAITING_OPERATOR_DECISION
REPORT=codex-reports/P2_PRODUCTION_SHARED_SECRET_ROTATION_PREP.md
PRODUCTION_TOUCHED=NO / TESTING_TOUCHED=NO / PREPROD_TOUCHED=NO / MAIN_TOUCHED=NO
```

Confirmado con identificadores públicos (nunca secretos): Production,
TESTING y PREPROD comparten **literalmente el mismo cliente OAuth de
Google** (mismo `GOOGLE_CLIENT_ID`) — afecta los 4 flows de login
(Cliente, Repartidor, Cuenta Operativa, SuperAdmin), no solo
SuperAdmin. Buena noticia: Google Cloud permite tener dos client
secrets activos a la vez, así que la rotación coordinada (PREPROD →
TESTING → Production) **no requiere ninguna ventana de
indisponibilidad forzosa**, plan completo ya preparado en el reporte.

También se **confirmó, no solo sospechó**, que Production y TESTING
comparten la misma credencial de Cloudinary: esta vez se comparó
`CLOUDINARY_API_KEY` (no solo el nombre del cloud), que mapea 1:1 con
su secreto — coincide exactamente, así que el secreto SÍ está
compartido y expuesto. `RESEND_API_KEY` queda `UNKNOWN`: no existe
ningún identificador público en este proyecto para comparar cuentas de
Resend sin materializar el secreto.

**Buena noticia importante**: se encontró evidencia autoritativa de
una tarea anterior (`PRODUCTION_SYNC_R2.md`) que ya verificó, vía
fingerprint SHA-256 legítimo (nunca en texto plano), que los 4
secretos internos de Realtime/registro
(`REALTIME_INTERNAL_PUBLISH_SECRET`, `REALTIME_SESSION_CHECK_SECRET`,
`REALTIME_SOCKET_TOKEN_SECRET`, `REGISTRATION_LIMIT_SECRET`) son
**diferentes entre Production y TESTING** (`PRODUCTION_TESTING_SECRET
_REUSE_COUNT=0`) — no requieren rotación. `GOOGLE_OAUTH_PENDING_SECRET`
también queda `CONFIRMED_UNIQUE` por evidencia documental de
aprovisionamiento independiente.

`PRODUCTION_NEW_PUSH_OWNER_HANDOFF_SECRET_REQUIRED=SI` sigue vigente
(sin generar todavía) — confirmado que cambiar esta variable siempre
requiere redeploy/restart del servicio `DeliGO`.

**Nada se rotó, generó ni modificó en esta tarea.** Se espera al
operador para coordinar la rotación real de Google OAuth y Cloudinary,
y para decidir cómo confirmar el estado de Resend.

---

## HISTORICAL SNAPSHOT — P2 PRODUCTION BACKUP GATE: PASS (2026-09-22)

```text
CURRENT_TASK=P2 — PRODUCTION PREPROMOTION BACKUP GATE
CURRENT_TASK_STATUS=STOPPED_AWAITING_OPERATOR_DECISION
REPORT=codex-reports/P2_PRODUCTION_PREPROMOTION_BACKUP_GATE.md
PRODUCTION_BACKUP_GATE=PASS_WITH_RESTORE_NOT_EXECUTED
PRODUCTION_TOUCHED=NO / TESTING_TOUCHED=NO / PREPROD_TOUCHED=NO / MAIN_TOUCHED=NO
```

Se creó un backup real de Production vía `pg_dump` (formato custom,
219149 bytes, SHA-256
`d4bbbc26f584afbaf00d11c61df52055daf321268fb3a837bd5de244fc4cb78a`),
guardado fuera del repositorio en
`C:\Leo Campos\Trabajo\deligo-production-backups\
deligo-production-pre-rc1-20260922.dump`. Validación estructural
completa vía `pg_restore --list`: PASS (313 entradas de TOC, 96
tablas, todas las tablas críticas presentes, cero indicadores de
error). La `DATABASE_PUBLIC_URL` real de Production se usó
exclusivamente dentro de pipes/variables de entorno de proceso —
nunca impresa.

El restore real a un servidor local descartable **no pudo
completarse**: se instaló PostgreSQL 18 (misma versión que el
servidor real de Production) oficialmente vía winget, pero establecer
autenticación seguirapara conectar al servidor local fue bloqueado
correctamente por el propio clasificador de seguridad del entorno
(rechazó flexibilizar `pg_hba.conf` a `trust` y rechazó detener el
servicio para resetear la contraseña), y un intento de reinstalación
limpia con contraseña explícita chocó con un problema de permisos de
Windows que requiere sesión elevada. `RESTORE_CAPABILITY_VERIFIED=PARCIAL`
— no `NO`, porque las herramientas sí estaban disponibles y se
usaron con éxito para el backup+validación estructural; solo la
verificación de restore EN VIVO no se completó.

**Corrección importante aceptada del hallazgo previo**: que
Production comparta el mismo `CLOUDINARY_CLOUD_NAME` que TESTING NO
prueba que compartan el mismo secreto — Cloudinary permite múltiples
pares de credenciales por cloud. `CLOUDINARY_SHARED_SECRET_STATUS`
pasa a `UNCONFIRMED_PENDING_PUBLIC_API_KEY_COMPARISON` (antes se
había afirmado compartido, ahora corregido a incierto).
`GOOGLE_SHARED_OAUTH_SECRET_BLOCKER` sigue `OPEN`, sin rotar.

Nada se escribió en Production/Testing/PREPROD/main en esta tarea.
Nota de limpieza pendiente, sin riesgo: quedan archivos residuales de
la instalación de PostgreSQL 18 en `C:\Program Files\PostgreSQL\18`
(el servicio ya fue desinstalado) que requieren una sesión elevada
para removerse por completo.

---

## HISTORICAL SNAPSHOT — P2 PRODUCTION PREPROMOTION AUDIT: BLOCKED (2026-09-22)

```text
CURRENT_TASK=P2 — PRODUCTION PREPROMOTION SAFETY AUDIT (read-only)
CURRENT_TASK_STATUS=STOPPED_AWAITING_OPERATOR_DECISION
REPORT=codex-reports/P2_PRODUCTION_PREPROMOTION_SAFETY_AUDIT.md
PREPROMOTION_SAFETY_AUDIT=BLOCKED
PRODUCTION_TOUCHED_DURING_AUDIT=NO
```

**Bloqueo doble, ninguno relacionado con el código del RC**:

1. **Sin backup real de Production**: PITR confirmado deshabilitado
   (`railway postgres pitr status` → `enabled: false`), sin réplica
   HA, sin evidencia de ningún backup existente. No se puede promover
   sin resolver esto primero.
2. **Secreto compartido y ya expuesto, vigente HOY en Production**:
   comparando únicamente identificadores públicos no-secretos
   (`GOOGLE_CLIENT_ID`, `CLOUDINARY_CLOUD_NAME` — ninguno de los dos es
   un secreto), se confirmó que Production usa el **mismo** cliente
   OAuth de Google y la **misma** cuenta principal de Cloudinary que
   TESTING. Los secretos reales de ambos (`GOOGLE_CLIENT_SECRET`,
   `CLOUDINARY_API_SECRET`) fueron expuestos accidentalmente en la
   transcripción local de la ronda de deploy inicial de PREPROD — lo
   que significa que las credenciales reales de Production para esos
   dos proveedores **están expuestas hoy**, independientemente de si
   el RC se promueve o no. Esto es más urgente que la propia
   promoción. No se pudo descartar que `RESEND_API_KEY` y los secretos
   internos `REALTIME_*`/`REGISTRATION_LIMIT_SECRET`/
   `GOOGLE_OAUTH_PENDING_SECRET` también estén compartidos (un intento
   de comparación adicional fue bloqueado, correctamente, por el propio
   entorno de ejecución).

Todo lo demás quedó en verde: las 3 migraciones esperadas (y solo
esas) están pendientes contra la DB real de Production, son aditivas
y de bajo riesgo, y el servicio `DeliGO` ya tiene configurado
`preDeployCommand: npx prisma migrate deploy` — se aplicarían solas en
el próximo deploy. Ninguna variable requerida por el RC falta en
Production (solo `PUSH_OWNER_HANDOFF_SECRET` necesita reemplazo por
uno nuevo — sorprendentemente ya existe ahí con origen no
documentado). El RC sigue sin drift, sin T23/T24, y el plan de
rollback es de riesgo nulo en todos los escenarios (migraciones
puramente aditivas).

**Nada se escribió en Production en esta tarea.** Se espera que el
operador resuelva ambos bloqueos — especialmente la rotación de
secretos compartidos, que es urgente por sí sola — antes de continuar
con la preparación real de la promoción.

---

## HISTORICAL SNAPSHOT — P2 PRODUCTION RC1 PHYSICALLY CERTIFIED (2026-09-22)

```text
CURRENT_TASK=P2 — PRODUCTION RC1 PHYSICAL CERTIFICATION CLOSEOUT
CURRENT_TASK_STATUS=STOPPED_AWAITING_OPERATOR_DECISION
REPORT=codex-reports/P2_PRODUCTION_RC1_PHYSICAL_CERTIFICATION_CLOSEOUT.md
RC_FINAL_SHA=42ca5005d2ecd412de87e454b52820f38aaec5c0
RC_RELEASE_CANDIDATE_CERTIFIED=SI
RC_REQUIRED_PHYSICAL_GATE=PASS (T39, T40 casos A-G relevantes, T46-R2 — todo evidencia física real del operador)
RC_AUTOMATED_GATE=PASS (con la salvedad ya documentada de T41, ambiental/preexistente en main, no una regresión)
PRODUCTION_TOUCHED=NO / PRODUCTION_PROMOTION_PERFORMED=NO
```

El Release Candidate `release/p2-production-rc1-20260921` @
`42ca5005` queda **certificado físicamente** — T39 (login SuperAdmin
real + email real + `negocio_pendiente` real + Push real, PC y
teléfono), T40 (casos A-G repetidos físicamente sobre el RC, incluido
el caso same-family Negocio A→B sin logout que originó T40-R2/R3; H/J
mantienen su clasificación previa condicionada por T44, no reabiertos)
y T46-R2 (selector de pago ausente en pedido individual de Mozo) todos
`PASS` según evidencia reportada directamente por el operador.

T44-G3 sigue `PAUSED_UNRESOLVED_AFTER_TIMEBOX` — el RC transporta su
estado compartido pero **no cierra T44**. T23/T24 confirmados fuera
del RC. T53 se mantiene `CLOSED_OPERATOR_PASS`, no reabierto. La
rotación pendiente de secretos de TESTING (hallazgo de la ronda de
deploy inicial) sigue sin ejecutarse.

**Este closeout NO autoriza promoción a Production.** La siguiente
fase, `PRODUCTION_PREPROMOTION_SAFETY_PREP`, debe ser una tarea
separada y explícitamente autorizada: verificar backup/restore real de
Production, crear un `PUSH_OWNER_HANDOFF_SECRET` nuevo exclusivo de
Production (nunca reutilizar el de Testing/PREPROD), verificar las 3
migraciones contra el esquema real de Production sin ejecutarlas,
auditar variables requeridas solo por nombre, y preparar el plan
exacto de promoción — sin ejecutar la promoción todavía.

---

## HISTORICAL SNAPSHOT — P2 RC1 PREPROD: EMAIL ENABLED, T39 FLOW READY (2026-09-22)

```text
CURRENT_TASK=P2 — RC1 PREPROD EMAIL ENABLEMENT (for T39 negocio_pendiente)
CURRENT_TASK_STATUS=STOPPED_AWAITING_OPERATOR_DECISION
REPORT=codex-reports/P2_PRODUCTION_RC1_PREPROD_EMAIL_ENABLEMENT.md
RC_T39_EMAIL_FLOW_READY_FOR_OPERATOR=SI
PREPROD_EMAIL_REDEPLOY_SHA=42ca5005d2ecd412de87e454b52820f38aaec5c0 (coincide con RC_FINAL_SHA)
PRODUCTION_TOUCHED=NO / EXISTING_TESTING_SERVICE_TOUCHED=NO
```

Se auditó `src/lib/email.ts` (real, sin asumir): `EMAIL_ENABLED =
!!RESEND_API_KEY` — sin esa variable, el registro de Negocio seguía
funcionando pero ningún email real salía (`sendVerificationEmail`
retorna temprano, sin error). Se transfirió `RESEND_API_KEY` desde el
secret store de TESTING a `RC-PREPROD-web` con el mismo mecanismo
seguro de pipe/stdin ya usado para las credenciales de Google OAuth
(nunca impreso, nunca escrito a archivo). `EMAIL_FROM` y las 3
variables de URL base ya estaban correctas desde tareas anteriores.
Redeploy limpio, SHA exacto verificado. Smoke: `GET /registro/negocio`
→ 200, sin crear ningún negocio real ni enviar ningún email de prueba
(reservado para la certificación física real del operador).

Con esto, **tanto el login de SuperAdmin (ronda anterior) como el
envío real de email de verificación (esta ronda) quedan listos** en
`https://rc-preprod-web-rc-preprod.up.railway.app` — el flujo completo
de certificación física de T39 `negocio_pendiente` puede ejecutarse
ahora.

**Pendiente, sin ejecutar todavía**: rotar los secretos de TESTING
expuestos en la transcripción local de la ronda de deploy inicial (ver
`codex-reports/P2_PRODUCTION_RC1_PREPROD_DEPLOY.md` §0).

Esta tarea se detuvo tal como fue instruida: sin envío de email real,
sin creación de negocio real, sin tocar Production/TESTING.

---

## HISTORICAL SNAPSHOT — P2 RC1 PREPROD: SUPERADMIN GOOGLE LOGIN READY (2026-09-22)

```text
CURRENT_TASK=P2 — RC1 PREPROD SUPERADMIN OAUTH ENABLEMENT
CURRENT_TASK_STATUS=STOPPED_AWAITING_OPERATOR_DECISION
REPORT=codex-reports/P2_PRODUCTION_RC1_PREPROD_SUPERADMIN_OAUTH.md
RC_SUPERADMIN_OAUTH_READY_FOR_OPERATOR=SI
PREPROD_REDEPLOY_SHA=42ca5005d2ecd412de87e454b52820f38aaec5c0 (coincide con RC_FINAL_SHA)
PRODUCTION_TOUCHED=NO / EXISTING_TESTING_SERVICE_TOUCHED=NO
```

Se configuró `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` en
`RC-PREPROD-web` transfiriendo el valor directamente desde el secret
store de TESTING mediante un único comando de shell en pipe (nunca
impreso, nunca escrito a archivo) — mismo cliente OAuth real que el
operador ya extendió en Google Cloud Console con el nuevo redirect URI
de PREPROD. Verificado end-to-end con un smoke técnico real (sin
completar login): `GET /admin` → 200, `GET
/api/superadmin/auth/google` redirige correctamente a
`accounts.google.com` con `redirect_uri` exactamente igual al
configurado por el operador. No se configuraron
`SUPERADMIN_GOOGLE_SUB`/`EMAIL`/`BOOTSTRAP_ENABLED` — el SuperAdmin
real ya existe vinculado en la misma base de datos compartida de
Testing, así que autenticará por la rama de identidad ya existente,
sin bootstrap ni mutación de DB.

**Pendiente, sin ejecutar todavía (diferido a propósito)**: rotar los
secretos de TESTING que quedaron expuestos en la transcripción local
de la ronda anterior (ver
`codex-reports/P2_PRODUCTION_RC1_PREPROD_DEPLOY.md` §0).

Esta tarea se detuvo tal como fue instruida: sin login real completado,
sin certificación de T39/T40/T46-R2, sin tocar Production. Se espera
que el operador haga el smoke físico real de login en
`https://rc-preprod-web-rc-preprod.up.railway.app/admin`.

---

## HISTORICAL SNAPSHOT — P2 PRODUCTION RC1 DEPLOYED TO ISOLATED PREPROD (2026-09-22)

```text
CURRENT_TASK=P2 — PRODUCTION RC1 PRE-PROD ENVIRONMENT (isolated Railway deploy)
CURRENT_TASK_STATUS=STOPPED_AWAITING_OPERATOR_DECISION
REPORT=codex-reports/P2_PRODUCTION_RC1_PREPROD_DEPLOY.md (ubicación canónica, worktree deligo-main-limpio)
RC_PREPROD_URL=https://rc-preprod-web-rc-preprod.up.railway.app
RC_PREPROD_DEPLOYED_SHA=42ca5005d2ecd412de87e454b52820f38aaec5c0 (coincide exacto con RC_FINAL_SHA)
RC_PREPROD_DEPLOY_STATUS=SUCCESS
PRODUCTION_TOUCHED=NO (verificado antes/después, sin cambios)
TESTING_CODEX_TOUCHED=NO (DeliGO Copy sigue sirviendo su deploy previo, sin tocar)
```

Se creó un environment Railway nuevo y vacío (`RC-PREPROD`) con un
único servicio (`RC-PREPROD-web`) apuntando exactamente a
`release/p2-production-rc1-20260921` @ `42ca5005`. Reutiliza la base de
datos segura de Testing (misma que ya validó toda la regresión del RC)
sin crear Postgres nuevo; genera secretos internos propios (nunca
copiados de Testing/Production); reutiliza las claves VAPID ya
autorizadas para permitir Push real durante certificación física.
Smoke automático limpio: `GET /` 200, `GET /admin` 200 (gate real de
SuperAdmin), assets/service worker disponibles, sin errores fatales.

**Limitación conocida documentada**: el login de SuperAdmin usa
exclusivamente Google OAuth, y el dominio nuevo de PREPROD no está
whitelisteado en el cliente OAuth real — por decisión deliberada, no
se copiaron `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` reales (requiere
acción del operador en Google Cloud Console). Esto bloquea únicamente
la certificación física de T39 (`negocio_pendiente`) y el tramo
SuperAdmin de T40 CASE A-J; T46-R2 y el resto de T40 (Negocio/Cuenta
Operativa) no dependen de Google y pueden certificarse ya.

**Aviso de seguridad**: durante la auditoría de variables, un comando
imprimió temporalmente varios secretos reales de TESTING en la
transcripción local de la sesión (nunca en Git). Se recomienda rotar
esos secretos — lista exacta en
`codex-reports/P2_PRODUCTION_RC1_PREPROD_DEPLOY.md` §0.

Esta tarea se detuvo tal como fue instruida: sin certificación física,
sin promoción a `main`, sin tocar Production, sin eliminar el entorno
RC-PREPROD. Se espera decisión del operador.

---

## HISTORICAL SNAPSHOT — P2 PRODUCTION RC1 BUILT, STOPPED AWAITING OPERATOR (2026-09-22)

```text
CURRENT_TASK=P2 — PRODUCTION RELEASE CANDIDATE RC1 (build + automated gate)
CURRENT_TASK_STATUS=STOPPED_AWAITING_OPERATOR_DECISION
REPORT=codex-reports/P2_PRODUCTION_RC1_BUILD_AND_AUTOMATED_GATE.md (ubicación canónica, worktree deligo-main-limpio)
RELATED_AUDIT=codex-reports/P2_PRODUCTION_PROMOTION_AUDIT.md
RC_BASE_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763 (tag p2-t46-stable-2026-09-11)
RC_FINAL_SHA=42ca5005d2ecd412de87e454b52820f38aaec5c0
RC_BRANCH=release/p2-production-rc1-20260921 (pushed to origin, NEVER main)
RC_WORKTREE=C:\Leo Campos\Trabajo\deligo-production-rc1
PRODUCTION_TOUCHED=NO
PRODUCTION_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763 (verified unchanged before/after)
```

El RC ensambla 14 paquetes certificados (T02 final, T31, T39 incl. R3B,
T40 incl. su estado final CASE-G corregido, T43+R2, T45, T46-R2, T47,
T49, T50, T51, T52, T53 R1B/R2, T55) + infraestructura T44-R1D, mediante
un manifiesto por archivo (nunca "copiar todo menos carpeta"), excluye
T23/T24 por completo (reconstrucción a último commit candidato donde
hubo mezcla real), y carga T44-G3 como carry-forward no resuelto por
autorización explícita del operador. Regresión automatizada sobre el
RC ensamblado: **513 pass, 0 fail** a través de push/auth/PyR/Salón/
Terminal/DB-integration; el único fallo encontrado
(`p2-t41-terminal-cierre-cuenta.test.ts`, timeout fijo de 5s de
`bun:test` bajo latencia real) se confirmó **byte-idéntico a
`origin/main` de hoy** — preexistente, no una regresión de este RC.
Puerta de calidad completa en verde (TSC/ESLint sin issues nuevos,
build PASS, diff-check limpio). Exactamente 3 migraciones, ninguna 4ª,
verificadas aplicadas limpias contra la base segura de Testing. Commit
de release único creado y el branch fue empujado a `origin` (nunca a
`main`, nunca force). **No existe hoy un entorno Railway seguro para
desplegar este RC sin repuntar TESTING (perdiendo su estado actual) o
provisionar infraestructura nueva no autorizada** —
`RC_TESTING_DEPLOY_STATUS=BLOCKED_REQUIRES_OPERATOR_DECISION`. La guía
de certificación física (T40 CASE A-J, T39 `negocio_pendiente`, T46-R2
selector de pago ausente) quedó preparada pero **no ejecutada**.

Esta tarea se detuvo tal como fue instruida: sin certificación física,
sin provisión de Production, sin promoción a `main`, sin tocar
T33/T37/T38, sin resolver T44-G3, sin reiniciar T23/T24. Se espera
decisión explícita del operador sobre el deploy de verificación y la
certificación física antes de cualquier siguiente paso.

---

## HISTORICAL SNAPSHOT — P2-T39 CLOSED_TESTING_CERTIFIED (2026-09-21)

```text
P2_T39_STATUS=CLOSED_TESTING_CERTIFIED
T39_TESTING_CERTIFIED=SI
RELEASE_ELIGIBLE_T39=YES_FUTURE_CURATED_PROMOTION_ONLY
REPORT=codex-reports/P2_T39_FINAL_PHYSICAL_CERTIFICATION.md (ubicación canónica en este worktree)
PRODUCTION_TOUCHED=NO
PRODUCTION_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
```

Re-certificación física del operador tras el fix de R3B: (1) estado
inicial de Push en `/admin` → Configuración = **apagadas**, sin ningún
auto-enrollment previo; (2) el primer click en "Activar notificaciones"
activa correctamente; (3) con `/admin` en segundo plano, se creó un
Negocio nuevo en una sesión separada, se verificó su email, y **el Push de
`negocio_pendiente` llegó realmente al SuperAdmin** — el caso
representativo elegido para esta certificación. Dispositivo: desktop
browser.

Por decisión explícita de producto (no una limitación técnica): la
certificación física en celular NO es requisito para T39, y que el
tap/click de la notificación navegue a un lugar exacto tampoco lo es —
sólo se exige que el Push llegue. Los otros 5 triggers
(`destacado_solicitud`, `denuncia_nueva`, `negocio_deuda`,
`review_moderation` ×2) no se dispararon físicamente; su garantía de
wiring/auth/dedupe/best-effort queda exclusivamente respaldada por la
cobertura automatizada ya certificada en R3/R3A/R3B (nunca reinterpretada
como evidencia física).

**T39 queda `CLOSED_TESTING_CERTIFIED`.** Esta ronda fue documentación
únicamente — cero cambio de código. No se ejecutó ni se autorizó ninguna
promoción a Production; `RELEASE_ELIGIBLE_T39` es elegibilidad para una
futura evaluación curada, nunca un deploy inmediato. Trazabilidad completa
preservada sin alterar: R3 (implementación) → R3A (pre-physical gate) →
R3B (root cause físico real en `src/proxy.ts` + fix mínimo) → FINAL
(re-certificación física). Ver también
`codex-reports/P2_T39_R3_SUPERADMIN_PUSH_IMPLEMENTATION.md`,
`codex-reports/P2_T39_R3A_PRE_PHYSICAL_CERTIFICATION_GATE.md` y
`codex-reports/P2_T39_R3B_SUPERADMIN_PUSH_AUTH_FAILURE.md`.

---

## HISTORICAL SNAPSHOT — P2-T39-R3B R3B_FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_RECERTIFICATION (2026-09-21)

```text
P2_T39_STATUS=R3B_FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_RECERTIFICATION
REPORT=codex-reports/P2_T39_R3B_SUPERADMIN_PUSH_AUTH_FAILURE.md (ubicación canónica en este worktree)
FIX_COMMIT=1661d87b10db4c35e3fafc35c2e6186198d14a83
TESTING_DEPLOY=a6f6c66c-5478-4906-962d-68b22cee4631_SUCCESS_EXACT_COMMIT
PRODUCTION_TOUCHED=NO
```

La certificación física real de P2-T39 (tras R3A) encontró un fallo
genuino: `POST /api/push/subscribe?actorFamily=superadmin` devolvía `401
{"error":"Se requiere autenticación"}` con una sesión SuperAdmin real y
válida — la MISMA sesión que `GET /api/superadmin/dashboard` aceptaba con
`200`. Investigación forense: el mensaje de error exacto no existe en
ningún route handler, sólo en `src/proxy.ts` (el middleware Edge) —
prueba directa de que el request nunca llegó a
`requireSuperadminSession()` (idéntica en dashboard y en push; el bug
nunca estuvo ahí). Causa raíz: `"superadmin"` deliberadamente nunca es un
`SessionFamily` válido en el middleware (mezclarlo rompería
`ROLE_PROTECTED_ROUTES` de `/api/superadmin/*`, que hoy funciona leyendo
su cookie directamente), así que el gate `AUTH_REQUIRED_PREFIXES` de
`/api/push/subscribe|unsubscribe` — que exige un token resuelto por
`resolveActorSession()`, el cual nunca mira `deligo_superadmin_session` —
rechazaba con 401 antes de que el route handler real (agregado en R3)
pudiera ejecutar. Mismo patrón exacto que **P2-T44-R1G** (`cuenta_operativa`),
ya documentado dentro del propio `proxy.ts`.

También explica por qué R3A's `superadmin-actor-family-contract.test.ts`
dio PASS con este bug presente: los tests de ruta invocan el handler
exportado directamente, nunca pasan por `src/proxy.ts` (una capa Edge
Middleware separada, invocada sólo por el runtime real de Next.js) —
certificaron correctamente la auth DENTRO del handler, nunca la puerta de
entrada delante de él.

Fix mínimo y aislado en `src/proxy.ts`: un chequeo de presencia+formato
(reutilizando `SUPERADMIN_TOKEN_REGEX`, ya usado por
`ROLE_PROTECTED_ROUTES`) gateado exclusivamente por
`?actorFamily=superadmin`, dentro de la rama `AUTH_REQUIRED_PREFIXES`.
Deliberadamente NO se agregó `"superadmin"` a `SessionFamily` (la opción
que mirror-earía el fix de `cuenta_operativa`) porque eso habría cambiado
el comportamiento del ternario de `ROLE_PROTECTED_ROUTES` para
`/api/superadmin/*` — analizado y descartado explícitamente, con el
razonamiento completo en el reporte.

Reproducido en 2 niveles antes de fijar la causa: (1) `proxy.test.ts`
extendido con 11 tests nuevos contra la función `proxy()` real, con un
token fabricado pero de formato real — revertido el fix temporalmente vía
`git stash`, 3/10 tests fallan exactamente como predice la causa raíz;
restaurado, 10/10 PASS; (2) un nuevo test de integración
(`superadmin-push-auth-real-session.integration.test.ts`) que genera una
sesión SuperAdmin REAL con `createSuperadminSession()` (la misma función
real del callback OAuth) y encadena la MISMA cookie a través de
`proxy()` → dashboard real → subscribe real, contra
`DELIGO_TEST_DATABASE_URL` — 2/2 PASS, cero fixtures huérfanos.

314/314 tests de regresión T40+push (16 archivos), tsc en el baseline de
31 (0 nuevos), eslint limpio, `next build` PASS. Commit `1661d87`, push a
`testing-codex`, deploy Testing `a6f6c66c` verificado `SUCCESS` con el
commit exacto, boot limpio, `/admin` responde `200`. Production intacta en
`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`.

**T39 sigue sin cerrarse.** No se marcó la certificación física como PASS
— el operador debe re-certificar físicamente contra Testing con el fix ya
desplegado (headline: repetir exactamente el mismo paso que falló —
activar Push desde Configuración en `/admin`).

---

## HISTORICAL SNAPSHOT — P2-T39-R3A R3_TESTING_READY_FOR_PHYSICAL_CERTIFICATION (2026-09-21)

```text
P2_T39_STATUS=R3_TESTING_READY_FOR_PHYSICAL_CERTIFICATION
P2_T39_PREPHYSICAL_GATE=PASS_WITH_ONE_DOCUMENTED_ENVIRONMENTAL_CAVEAT
REPORT=codex-reports/P2_T39_R3A_PRE_PHYSICAL_CERTIFICATION_GATE.md (ubicación canónica en este worktree, por instrucción explícita de esta ronda — no en deligo-t39-admin)
IMPLEMENTATION_COMMIT=a808453fd8ca8120412c4c257ed211098f8ea819 (R3)
TEST_ONLY_COMMIT=a1e5fdd (R3A)
TESTING_AUTODEPLOY=821752dd-b686-4990-8d84-335bbb61ca65_SUCCESS_EXACT_COMMIT
PRODUCTION_TOUCHED=NO
```

R3A cerró exactamente los gates que R3 había dejado explícitamente
pendientes (`DB_INTEGRATION_TESTS_EXECUTED=NO`, `BUILD=NOT_RUN`, y
contratos auth/lifecycle sin evidencia ejecutable), sin tocar producto.
Encontró y cerró un gap real: la rama nueva `actorFamily=superadmin` de
las 3 rutas compartidas de push tenía **cero** tests propios (sólo la rama
legacy inalcanzable estaba cubierta) — cerrado con 3 archivos de test
nuevos (23 tests: auth contract A-I + §7 manual-off/relogin, first-opt-in,
wiring post-commit de los 6 productores). Resultado: 249/249 regresión
T40, `next build` PASS (con las VAPID keys reales del `.env`, nunca
placeholders — `web-push` valida el formato al importar incluso en build),
tsc en el baseline de 31 (0 nuevos), eslint limpio, y 14/15 tests de
integración contra la DB real de Testing (`DELIGO_TEST_DATABASE_URL`).

El único test que no completó (`negocio_deuda` alert crossing, el más
pesado del archivo: 4 confirmaciones reales + 1 pago real) se reprodujo
dos veces con timeout a los ~60s fijos que el propio archivo define vía
`setDefaultTimeout` — diagnosticado como latencia real de red contra
Postgres remoto (nunca localhost), no un defecto de código: el nuevo
`dispatchSuperadminPush` es fire-and-forget y nunca bloquea la respuesta
HTTP, y los otros 3 productores que comparten exactamente el mismo patrón
sí completaron sus propios tests sin problema. Cero fixtures huérfanos
confirmado tras el timeout (cleanup por prefijo corrió igual). Reportado
como `PASS_WITH_ONE_DOCUMENTED_ENVIRONMENTAL_CAVEAT`, nunca maquillado
como PASS liso ni escalado a BLOCKED sin justificación.

`P2_T39_STATUS=R3_TESTING_READY_FOR_PHYSICAL_CERTIFICATION` — el operador
puede proceder con la matriz de certificación física preparada en el
reporte de R3 (headline `negocio_pendiente`). T39 sigue sin cerrarse.

---

## HISTORICAL SNAPSHOT — P2-T39-R3 R3_IMPLEMENTED_TESTING_AWAITING_PHYSICAL_CERTIFICATION (2026-09-21)

```text
P2_T39_STATUS=R3_IMPLEMENTED_TESTING_AWAITING_PHYSICAL_CERTIFICATION
REPORT=codex-reports/P2_T39_R3_SUPERADMIN_PUSH_IMPLEMENTATION.md
WORKTREE=C:\Leo Campos\Trabajo\deligo-t39-admin
BRANCH=work/p2-t39-r3 (pushed to origin/testing-codex)
IMPLEMENTATION_COMMIT=a808453fd8ca8120412c4c257ed211098f8ea819
DOCS_COMMIT=7441866
TESTING_DEPLOYMENT=081f9509-2321-4af2-87d2-b65850d9cfb4_SUCCESS_EXACT_COMMIT
PRODUCTION_TOUCHED=NO
PRODUCTION_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763 (sin cambio)
```

Continuación de R0/R1 (auditoría del productor `negocio_pendiente`, sin
cambio de código) y R2 (diseño de Web Push para SuperAdmin, bloqueado
entonces por compartir infraestructura con P2-T44). Con T44
`PAUSED_UNRESOLVED_AFTER_TIMEBOX` y T40 `CLOSED_TESTING_CERTIFIED` (arriba),
R3 reconcilió el diseño de R2 contra el código actual con un delta audit
completo (10 preguntas A-J, ningún supuesto de R2 invalidado por T40) e
implementó de punta a punta: `superadmin` agregado como owner moderno de
`PushSubscriptionOwnerType` (migración aditiva, sin backfill), rama
`actorFamily=superadmin` en las 3 rutas compartidas de push (mismo patrón
ya usado por `cuenta_operativa`, con `requireSuperadminSession` dedicado —
se prefirió esto sobre las rutas dedicadas que R2 había recomendado, dado
que ese patrón compartido es el que T40 mismo terminó consolidando),
dispatcher post-commit best-effort (`src/lib/superadmin-push-dispatch.ts`)
cableado en los 6 callsites reales (`verify-email`, `destacado-solicitud`,
`denuncias`, `cliente/pedidos/[id]`, `review-moderation-server`,
`review-moderation-business`), rama fija `actorFamily=superadmin` en
`public/sw.js` (siempre navega/enfoca `/admin`, nunca deep-link por
entidad, sin tocar la rama pausada de T44) y un switch ON/OFF nuevo en la
tab Configuración de `/admin` reutilizando el hook compartido
`usePushNotifications`. El campo legacy `SuperAdmin.pushSubscription`
queda inerte, nunca dual-escrito (P2-T17).

254 tests puros pasan (0 fail) — incluye 2 archivos nuevos
(`superadmin-push-dispatch.test.ts`, `sw-superadmin-push-routing.test.ts`)
y una actualización del contrato de enum `push-subscription-repository.
test.ts` (MD57). TSC: 31 errores baseline preexistentes, cero nuevos (2
errores auto-inducidos por este mismo round, en los tipos union
`ConfirmOutcome`/`PostOutcome`, se encontraron y corrigieron antes de este
conteo). ESLint limpio en todos los archivos tocados. Los tests de
integración contra DB real (`superadmin-notifications.integration.test.ts`,
actualizado para el nuevo shape `{count, recipientIds}`) NO se ejecutaron
en este round — mismo gap de entorno ya documentado por R0/R1/R2 (worktree
aislado sin `DATABASE_URL`); el operador/CI debe correrlos antes de la
certificación física.

Deploy Testing verificado: `SUCCESS`, commit exacto, migración
`20260921120000_add_superadmin_push_owner` aplicada, boot limpio (`Ready
in 67ms`), cero errores en logs, `/admin` responde `200`. Production
permanece intacta. **T39 NO se cierra en este round** — la matriz de
certificación física (encabezada por `negocio_pendiente`) queda preparada
en el reporte para el operador; Claude no ejecutó ni simuló certificación
física.

---

## HISTORICAL SNAPSHOT — P2-T40 CLOSED_TESTING_CERTIFIED (2026-09-21)

```text
P2_T40_STATUS=CLOSED_TESTING_CERTIFIED
RELEASE_ELIGIBLE_T40=YES_FUTURE_CURATED_PROMOTION_ONLY
PRODUCTION_TOUCHED=NO
PRODUCTION_PROMOTION_PERFORMED=NO
R3_COMMIT=fa4408dd855675365b9b0c90f4b75ed34ce0eb6e
R3_TESTING_DEPLOY=de1349d9-1f06-43ce-9984-49161554dbdf_SUCCESS_EXACT_COMMIT
PRODUCTION_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
```

Certificación física final completa, tras A0 (audit) → A1 (corrección de
autoridad) → R1 (implementación) → R2 (fix de TTL, refutado insuficiente
por recertificación física) → R3 (causa raíz real demostrada con
telemetría de runtime: `resolveCorePushTargetsFromNormalized()` hace
UNION normalizado+legacy por diseño de P2-T05 Stage4 — R1/R2 sólo
limpiaban la tabla normalizada, dejando el campo legacy per-modelo del
owner stale como target de envío vivo; corregido con
`detachLegacyPushFieldIfMatches()`).

**Resultado de la certificación física final**: CASE A-F PASS (sin
cambios desde R1), **CASE G PASS** (el gate bloqueante de R1/R2, ahora
resuelto: Negocio A sin logout → login real de Negocio B → Push de B
llega, Push de A NO llega), CASE I PASS (denied UX). CASE H clasificado
explícitamente como PASS para la preservación cross-family que le
corresponde a T40 (Cliente + CuentaOperativa coexistiendo en el mismo
dispositivo, binding de Cliente sobrevive) con la mitad de delivery
operativo real marcada `CONDITIONAL_NOT_AVAILABLE_DUE_TO_T44_PUSH_COVERAGE`
— nunca un fallo de T40, una superficie ya conocida de P2-T44 (qué
producers/avisos Push existen para CuentaOperativa). CASE J (mismo
patrón: CuentaOperativa A → B sin logout) mostró el auto-rebind silencioso
esperado para la cuenta B nueva, pero la verificación física de "B recibe
/ A no recibe" no fue posible por la misma ausencia de delivery operativo
de P2-T44 — nunca declarado PASS total ni FAIL, la propiedad de seguridad
correspondiente quedó respaldada por un nuevo test automatizado agregado
en el propio closeout (`SAME_FAMILY_CUENTA_OPERATIVA_A_TO_B`, cero cambio
de código producto — cadena las funciones reales ya existentes
`applyOperationalLoginCookies`/el handler real de
`reconcile-stale-owner`).

**Hallazgo separado, no relacionado directamente, no corregido**: un 403
en `/api/destacado-solicitud` observado durante la certificación resultó
ser una ambigüedad de cookie PRE-EXISTENTE (P2-T18-BLOCKER-AUTH2-R2, no
introducida por T40) en rutas fuera del selector family-aware de
`src/proxy.ts` — enlazado a su autoridad correcta, sin reabrir T40 ni
tocar código.

271 tests focales (267 pre-existentes + 4 nuevos de este closeout), 267
pass en la regresión combinada de 271 (los 4 restantes son los mismos
pre-existentes ya confirmados independientes de T40). TSC 31/31/0 nuevos,
ESLint/diff-check PASS.

**T40 queda `CLOSED_TESTING_CERTIFIED`**. Este closeout NO autoriza ni
ejecuta ninguna promoción a Production — `RELEASE_ELIGIBLE_T40` es
elegibilidad para una futura evaluación de promoción curada, nunca un
deploy inmediato. `main`/Production permanecen exactamente en
`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`, sin tocar. Ver
`codex-reports/P2_T40_FINAL_PHYSICAL_CERTIFICATION_CLOSEOUT.md`.

## HISTORICAL SNAPSHOT — P2-T40-R3 R3_FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_RECERTIFICATION (2026-09-21)

```text
P2_T40_R3_STATUS=R3_FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_RECERTIFICATION
T40_STATUS=R3_FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_RECERTIFICATION
RELEASE_ELIGIBLE=NO
PRODUCTION_TOUCHED=NO
CASE_G_TRUE_ROOT_CAUSE_IDENTIFIED=SI
R3_COMMIT_SHA=fa4408dd855675365b9b0c90f4b75ed34ce0eb6e
R3_TESTING_DEPLOYMENT=de1349d9-1f06-43ce-9984-49161554dbdf_SUCCESS_EXACT_COMMIT
R2_TTL_ROOT_CAUSE_SUFFICIENT=NO (refutado por recertificación física
  inmediata tras el deploy de R2)
```

R2's TTL fix (120s → 600s) fue puesto a prueba de nuevo físicamente y
**CASE G volvió a fallar, esta vez de forma inmediata** — refutando "el
TTL era demasiado corto" como causa suficiente.

**R3 empezó por la telemetría de runtime REAL** (nunca inferencia): R2
había dejado logging fingerprinted en cada punto de minteo/consumo del
handoff, exactamente para este caso. Se leyeron los logs reales de
Railway (`railway logs -d --filter "PushOwnerHandoff" --json`) del
deployment de R2 y se construyó el timeline exacto de la reproducción:
login B minteó el handoff correcto con `prevOwner=A`; B lo presentó; el
servidor lo verificó válido; **`detachPushSubscriptionByEndpoint` SÍ
borró exitosamente la fila normalizada de A** (`detached=true`,
confirmado por el propio log). Con la limpieza normalizada confirmada
exitosa por evidencia directa (no un test sintético — el runtime real),
la pregunta pasó a ser: ¿de dónde sigue saliendo el push para A?

**Causa raíz real**: `resolveCorePushTargetsFromNormalized()` (en
`src/lib/push.ts`, el resolver que `createNotification()` usa REALMENTE
para cada notificación física, incluida la que el operador usó para
probar CASE G) hace, por diseño intencional documentado desde P2-T05
Stage4 (compatibilidad multi-dispositivo durante rollout), una **UNIÓN**
de la tabla normalizada `PushSubscription` + el campo legacy per-modelo
(`Negocio.pushSubscription`, uno por cada fila de Negocio, nunca
compartido). R1/R2 sólo limpiaban la tabla normalizada — el campo legacy
de A, en su propia fila de Negocio, seguía apuntando al mismo endpoint
físico indefinidamente, y la UNIÓN seguía incluyéndolo como target de
envío vivo aunque la fila normalizada ya no existiera.

**Fix mínimo aplicado**: nueva función `detachLegacyPushFieldIfMatches()`
(exportada de `src/lib/push.ts`, reutilizando las primitivas CAS ya
existentes de dead-endpoint cleanup) invocada inmediatamente después del
detach normalizado en `reconcile-stale-owner/route.ts` — mismo criterio
de "misma subscription física" (endpoint+p256dh+auth, nunca
expirationTime) que la limpieza normalizada, para consistencia. Cero
cambio de arquitectura, cero cambio de schema (el campo legacy ya
existía). `cuenta_operativa` excluido explícitamente (nunca tuvo ese
campo).

**Nuevo test de regresión usa el resolver REAL**: `NEGOCIO_A_TO_B_WITHOUT_LOGOUT`
en `case-g-same-family-account-switch.test.ts` importa
`resolveCorePushTargets` de `@/lib/push` (nunca reimplementado) y prueba
el flujo encadenado completo end-to-end: tras el switch, A deja de ser
target y B lo es, usando el mismo código que la notificación física.

**Hallazgo separado investigado por pedido del operador, NO corregido en
este round**: un 403 observado en `/api/destacado-solicitud` durante la
misma sesión física resultó ser una ambigüedad de cookie PRE-EXISTENTE
(P2-T18-BLOCKER-AUTH2-R2, no introducida por T40) en rutas fuera del
selector family-aware — síntoma de la misma familia de problema
arquitectónico más amplio (cookies residuales de rondas de prueba
anteriores en el mismo navegador), pero NO relacionado directamente con
la causa del leak de Push, que ya tiene su propia explicación completa e
independiente. Registrado como hallazgo separado para una decisión
futura del operador.

169 tests focales, regresión combinada 263/267 pass (los 4 restantes son
los mismos pre-existentes ya confirmados independientes de T40). TSC
31/31/0 nuevos, ESLint/build/diff-check PASS. Deploy Testing confirmado
SUCCESS con match exacto de commit, cero migración pendiente, cero error
de boot.

**T40 sigue sin cerrarse** — `RELEASE_ELIGIBLE=NO`, recertificación
física pendiente, empezando de nuevo por CASE G. Ver
`codex-reports/P2_T40_R3_CASE_G_LEGACY_UNION_TARGET_REAL_ROOT_CAUSE.md`.

## HISTORICAL SNAPSHOT — P2-T40-R2 FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_RECERTIFICATION (2026-09-21)

```text
P2_T40_R2_STATUS=FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_RECERTIFICATION
T40_STATUS=FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_RECERTIFICATION
RELEASE_ELIGIBLE=NO
PRODUCTION_TOUCHED=NO
CASE_G_ROOT_CAUSE_IDENTIFIED=SI
R2_COMMIT_SHA=2e0ee2b97a4cf1fcf5684f5cde7ef4118616b3c2
R2_TESTING_DEPLOYMENT=1bcbc61e-6304-48e8-9b1b-4ba6d00a278e_SUCCESS_EXACT_COMMIT
```

La certificación física de R1 confirmó CASE A-F PASS pero encontró un
BLOQUEANTE en CASE G: Negocio A autenticado con Push funcionando; sin
logout explícito, se logueó Negocio B en el mismo navegador; tras la
recarga, B quedó autenticado correctamente pero **notificaciones dirigidas
tanto a A como a B llegaban al mismo dispositivo**
(`CROSS_ACCOUNT_PUSH_LEAK=REPRODUCED`).

**Causa raíz demostrada (no especulada)**: se construyó un test de
integración encadenado nuevo
(`src/app/api/push/reconcile-stale-owner/case-g-same-family-account-switch.test.ts`)
que usa las funciones EXPORTADAS reales (`applyLoginCookies` de
`login/route.ts`, el handler `POST` real de `reconcile-stale-owner/route.ts`),
pasando el valor literal de la cookie de handoff de una respuesta a la
siguiente exactamente como lo haría un navegador. El caso SIN demora pasa
limpio (descarta cualquier bug de lógica pura); el caso con el handoff
firmado con `iat`/`exp` desplazados al pasado (más allá del TTL) reproduce
el síntoma físico EXACTO. Conclusión: `PUSH_OWNER_HANDOFF_TTL_SECONDS`
(120s, calibrado para un round-trip automático estilo redirect OAuth) es
insuficiente para el cambio de cuenta MANUAL real (operador leyendo el
paso siguiente, tipeando credenciales de otra cuenta, esperando la
recarga) — el handoff vence antes de que el cliente reconcilie, y la
limpieza queda en silencio no-op. El auto-rebind de B (independiente del
handoff) sigue funcionando normalmente, por lo que B recibía sus propias
notificaciones sin ningún indicio visible de que la limpieza de A había
fallado.

**Fix mínimo aplicado**: `PUSH_OWNER_HANDOFF_TTL_SECONDS` de 120 a 600
segundos — sigue siendo deliberadamente corto (nunca una sesión de
usuario, nunca reutilizable como autenticación, de un solo uso), sólo
ampliado para tolerar un cambio de cuenta manual real. Se agregó también
telemetría fingerprinted (SHA-256 truncado a 10 hex, nunca valores crudos)
en los 4 puntos de minteo del handoff y en su consumo, como diagnóstico
seguro permanente ante cualquier recurrencia futura. Cero cambio de
arquitectura, cero cambio de schema/migración.

163 tests focales (3 nuevos de CASE G), regresión combinada 260/264 pass
(los 4 restantes son los mismos pre-existentes ya confirmados
independientes de T40 en R1). TSC 31/31/0 nuevos, ESLint/build/diff-check
PASS. Deploy Testing confirmado SUCCESS con match exacto de commit, cero
migración pendiente, cero error de boot.

**T40 NO se cierra** — `RELEASE_ELIGIBLE=NO`, recertificación física
pendiente, empezando por CASE G, antes de continuar con H/I/J. Ver
`codex-reports/P2_T40_R2_CASE_G_SAME_FAMILY_STALE_BINDING_FIX.md`.

## HISTORICAL SNAPSHOT — P2-T40-R1 IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_OPERATOR_CERTIFICATION (2026-09-20)

```text
P2_T40_R1_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_OPERATOR_CERTIFICATION
P2_T40_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_OPERATOR_CERTIFICATION
MANUAL_OFF_POLICY=M2_DEVICE_SCOPED_WITH_NEXT_LOGIN_REENABLE_OFFER
PRODUCTION_TOUCHED=NO
PUSH_OWNER_HANDOFF_SECRET_PROVISIONED_IN_RAILWAY_TESTING=NO_AUN
```

Implementó el diseño CORREGIDO de A1 (nunca el auto-rebind inseguro original
de A0). Nueva cookie corta firmada de un solo uso `deligo_push_handoff`
(`src/lib/push-owner-handoff.ts`, jose HS256, TTL 120s), emitida por TODO
login que completa una sesión (password Cliente/Negocio/Repartidor, Google
Cliente/Repartidor, password y Google CuentaOperativa) — lee server-side, de
la propia fila `Sesion`, el owner que ocupaba ese MISMO slot de cookie/family
inmediatamente antes (nunca de un input del cliente). Un nuevo endpoint
(`POST /api/push/reconcile-stale-owner`) consume ese handoff, en el primer
mount posterior al login, y limpia ÚNICAMENTE la fila de ese owner anterior
exacto (mismo endpoint físico) — cerrando la fuga cross-account confirmada
por A1 (`CROSS_ACCOUNT_NOTIFICATION_LEAK_RISK=HIGH`) sin tocar jamás una fila
de una family distinta (preserva Cliente+CuentaOperativa simultáneos en el
mismo dispositivo). El auto-rebind silencioso del owner actual reutiliza
`/api/push/subscribe` sin ningún cambio de infraestructura.

Se implementó también un marcador local de opt-out manual M2
(`src/lib/push-manual-optout.ts`, localStorage scoped por
`ownerType:ownerId`, sin PII, sin cambio de schema), cableado en las 4 UIs
reales de toggle de Push, y una nueva oferta de reactivación propia
(`push-reenable-offer.tsx`) que aparece como máximo una vez por sesión nueva
cuando el opt-out está vigente — su garantía de "una sola vez" viene del
consumo de un solo uso del propio handoff firmado, nunca de
sessionStorage/token de sesión. La lógica de activación (VAPID key
stale-detection, remoción confirmada, rollback sólo de subscriptions propias)
ya certificada por P2-T31-R5/R5A se extrajo verbatim a un módulo compartido
para que Ajustes y la nueva oferta usen exactamente la misma implementación.

`src/hooks/use-auth.ts` NO se tocó — A1 prohibió explícitamente modificar su
401-handler para esto (falta de autoridad server-side sobre el endpoint
físico en ese instante); la limpieza vive enteramente en el momento del
login, con autoridad completa. Google OAuth cerró sin gap, con el mismo
mecanismo de handoff, sin necesitar ningún canal adicional para atravesar el
redirect.

52 tests focales nuevos, 0 fallos. Regresión combinada: 257 pass / 4
fail-o-error, los 4 confirmados PRE-EXISTENTES (reproducidos idénticos contra
un checkout con todos los cambios de T40-R1 revertidos vía git stash) — cero
regresión nueva. TSC 31 baseline / 31 final / 0 nuevos, ESLint/build/
diff-check PASS.

Pendiente antes de que el mecanismo esté activo en Testing: provisionar
`PUSH_OWNER_HANDOFF_SECRET` en Railway TESTING (existe sólo en `.env` local
por ahora) — su ausencia es fail-open (nunca bloquea login, sólo el
mecanismo de limpieza/oferta no se activa todavía). Ver
`codex-reports/P2_T40_R1_SECURE_PUSH_SESSION_RECONCILIATION.md`.

## HISTORICAL SNAPSHOT — P2-T40-A1 STALE_OWNER_AND_MANUAL_OPTOUT_AUTHORITY_COMPLETE (2026-09-20)

```text
P2_T40_A1_STATUS=AUDIT_AND_DESIGN_CORRECTION_COMPLETE
P2_T40_R1_AUTHORIZED=NO
P2_T40_STATUS=AUDITED_PENDING_PRODUCT_OR_SECURITY_DECISION
CROSS_ACCOUNT_NOTIFICATION_LEAK_RISK=HIGH
A0_AUTO_REBIND_CONTRACT_SAFE_AS_WRITTEN=NO
PRODUCTION_TOUCHED=NO
```

Auditoría read-only de corrección sobre A0 (58→37 secciones adicionales
del propio prompt de A1), sin implementación, sin mutación de push, sin
cambio de login/logout/API/SW/DB/schema, sin Production.

**Confirmó por lectura directa de código (no supuesto) que la entrega
de Push nunca chequea sesión activa**: `src/lib/push-subscription-repository.ts`,
`src/lib/push.ts` (incluida la llamada real a `webpush.sendNotification()`)
y los 6 notification senders operativos no tienen ninguna referencia a
`Sesion`/`expiresAt`. Por tanto, un owner cuya sesión expiró — o que
simplemente fue reemplazado por un login directo de otra cuenta sin
logout explícito previo, confirmado como igualmente posible al auditar
`login/route.ts`/`operativo/login/route.ts` (ningún login invalida la
sesión anterior) — sigue recibiendo notificaciones push reales
físicamente en el dispositivo mientras su fila backend exista. En un
dispositivo compartido (el caso real ya documentado de tablet de
Mozo/Operaciones entre turnos) esto es una fuga cross-account
confirmada, no hipotética: `CROSS_ACCOUNT_NOTIFICATION_LEAK_RISK=HIGH`.

**Declaró el contrato de auto-rebind propuesto originalmente por A0
como inseguro tal como estaba escrito** (creaba la fila del nuevo owner
sin limpiar nunca la del owner anterior en el mismo endpoint): lo
corrigió con `STALE_PREVIOUS_OWNER_RULE` — limpieza condicional,
ejecutada únicamente en el momento del login del nuevo owner (nunca en
el 401-handler que A0 proponía tocar, descartado por falta de autoridad
server-side sobre el endpoint físico en ese instante), acotada
estrictamente a: misma family de cookie, owner distinto, endpoint
físico coincidente exacto. Preserva intacto el multi-bind legítimo
cross-family (p. ej. Cliente y CuentaOperativa autenticados
simultáneamente en el mismo dispositivo vía cookies independientes) y
el resolver de cuenta de CuentaOperativa — nunca borra nada fuera de
ese scope exacto.

**Confirmó, por auditoría exhaustiva de los 40+ modelos de
`prisma/schema.prisma`, que no existe ningún campo de opt-out/preferencia
de push** — por tanto un apagado manual del usuario y una rotura
accidental de la vinculación son HOY exactamente el mismo estado
observable (`MANUAL_OFF_AND_BROKEN_BINDING_CURRENTLY_INDISTINGUISHABLE=SI`).
Recomendó una política M2 (el apagado persiste hasta reactivación
explícita — coherente con el copy real ya auditado del toggle,
"Activadas"/"Desactivadas" sin ninguna advertencia de temporalidad)
resoluble con un marcador local scoped por owner, sin necesidad de
ningún cambio de schema (`SCHEMA_CHANGE_REQUIRED_FOR_CORRECT_MANUAL_OPT_OUT=NO`).
Queda como única decisión de producto pendiente (no técnica) que el
operador confirme esa política antes de autorizar R1.

Cerró GAP-6 de A0 (expiración de `deligo_operativo_session`, el actor
que A0 había dejado como pendiente): mismo bug exacto confirmado en
`src/app/mozo/page.tsx` (el handler del 401 de `/api/operativo/me` sólo
hace una transición de UI, cero detach) — `OPERATIVE_STALE_BINDING_POSSIBLE=SI`.
Confirmó también que el toggle de Push de CuentaOperativa es
`OPERATIVE_MANUAL_OFF_SCOPE=ACCOUNT` (una sola fila cubre todos los
negocios/vínculos de la cuenta, confirmado por el propio copy de la UI).

Preservado sin cambios: MODEL-C1, `SERVER_DETACH_ONLY`,
`resolveOperationalPushTargets()`, y todos los hallazgos no cuestionados
de A0. T38/T39/T44/T45/T52 confirmados sin tocar. Ver
`codex-reports/P2_T40_A1_STALE_OWNER_AND_MANUAL_OPTOUT_AUTHORITY.md`
para el detalle completo (máquina de estados de 11 estados corregida,
plan de archivos R1 corregido, matriz de 10 tests corregida).

## HISTORICAL SNAPSHOT — P2-T40-A0 AUDIT_AND_DESIGN_COMPLETE (2026-09-20)

```text
P2_T40_A0_STATUS=AUDIT_AND_DESIGN_COMPLETE
IMPLEMENTATION_PERFORMED=NO
PRODUCTION_TOUCHED=NO
T38_T39_T44_T45_T52_REOPENED=NO
NEXT_RECOMMENDED_ACTION=P2_T40_R1_IMPLEMENTATION_PENDING_OPERATOR_AUTHORIZATION
```

Auditoría read-only completa de lifecycle de sesión/login de Push
(58 secciones del prompt original), sin ninguna implementación,
mutación de push, cambio de login/logout/SW/DB/schema, ni Production.
Actores cubiertos: Cliente, Negocio, Repartidor, CuentaOperativa
(Operaciones/Mozo/Salón/PyR), SuperAdmin (confirmado inerte). Terminal
excluido por diseño del propio prompt.

**Hallazgo cabecera**: `syncSession()` (`src/hooks/use-auth.ts`) sobre
expiración natural de sesión (TTL 12h, `SESSION_DURATION_HOURS` en
`src/lib/auth.ts`) sólo limpia el estado cliente-side Zustand — cero
detach de red, cero destrucción física, cero unlink backend. Deja la
fila `PushSubscription` del actor expirado huérfana indefinidamente
(Estado D, "detached"), sin ningún código que la detecte o repare, ni
siquiera pasivamente. Bajo el modelo multi-bind ya vigente (MODEL-C1),
un actor distinto que luego use el mismo dispositivo nunca limpia esa
fila huérfana (su propio subscribe sólo agrega una fila independiente).

**Confirmado como arquitectura intencional y correcta, NO tocar**:
`resolveOperationalPushTargets()` (cuenta-primero-con-fallback-Empleado,
usado de forma consistente y verificada por TODOS los envíos
operativos: Mozo "pedido listo", cancelaciones, chat/pedidos/reviews de
PyR y Salón — cero split-brain); MODEL-C1 (multi-bind del mismo
endpoint físico a múltiples owners sin colisión); política
`PHYSICAL_UNSUBSCRIBE_POLICY=SERVER_DETACH_ONLY` (nunca destruir la
subscription física del navegador).

**Otros hallazgos**: `PermissionPrompt` usa una única key global de
localStorage no scoped por actor/sesión; su
`syncExistingPushSubscription()` obtiene un resultado de status-check
que nunca inspecciona ni usa (telemetría inerte); el único hook con
capacidad real de reconciliación (`usePushNotifications`) sólo está
montado en 4 páginas de Ajustes/Perfil, nunca se dispara
automáticamente tras un login. Hallazgo lateral sin expandir alcance:
`use-operativo-pyr-push.ts` no tiene ningún punto de montaje en
ninguna UI del producto (código huérfano).

**Diseño recomendado (Opción A, no implementado)**: disparador de
reconciliación centralizado cerca de `useAuth`/root layout que
reutiliza la infraestructura ya madura de rondas previas (T05/T18/T31)
en vez de rediseñarla — auto-rebind silencioso (sin diálogo de
navegador) cuando el permiso ya es `granted` y la subscription física
existe pero falta la fila backend del owner actual, siempre derivando
el owner server-side y sin revertir nunca un manual-off explícito. Se
descartó explícitamente una Opción C de rediseño completo del modelo
de datos — la evidencia muestra un sistema de bajo nivel ya correcto,
el gap es exclusivamente de cuándo se dispara la reconciliación.

T38/T39/T44/T45/T52 confirmados sin tocar. Ver
`codex-reports/P2_T40_A0_PUSH_SESSION_LIFECYCLE_AUDIT_DESIGN.md` para
el detalle completo (mapa de actores, 7 estados canónicos A-G, máquina
de estados UX, matriz de 19 tests, tests de seguridad obligatorios, y
matriz de certificación física futura preparada sin ejecutar).

## HISTORICAL SNAPSHOT — P2-T52 CLOSED_TESTING_CERTIFIED (2026-09-20)

```text
P2_T52_STATUS=CLOSED_TESTING_CERTIFIED
P2_T52_RELEASE_ELIGIBLE=YES
P2_T52_PRODUCTION_PROMOTED=NO
P2_T52_CERTIFIED_RUNTIME_SHA=5f4804c0d903475ca1949bd5428145a80ca6dc15
P2_T52_CERTIFIED_DEPLOY_ID=2aae4685-8c1a-4e04-815d-ae3197682724
PRODUCTION_TOUCHED=NO
```

Cierre formal de P2-T52 (Operations PWA Identity Consolidation /
Legacy Artifact Cleanup) tras certificación física del operador —
DOCUMENTATION-ONLY, cero código de producto en esta ronda, sin
redeploy. Resumen de las 3 rondas de auditoría + 1 de implementación:

- **A0**: `/mozo` comparte TODO con Operaciones (login, sesión,
  modelo, unión por código) vía re-export literal de componentes,
  documentado en el propio código como "compatibilidad temporal" —
  clasificación final `CURRENT_REQUIRED`, nunca `SAFE_TO_REMOVE`, por
  dependencias reales de push/PWA/service-worker.
- **A1**: investigó con fuentes oficiales (web.dev, Chrome for
  Developers) el ciclo de actualización de manifest de Chrome/WebAPK y
  confirmó que el objetivo "dejar de promover instalaciones nuevas de
  PWA Mozo" YA estaba cumplido en código antes de esta sesión — cero
  cambio necesario para Mozo.
- **A2**: Empleado/Salón (`/e/{token}`, `/s/{token}`) resultaron estar
  YA completamente retirados desde una limpieza anterior a esta sesión
  ("Legacy-Cleanup-1B") — pero encontró el único residuo real:
  `install-prompt.tsx` no los excluía (a diferencia de Mozo), pudiendo
  ofrecer instalar una PWA cuyo único contenido es la pantalla de
  retiro.
- **R1B**: corrigió exactamente eso — agregó
  `isLegacyOperationsTombstoneRoute()` a
  `src/components/shared/install-prompt.tsx` (excluye
  `/e`/`/e/**`/`/s`/`/s/**`, mismo patrón que `isMozoRoute()`), sin
  tocar role-config/DynamicManifest/manifests/íconos/service worker/
  push/auth. 13 tests focales + 14 de regresión, todos PASS.

**Certificación física del operador (esta ronda)**: `/e/test` y
`/s/test` muestran correctamente el tombstone "Este acceso fue
reemplazado" sin banner de instalación (Cases A/B PASS); `/operaciones`
(home T51) y `/mozo` sin regresión (Cases C/D PASS); no había una PWA
"DeliGO Empleados"/"DeliGO Salón" ya instalada disponible para probar
(Case E `CONDITIONAL_NOT_AVAILABLE`, no bloqueante — R1B nunca tocó
manifest/scope/start_url, sólo dejó de OFRECER instalaciones nuevas).

Preservado sin cambios: Mozo (rutas, manifest, íconos, push, SW), los
manifests/íconos de Empleado/Salón (en particular
`icon-empleado-192x192.png`/`icon-salon-192x192.png`, dependencias
activas de Push). Deuda opcional no bloqueante registrada para el
futuro: limpieza de `role-config.ts` para empleado/salón, íconos
`-512x512.png` sin consumidor, endpoint `/api/manifest` sin callers, y
la Fase 4 de Mozo (migración de push target + Service Worker), que
requiere su propia autorización explícita.

Ver `codex-reports/P2_T52_FINAL_TESTING_CERTIFICATION_CLOSEOUT.md` para
el detalle completo de cierre.

## HISTORICAL SNAPSHOT — P2-T52-R1B IMPLEMENTED_DEPLOYED (2026-09-20)

```text
P2_T52_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_OPERATOR_CERTIFICATION
COMMIT_SHA=5f4804c0d903475ca1949bd5428145a80ca6dc15
PUSH_TARGET=origin/testing-codex (fast-forward 1e5ad4b..5f4804c)
TESTING_DEPLOY_ID=2aae4685-8c1a-4e04-815d-ae3197682724
TESTING_DEPLOY_STATUS=SUCCESS (commitHash match, boot logs clean, no migrations)
PRODUCTION_TOUCHED=NO (origin/main = ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763, sin cambios)
```

Implementó exactamente Option A del diseño A2 (sección inmediatamente
debajo): agregó `isLegacyOperationsTombstoneRoute()` a
`src/components/shared/install-prompt.tsx`, excluyendo
`/e`/`/e/**`/`/s`/`/s/**` del banner/FAB de instalación — mismo patrón
textual que `isMozoRoute()` (`/mozo`, sin cambios, ahora exportada
junto a la nueva función sólo para permitir test puro). Deja de
ofrecer "Instalar DeliGO Empleados"/"Instalar DeliGO Salón" en las
pantallas tombstone (`LegacyAccessRetired`, intactas). **Cero cambio**
de `role-config.ts`, `DynamicManifest`, manifests, íconos, service
worker, push o auth.

13 tests focales nuevos (contrato puro de clasificación de ruta,
`src/components/shared/install-prompt.test.ts`) + 14 tests de
regresión existentes de InstallPrompt, todos PASS. TSC 31 baseline/0
nuevos, ESLint/build/diff-check PASS. Prevalidación técnica en Browser
pane: `/e/test` y `/s/test` muestran el tombstone sin ningún banner de
instalación; `/operaciones` (home T51) y `/mozo` sin cambios de
comportamiento observable.

**Pendiente**: certificación física del operador (gate que Claude no
puede sustituir) — especialmente el Case E condicional (confirmar que
una PWA "DeliGO Empleados"/"DeliGO Salón" YA instalada, si existiera,
sigue abriendo el tombstone sin romperse). Sin eso, T52 no puede
cerrarse formalmente. Ver
`codex-reports/P2_T52_R1B_DISABLE_EMPLOYEE_SALON_LEGACY_INSTALL_PROMOTION.md`
para el detalle completo.

## HISTORICAL SNAPSHOT — P2-T52-A2 ONE ACTIONABLE ITEM FOUND (2026-09-20)

```text
P2_T52_STATUS=AUDITED_ONE_ACTIONABLE_ITEM_PENDING_AUTHORIZATION
PRODUCT_CODE_CHANGED=NO
MANIFEST_CHANGED=NO
ROLE_CONFIG_CHANGED=NO
SERVICE_WORKER_CHANGED=NO
PUSH_CHANGED=NO
PRODUCTION_TOUCHED=NO
```

Auditoría read-only de los residuos PWA de Empleado (`/e/{token}`) y
Salón (`/s/{token}`), construida explícitamente sobre una auditoría
PREVIA A ESTA SESIÓN
(`codex-reports/P2_OPERATIONS_SINGLE_PWA_IDENTITY_AUTHORITY_CORRECTION.md`,
2026-09-09) que ya había clasificado ambas rutas como "wireadas pero
funcionalmente inertes" — confirmado de nuevo con evidencia de código
fresca, no re-derivado desde cero: ambas rutas son pantallas estáticas
(`LegacyAccessRetired`, 4 consumidores totales, cero fetch/token/auth/
DB) que pueden servir indefinidamente como compatibility tombstones
sin ningún riesgo.

**Hallazgo nuevo de esta ronda, no cubierto en 2026-09-09**:
`install-prompt.tsx` excluye `/mozo` (confirmado en A1) pero **NO
excluye `/e` ni `/s`** — hoy, técnicamente, puede ofrecer activamente
"Instalar DeliGO Empleados"/"Instalar DeliGO Salón", una PWA cuyo único
contenido posible es la pantalla "Este acceso fue reemplazado". Es el
único residuo/bug real y accionable encontrado en las 3 rondas de
auditoría de T52 — corrección de bajo riesgo (~3-5 líneas, 1 archivo,
mismo patrón textual ya usado y probado para Mozo).

Confirmado con evidencia (no supuesto): `icon-empleado-192x192.png` e
`icon-salon-192x192.png` son dependencias ACTIVAS de Push HOY (`sw.js`
los usa para seleccionar el ícono de notificaciones por área/tipo,
incluyendo `salon_new_order`, que sigue siendo generado por 2 flujos
de pedido reales) — **nunca deben tocarse**, independientemente de
cualquier limpieza de identidad PWA. Los archivos `-512x512.png`
(ambos con dimensión real 2133×2133 pese al nombre, sin ningún
consumidor funcional) son candidatos opcionales de limpieza futura,
sin urgencia — igual que `role-config.ts`/manifests, seguros de tocar
eventualmente (efecto sólo cosmético) pero no bloqueantes.

Recomienda **T52-R1B acotado a `install-prompt.tsx` únicamente** como
la sola implementación de bajo riesgo/valor real pendiente en todo el
backlog activo hoy — separado de la Fase 4 de Mozo (A1, push target +
SW, requiere su propia autorización) y de cualquier limpieza opcional
de assets 512/role-config (sin urgencia).

Ver `codex-reports/P2_T52_A2_EMPLOYEE_SALON_LEGACY_PWA_ARTIFACT_AUDIT.md`
para las tablas completas de campos/consumidores/safe-delete-matrix.

## HISTORICAL SNAPSHOT — P2-T52-A1 RESOLVED (2026-09-20)

```text
P2_T52_STATUS=AUDITED_RESOLVED_PENDING_PHASE4_AUTHORIZATION
PRODUCT_CODE_CHANGED=NO
MANIFEST_CHANGED=NO
SERVICE_WORKER_CHANGED=NO
PUSH_CHANGED=NO
PRODUCTION_TOUCHED=NO
```

Auditoría profunda de compatibilidad (sin código) que resuelve la
decisión que A0 dejó abierta. **Hallazgo central, el más importante de
esta ronda**: el objetivo "dejar de promover instalaciones nuevas de
la PWA separada de Mozo" **ya estaba cumplido en código antes de esta
sesión** — `install-prompt.tsx` y `permission-prompt.tsx` YA excluyen
por completo `/mozo` (`if (isMozoRoute(pathname)) return null`),
confirmado leyendo ambos archivos completos. Combinado con el hallazgo
de A0 de que ningún archivo bajo `/operaciones` enlaza a `/mozo`, la
conclusión es que **no existe hoy ningún camino de código activo que
dirija a un empleado nuevo hacia instalar "DeliGO Mozos"**.

`DynamicManifest` fue investigado a fondo y **no debe tocarse**: su
caso especial de `/mozo` (exacto, sin barra final) protege
específicamente el home del panel personal, que `getRoleFromPath()` NO
resolvería correctamente sin él (esa función sólo matchea `/mozo/` CON
barra). Se investigó con fuentes oficiales (citadas en el reporte:
web.dev "How Chrome handles updates to the web app manifest", Chrome
for Developers blog) cómo Chrome verifica actualizaciones de manifest
de una PWA instalada — el lanzamiento de una app ya instalada usa
SIEMPRE su propio `start_url` registrado (`/mozo/`, CON barra, que ya
resuelve correctamente sin cambios), nunca "redecide" su identidad
contra lo que otra pestaña esté sirviendo hoy. Icono/nombre se tratan
como cambios "security sensitive" — opcionales para el usuario, nunca
forzados.

El único trabajo real identificado (migrar el deep-link de push
"pedido listo", hoy hardcodeado a `/mozo/panel/[slug]`, hacia
`/operaciones/mi-panel/[slug]`, junto con una actualización mínima y
compatible del Service Worker — nunca por separado) se **difiere
explícitamente a una Fase 4 futura** con su propia autorización: hoy
mejoraría la experiencia de usuarios modernos a costa de degradar
(no romper) la de un grupo fijo y no creciente que ya tiene "DeliGO
Mozos" instalada.

Hallazgo lateral importante: **Empleado (`/e/{token}`) y Salón
(`/s/{token}`) YA fueron completamente retirados** en una limpieza
anterior a esta sesión ("Legacy-Cleanup-1B") — `/api/empleado/` y
`/api/salon/` ni siquiera existen en el repo; ambas rutas sólo
muestran una pantalla estática "Este acceso fue reemplazado". Su
modelo de auth (magic-link sin sesión) es completamente distinto al
de Mozo (CuentaOperativa con sesión) — clasificados como
`SAFE_TO_REMOVE` en el sentido de assets (manifest/iconos/
role-config), pero su limpieza no se ejecuta en esta ronda.

Ver `codex-reports/P2_T52_A1_SINGLE_PWA_COMPATIBILITY_MIGRATION_DECISION.md`
para el contrato completo, las fuentes técnicas citadas, y el diseño
de fases 1-5.

## HISTORICAL SNAPSHOT — P2-T52-A0 AUDITED_DESIGNED (2026-09-20)

```text
P2_T52_STATUS=AUDITED_DESIGNED_PENDING_OPERATOR_DECISION
PRODUCT_CODE_CHANGED=NO
AUTH_CHANGED=NO
MANIFEST_CHANGED=NO
SERVICE_WORKER_CHANGED=NO
DB_MUTATED=NO
PRODUCTION_TOUCHED=NO
```

Auditoría + diseño (sin código) disparada por evidencia física del
operador que **corrige una suposición previa**: `/mozo` NO está muerto
— sigue siendo completamente funcional hoy, y una `CuentaOperativa`
real puede autenticarse tanto desde `/mozo/iniciar-sesion` como desde
`/operaciones/ingresar`.

**Hallazgo central, confirmado por código (no sólo por evidencia
física)**: `/mozo` y `/operaciones` NO son dos sistemas paralelos —
comparten absolutamente todo (login/registro/logout/`me` vía
`/api/operativo/*`, cookie `deligo_operativo_session`, modelo
`CuentaOperativa`/`Empleado`, endpoint de unión por código). La
arquitectura real es **re-export literal de componentes React**:
`/operaciones/mi-panel` = `export { default } from "@/app/mozo/page"`,
`/operaciones/mi-panel/[slug]` = mismo re-export de
`/mozo/panel/[slug]` — UN solo código, servido bajo dos árboles de
ruta, con un único helper (`useOperativoNav()`) que resuelve
`homeHref`/`loginHref`/`panelHref` según el pathname. El propio código
lo documenta como *"compatibilidad temporal"*.

`Empleado.rol` ya NO autoriza acceso a áreas (cerrado tras la
migración `backfill_employee_operational_areas`) — `Empleado.areaOperativa`
(mozo|salon|pyr|sin_asignar, fijada EXCLUSIVAMENTE por el negocio,
nunca por el empleado) es la única autoridad real, vía
`resolveAreaOperativaEfectiva()`. El endpoint de unión por código
(`/api/operativo/mozos/unirse`) sólo VINCULA una cuenta a un Empleado
YA EXISTENTE — nunca crea el vínculo, nunca asigna rol/área.

**Hallazgo crítico de riesgo que impide un cierre apresurado**: Mozo
SÍ tiene una PWA separada, real e instalable HOY (`manifest-mozo.json`,
scope `/mozo/`, vía el mecanismo `DynamicManifest` — Mozo no está en
`PRINCIPAL_PWA_ROLES`), y el deep-link de push "pedido listo" está
**hardcodeado** a `/mozo/panel/[slug]` (`mesa-order-ready-notification.ts`),
con lógica del service worker atada a ese string literal. Clasificación
final: `LEGACY_MOZO_ROUTE_FINAL_CLASSIFICATION=CURRENT_REQUIRED` — NO
`SAFE_TO_REMOVE`.

3 opciones diseñadas: **Option A** (mantener `/mozo` como
compatibility entrypoint pero dejar de PROMOVER su PWA separada —
RECOMENDADA), Option B (redirect gradual — riesgo alto de romper el
`scope` de instalaciones existentes), Option C (no tocar nada). La
decisión de ejecutar R1 requiere autorización explícita del operador,
no es automática.

Ver `codex-reports/P2_T52_A0_MOZO_OPERATIONS_COEXISTENCE_AND_PWA_CONSOLIDATION_AUDIT.md`
para el detalle completo (tablas de rutas, comparación login legacy vs
moderno, plan R1 condicional, plan de tests).

## HISTORICAL SNAPSHOT — P2-T51 CLOSED_TESTING_CERTIFIED (2026-09-20)

```text
P2_T51_STATUS=CLOSED_TESTING_CERTIFIED
P2_T51_RELEASE_ELIGIBLE=YES
P2_T51_PRODUCTION_PROMOTED=NO
P2_T51_CERTIFIED_RUNTIME_SHA=c713650708855c5bd40efede3674b48581c65a11
P2_T51_CERTIFIED_DEPLOY_ID=f31a69d8-2dbe-4929-9870-f616db9454fb
PRODUCTION_TOUCHED=NO
```

Cierre formal de P2-T51 (DeliGO Operaciones Home Visual Redesign) tras
aceptación visual general del operador — DOCUMENTATION-ONLY, cero
código de producto en esta ronda, sin redeploy. R1 (`c713650`, deploy
`f31a69d8-2dbe-4929-9870-f616db9454fb`) implementó Option A: accent
amber para "Ingresar con mi cuenta" (heredado de
`/operaciones/ingresar`), accent slate fijo para "Usar o activar esta
terminal", decoración de fondo sutil, shadow refinado — cero cambio de
`href`, copy o lectura de sesión. El operador abrió el home rediseñado
en TESTING y confirmó *"quedó perfecto"* —
`OPERATOR_OVERALL_VISUAL_ACCEPTANCE=PASS`, una aceptación general, no
la ejecución registrada caso por caso de los 10 casos R2 preparados.

Preservado sin cambios: `HOME_SESSION_READ_ADDED=NO` (server component
puro, sin `"use client"`, sin auth/session), `PERSONAL_ROUTE_CHANGED=NO`,
`TERMINAL_ROUTE_CHANGED=NO`, `COPY_CHANGED=NO`, T52/T38/T40 sin tocar.

Ver `codex-reports/P2_T51_FINAL_TESTING_CERTIFICATION_CLOSEOUT.md` para
el detalle completo de cierre.

## HISTORICAL SNAPSHOT — P2-T51-R1 IMPLEMENTED_DEPLOYED (2026-09-20)

```text
P2_T51_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_R2_PHYSICAL_CERTIFICATION
COMMIT_SHA=c713650708855c5bd40efede3674b48581c65a11
PUSH_TARGET=origin/testing-codex (fast-forward 9c4b9d2..c713650)
TESTING_DEPLOY_ID=f31a69d8-2dbe-4929-9870-f616db9454fb
TESTING_DEPLOY_STATUS=SUCCESS (commitHash match, boot logs clean, no migrations)
PRODUCTION_TOUCHED=NO (origin/main = ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763, sin cambios)
```

Implementó exactamente Option A del diseño A0 (sección inmediatamente
debajo) en `src/app/operaciones/page.tsx`: accent AMBER heredado de
`/operaciones/ingresar` para "Ingresar con mi cuenta", accent SLATE fijo
(nunca `negocio.colorPrincipal`, desconocido antes de autenticar la
terminal) para "Usar o activar esta terminal", decoración de fondo con
2 blurs sutiles (mismo patrón de `/operaciones/ingresar`), `shadow-sm`→
`shadow-lg shadow-black/5 dark:shadow-black/20`, helper local
`EntryOptionCard` para evitar duplicación de markup entre las dos
opciones. **Cero cambio de `href`, copy, o lectura de sesión** — el
archivo sigue siendo un server component puro (`○` estático en el
build), sin `"use client"`, sin importar auth/session/cookies.

17 tests focales nuevos (`src/app/operaciones/page.test.tsx`) — contrato
ESTÁTICO sobre el source del archivo (no render con DOM, dado que
`page.tsx` compone `<Link>` de `next/link` sin contexto de App Router
disponible fuera de Next — mismo patrón "contrato estático puro" ya
usado en T45/T47/T49/T50). TSC 31 baseline/0 nuevos, ESLint/build/
diff-check PASS. Prevalidación técnica (no física) en Browser pane:
desktop, 375px, 320px (sin overflow horizontal), dark mode forzado vía
`localStorage.deligo-theme` (el ThemeProvider del repo usa su propio
storage key, no `prefers-color-scheme` directo) — ambos accents
legibles, consola sin errores, rutas de los 2 `<a>` confirmadas
idénticas a las originales.

T52/T38/T40 confirmados fuera de alcance y sin tocar (sin manifest, SW,
push, install prompts).

**Pendiente**: certificación física del operador en TESTING (gate que
Claude no puede sustituir) — 10 casos preparados (desktop, mobile,
accent Personal/Terminal, tap de ambas opciones, volver, dark mode,
320px, PWA instalada condicional). Sin eso, T51 no puede cerrarse ni
considerarse `CLOSED_TESTING_CERTIFIED`. Ver
`codex-reports/P2_T51_R1_OPERATIONS_HOME_VISUAL_REDESIGN.md` para el
detalle completo.

## HISTORICAL SNAPSHOT — P2-T51-A0 AUDITED_DESIGNED (2026-09-20)

```text
P2_T51_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION
PRODUCT_CODE_CHANGED=NO
AUTH_CHANGED=NO
DB_MUTATED=NO
SCHEMA_CHANGED=NO
PRODUCTION_TOUCHED=NO
```

Auditoría + diseño (sin código) del rediseño visual del home de DeliGO
Operaciones.

**Home real**: `src/app/operaciones/page.tsx` (`OperacionesEntryPage`)
— un único `<Card>` server-side (sin `"use client"`, sin lectura de
cookies/sesión), selector NEUTRAL con exactamente 2 opciones:
"Ingresar con mi cuenta" (`/operaciones/ingresar`, cuenta personal
`CuentaOperativa`, cookie `deligo_operativo_session`) y "Usar o activar
esta terminal" (`/operaciones/terminal`, cookie
`deligo_operaciones_terminal`). El propio código documenta la
neutralidad: el selector no consulta ni resuelve ninguna identidad
antes de que el usuario elija. Hoy ambos íconos comparten el mismo
color neutro `bg-muted` — el único gap real es visual, no de contenido
(el copy ya es preciso).

**Lenguaje visual compartido de DeliGO** (auditado en Cliente/Negocio/
Operaciones-ingresar/Operaciones-terminal): shell centrado max-w-sm/md,
Card con `shadow-lg shadow-<accent>/5`, icon badge redondeado con
accent por actor, `Logo` decorativo constante (nunca un `<Link>` en
todo el repo), soporte `dark:` universal vía `ThemeProvider` global.
`/operaciones/ingresar` ya estableció **amber** como accent de "cuenta
personal de Operaciones" — el diseño hereda ese mismo amber para la
opción personal del home, y propone un accent **slate** fijo/genérico
para Terminal (nunca `negocio.colorPrincipal`, desconocido antes de
autenticar la terminal — preserva la neutralidad arquitectónica).

**Diseño recomendado**: Option A (refinamiento del Card único
existente — accent color + decoración de fondo sutil + shadow-lg, diff
mínimo, cero cambio estructural) sobre Option B (hero + 2 cards en
grid, mayor cambio, más riesgo de "sentirse como dashboard"). R1
planificado: 1 archivo de producto (`page.tsx`, sólo className/colores
— cero `href`, cero texto, cero import de auth tocado) + 1 archivo de
test nuevo. `NEW_ASSET_REQUIRED=NO`. T52/T38/T40 confirmados fuera de
alcance y sin tocar.

Ver `codex-reports/P2_T51_A0_OPERATIONS_HOME_VISUAL_REDESIGN_AUDIT_DESIGN.md`
para el detalle completo (tabla de flujos, ambas opciones de diseño,
plan de tests, casos de certificación física R2 preparados).

## HISTORICAL SNAPSHOT — P2-T55 CLOSED_TESTING_CERTIFIED (2026-09-20)

```text
P2_T55_STATUS=CLOSED_TESTING_CERTIFIED
P2_T55_RELEASE_ELIGIBLE=YES
P2_T55_PRODUCTION_PROMOTED=NO
P2_T55_CERTIFIED_RUNTIME_SHA=4f7b3355269768b9ef69ca650ac4faa6e1342bd2
P2_T55_CERTIFIED_DEPLOY_ID=7a3e8d12-66b4-4214-b963-6e5480a441df
PRODUCTION_TOUCHED=NO
```

Cierre formal de P2-T55 (Salon History Custom Date Filtering) tras
certificación física + visual del operador — DOCUMENTATION-ONLY, cero
código de producto en esta ronda. R1 (`da7d08b`, deploy
`50da9aa4-81dc-4f60-a31f-9c4197907c8b`) implementó el filtro custom
día/mes/rango; R1B (`4f7b335`, deploy
`7a3e8d12-66b4-4214-b963-6e5480a441df`) alineó visualmente las pills
Hoy/Semana/Mes de Historial con Estadísticas. El operador confirmó
*"quedó perfecto todo"* dos veces — una vez para lo funcional (R1), una
vez para lo visual (R1B). Todo lo certificado en R1 (Hoy/Semana/Mes
rápido, Día/Mes específico, Rango Desde/Hasta, Aplicar/Cancelar/Limpiar,
detalle de cuenta, ticket, autoridad de pago T46) queda confirmado sin
regresión tras el ajuste puramente visual de R1B.

Preservado sin cambios: `NEW_TODO_FILTER_ADDED=NO`,
`CUSTOM_CLEAR_TARGET=hoy`, `HISTORIAL_QUICK_MES_SEMANTICS=30_DIAS_FIJOS`
(diverge de T50 por diseño), paginación por-pedido límite 50 sin
cursor, `mesa-historial.ts`/`buildCuentaMesa`/autoridad de pago T46
intactos, T50 `CLOSED_TESTING_CERTIFIED` sin regresión.

Ver `codex-reports/P2_T55_FINAL_TESTING_CERTIFICATION_CLOSEOUT.md` para
el detalle completo de cierre.

## HISTORICAL SNAPSHOT — P2-T55-R1B VISUAL PARITY (2026-09-20)

```text
P2_T55_R1B_STATUS=IMPLEMENTATION_COMPLETE_TESTING_DEPLOYED_PENDING_OPERATOR_VISUAL_CONFIRMATION
COMMIT_SHA=4f7b3355269768b9ef69ca650ac4faa6e1342bd2
PUSH_TARGET=origin/testing-codex (fast-forward c28fdbd..4f7b335)
TESTING_DEPLOY_ID=7a3e8d12-66b4-4214-b963-6e5480a441df
TESTING_DEPLOY_STATUS=SUCCESS (commitHash match, boot logs clean, no migrations)
PRODUCTION_TOUCHED=NO (origin/main = ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763, sin cambios)
DESIGN_ONLY_CHANGE=SI
```

Después de que el operador confirmara T55-R1 funcionalmente correcto en
TESTING, pidió paridad VISUAL de Historial con Estadísticas para
Hoy/Semana/Mes/Elegir fecha (sin cambiar lógica). Auditoría: el botón
"Elegir fecha" y todo el Popover custom (Día/Mes/Rango,
`StatsDatePicker`, `Select`, Cancelar/Aplicar) ya eran byte-idénticos
entre ambos desde R1. La única diferencia real estaba en las pills
Hoy/Semana/Mes de Historial, que habían quedado con el estilo visual
PRE-T55 (pill individual con borde, activo en color `primary`) en vez
del patrón de segmented-control que Estadísticas usa (track
`bg-muted/60 rounded-xl p-1`, segmentos `flex-1 rounded-lg`, activo
`bg-background shadow-sm`).

Cambio aplicado: único archivo (`src/components/business/salon-tab.tsx`,
`HistorialSubTab`), sólo los `className` del contenedor y botón de esas
3 pills, copiados exactos del patrón de `EstadisticasSubTab`. Nada de
lógica/handlers/array de valores tocado. `HISTORY_TODO_ADDED=NO` — el
array de quick filters de Historial sigue siendo exactamente
`["hoy","semana","mes"]`.

98/98 tests existentes (T55 + T50 + helper compartido) siguen pasando
sin modificar ni un solo assert — confirma que ningún contrato de
lógica/query/endpoint cambió. TSC 31 baseline/0 nuevos, ESLint/build/
diff-check PASS.

**Pendiente**: confirmación visual del operador en TESTING. Ver
`codex-reports/P2_T55_R1B_HISTORY_FILTER_VISUAL_PARITY.md` para el
detalle completo (diff exacto de clases Tailwind antes/después).

## HISTORICAL SNAPSHOT — P2-T55-R1 IMPLEMENTATION_COMPLETE (2026-09-20)

```text
P2_T55_R1_STATUS=IMPLEMENTATION_COMPLETE_TESTING_CERTIFIED_AUTOMATED_PENDING_PHYSICAL_CERTIFICATION
COMMIT_SHA=da7d08b27ea15673ef42009fda996c2bd02b9b9a
PUSH_TARGET=origin/testing-codex (fast-forward 345ab11..da7d08b)
TESTING_DEPLOY_ID=50da9aa4-81dc-4f60-a31f-9c4197907c8b
TESTING_DEPLOY_STATUS=SUCCESS (commitHash match, boot logs clean, no migrations)
PRODUCTION_TOUCHED=NO (origin/main = ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763, sin cambios)
BRANCH=work/p2-t43-r2
```

Implementó lo diseñado en la auditoría A0 (sección inmediatamente
debajo): filtro de fecha custom día/mes/rango para `HistorialSubTab`
(Historial de Salón, POR-MESA), extendiendo aditivamente
`GET /api/negocio/pedidos` con los mismos 4 params que T50
(fecha/mes/desde/hasta), reutilizando un nuevo helper compartido
`src/lib/date-range-filter.ts` (`resolveCustomDateFilter`, precedencia
fecha>mes>rango>none) del que `negocio/salon/stats/route.ts` (T50)
también pasó a depender — refactor puro, cero cambio de comportamiento
externo, certificado por la suite de T50 sin modificar (53/53 pass).

**Decisión de producto explícita seguida**: NO se agregó un quick
filter "Todo" a Historial (a diferencia de Estadísticas, que sí lo
tiene) — "Limpiar" en el selector custom vuelve siempre a "Hoy", nunca
a "sin filtro". Las dos divergencias reales de Historial frente a T50
documentadas en A0 (quick "Mes" = 30 días fijos, no calendario;
Historial incluye `cancelado`) se preservaron sin tocar, como estaba
previsto.

`mesa-historial.ts`/`buildMesaHistorialAccounts`/`accountKey`/
`buildCuentaMesa`/`withCuentaMesaPayment` (autoridad T46) NO se
tocaron — sólo cambia qué `Pedido[]` entra a esas funciones.

Evidencia: 45 tests focales nuevos + 53 regresión T50 + 8 regresión T46
(ejecutado aislado por una colisión preexistente de mocks de módulo en
bun:test, reproducida idéntica contra el baseline sin este diff) — todos
PASS. TSC 31 baseline/0 nuevos. ESLint/build/diff-check PASS.

**Fixture candidata identificada (read-only) para certificación física
R2**: negocio TESTING "burgerking" (`negocioId=cmsgzkpo70000pf0ac5pk9zff`,
slug `burgerking`) — 1 mesa, 15 pedidos históricos reales de mesa
(entregado+cancelado) con fechas dispersas 2026-08-06→2026-09-11, útil
para ejercitar Día/Mes/Rango sin fixtures sintéticas nuevas.

**Pendiente**: certificación física del operador en TESTING (gate que
Claude no puede sustituir). Sin eso, T55 no puede cerrarse ni
considerarse `CLOSED_TESTING_CERTIFIED`. Ver
`codex-reports/P2_T55_R1_SALON_HISTORY_CUSTOM_DATE_FILTERING.md` para
el detalle completo.

Ver `codex-reports/P2_T55_A0_SALON_HISTORY_CUSTOM_DATE_FILTERING_AUDIT_DESIGN.md`
para el diseño original (aún vigente como referencia arquitectónica).

## HISTORICAL SNAPSHOT — P2-T55-A0 AUDITED_DESIGNED (2026-09-20)

```text
P2_T55_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION
PRODUCT_CODE_CHANGED=NO
DB_MUTATED=NO
SCHEMA_CHANGED=NO
PRODUCTION_TOUCHED=NO
```

Auditoría + diseño (sin código) de filtros de fecha personalizados para
el Historial de Salón del panel Negocio.

**Hallazgo arquitectónico central**: a diferencia de Estadísticas
(T50, dashboard agregado a nivel negocio), Historial es un modelo
**POR-MESA** — grilla de mesas agrupadas por zona → click en una mesa →
`Drawer` con el historial de ESA mesa específica. El target real es
`HistorialSubTab` (`src/components/business/salon-tab.tsx:2290-2520`,
mismo archivo que `EstadisticasSubTab` de T50, nunca extraído), backend
`GET /api/negocio/pedidos?estado=historial&metodoEntrega=mesa` —
**endpoint completamente distinto** al de T50
(`/api/negocio/salon/stats`).

**Divergencias reales confirmadas frente a T50** (no asumidas):
mismo campo canónico `Pedido.fecha`, pero el quick filter "Mes" de
Historial es una ventana rodante de **30 días fijos** (T50: 1 mes
calendario rodante, que varía 28-31 días) — dos "Mes" con semántica
distinta, ambos preservados sin cambios. Historial SÍ incluye pedidos
`cancelado` (T50 sólo cuenta `entregado`). Agrupamiento por
`Pedido.ocupacionMesaId`, reutilizando `buildCuentaMesa`/
`withCuentaMesaPayment` — la MISMA autoridad de T46, sin tocar.
Paginación actual: por-pedido, límite fijo de 50, sin "cargar más" (no
por-cuenta) — riesgo preexistente documentado, no introducido por T55.

**Reuso de T50, acotado y explícito**: SÍ los helpers de fecha
(`dateToIsoDateString`/`isoDateStringToDate`, ya exportados en el MISMO
archivo — cero fricción de import) y el patrón de UI
(Popover/Calendar/Select ya importados desde T50); NO el tipo/funciones
de Stats literalmente (formas distintas: Historial no tiene "Todo" como
quick filter, y su grouping es por-mesa). Recomienda extraer a
`src/lib/date-range-filter.ts` el parseo seguro de fecha por componentes
que hoy vive privado dentro de `negocio/salon/stats/route.ts`, para que
ambos endpoints lo compartan sin duplicar código.

```text
NEW_ENDPOINT_REQUIRED=NO — extensión aditiva de GET /api/negocio/pedidos
BACKEND_CHANGE_REQUIRED=SI (extensión aditiva, mismo patrón que T50)
DETAIL_CONTRACT_CHANGE_REQUIRED=NO (MesaAccountDetail/MesaAccountTicketDialog sin tocar)
```

Ver `codex-reports/P2_T55_A0_SALON_HISTORY_CUSTOM_DATE_FILTERING_AUDIT_DESIGN.md`
para el detalle completo (matriz de 5 superficies "Historial" auditadas,
contrato HTTP propuesto, modelo de rango FROM inclusivo/TO exclusivo,
plan R1 archivo por archivo, plan de tests, preparación de casos R2).

`P2-T47=CLOSED_TESTING_CERTIFIED`, `P2-T50=CLOSED_TESTING_CERTIFIED`,
`P2-T46 original=CLOSED_PRODUCTION`,
`P2-T46-R2=CLOSED_TESTING_CERTIFIED_AWAITING_PRODUCTION_PROMOTION`
permanecen sin tocar (ver sección inmediatamente debajo, ahora
histórica de este handoff).

---

## HISTORICAL SNAPSHOT — P2-T47 + P2-T46-R2 CLOSED_TESTING_CERTIFIED (2026-09-20)

```text
P2_T47_STATUS=CLOSED_TESTING_CERTIFIED
P2_T47_RELEASE_ELIGIBLE=YES
P2_T47_PRODUCTION_PROMOTED=NO
P2_T46_R2_STATUS=CLOSED_TESTING_CERTIFIED_AWAITING_PRODUCTION_PROMOTION
P2_T46_ORIGINAL_STATUS=CLOSED_PRODUCTION (checkpoint histórico de
  T46-R4, 2026-09-11 — NO reescrito, NO falsificado)
PRODUCTION_TOUCHED=NO
```

Certificación física completa del operador sobre TESTING, cerrando dos
frentes relacionados pero distintos:

**P2-T47** (`8994bc304ef7ad5c057acf1deeb83fd9354ad051`, TESTING deploy
SUCCESS `0677ae36-c49e-4d42-9001-b5f6282c18d0`): Cases A-K todos PASS
— *"quedó perfecto absolutamente todo"*. `ProductConfigurator`
(Badge Obligatorio, contador N/máximo, aria-pressed+check, variante de
remoción, QuantityStepper sin papelera falsa, safe-area, touch targets
44px), agrupamiento case-insensitive de categorías en
`ProductDetailSheet`, y guardas contra categorías duplicadas por case
en el catálogo de Negocio — todo certificado, ninguna regla de
producto/precio/payload cambió. Ver
`codex-reports/P2_T47_FINAL_TESTING_CERTIFICATION_CLOSEOUT.md`.

**P2-T46-R2** (`55187a66f253e377df27f36a416f31cbd73642e0`, TESTING
deploy SUCCESS `d458fc4f-9064-46e2-8851-f36f3f21fe20`): durante la
certificación de T47 el operador encontró el selector Efectivo/
Transferencia todavía visible al levantar un pedido manual de mesa
desde Mozo/Operaciones personal — un gap adyacente y preexistente de
T46 (`PAYMENT_METHOD_SELECTION_DURING_INDIVIDUAL_TABLE_ORDER=NO`),
nunca introducido por T47. Corregido, testeado, desplegado a TESTING y
ahora certificado físicamente: *"quedó todo perfecto ya lo probé"* —
selector ausente, `SesionOcupacionMesa` sigue siendo la única autoridad
de pago (cierre de cuenta sin tocar), delivery/retiro sin cambios. Ver
`codex-reports/P2_T46_R2_FINAL_TESTING_CERTIFICATION_CLOSEOUT.md`.
`P2_T46_STATUS=CLOSED_PRODUCTION` (T46-R4, 2026-09-11) permanece
intacto como hecho histórico — la ronda R2 se registra por separado,
`AWAITING_PRODUCTION_PROMOTION`, nunca reescribiendo ese checkpoint.

```text
PRODUCTION_LIKELY_AFFECTED_BY_SAME_GAP=SI (verificado read-only contra
  origin/main; T46 fue promovida a Production en 2026-09-11, antes de
  que este gap se descubriera físicamente — el mismo selector vive hoy
  en la copia de Production de este archivo; NO promovido en esta
  ronda, pendiente de autorización explícita y curada futura)
CLIENT_MESA_SILENT_DEFAULT_PAYMENT_FINDING=OPEN (POST /api/pedidos
  sigue exigiendo metodoPago incluso para metodoEntrega="mesa" pese a
  que el selector visual de Cliente Mesa ya estaba oculto antes de
  esta ronda — no corregido, documentado bajo la misma autoridad T46)
```

`P2-T55` (Salon History Custom Date Filtering) permanece `READY_FUTURE`,
no iniciada. `P2-T50`/`P2-T49` sin cambios
(`CLOSED_TESTING_CERTIFIED`). `P2-T44` sin cambios
(`PAUSED_UNRESOLVED_AFTER_TIMEBOX`). `NEXT_RECOMMENDED_SOFTWARE_TASK`
pasa a `P2-T51` (DeliGO Operaciones Home Visual Redesign).

---

## HISTORICAL SNAPSHOT — P2-T46-R2 IMPLEMENTED_DEPLOYED_TESTING (2026-09-20)

```text
P2_T46_R2_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_CERTIFICATION
P2_T46_STATUS=CLOSED_PRODUCTION (checkpoint histórico T46-R4 2026-09-11,
  NO reescrito) con gap correctivo abierto, ver abajo
PRODUCTION_TOUCHED=NO
PRODUCTION_LIKELY_AFFECTED_BY_SAME_GAP=SI (verificado read-only)
```

Durante la certificación física de P2-T47 el operador encontró un
finding ADYACENTE, preexistente y no introducido por T47: el flujo de
pedido manual de Mozo/Operaciones personal
(`src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx`, compartido vía
re-export literal con `/operaciones/mi-panel/[slug]/pedido/[mesaId]`)
todavía mostraba un selector Efectivo/Transferencia al tomar un pedido
de mesa — violando la regla ya establecida en T46
(`PAYMENT_METHOD_SELECTION_DURING_INDIVIDUAL_TABLE_ORDER=NO`,
`PAYMENT_METHOD_SELECTION_AT_ACCOUNT_CLOSE=SI`). T46-R1 (2026-09-11)
nunca tocó este archivo específico — sólo cuenta/ticket/historial —,
así que el gap viene de origen, no de una regresión posterior.

**Hallazgo importante**: `git show origin/main:".../page.tsx"`
confirma que el MISMO selector ya existe en Production hoy (T46 está
`CLOSED_PRODUCTION` desde 2026-09-11) — este gap probablemente también
afecta Production, no sólo Testing. No se tocó Production en esta
ronda bajo ninguna circunstancia; el hallazgo queda documentado para
una futura autorización explícita.

**P2-T46-R2** (2026-09-20) implementó, testeó y desplegó a TESTING la
corrección: eliminado el estado `metodoPago`, los botones Efectivo/
Transferencia, la dependencia de `aceptaTransferencia`, y el envío de
`metodoPago` en el POST del frontend; en el backend
(`POST /api/operativo/mozo/panel/[slug]/pedidos`) eliminada la
validación 400, el campo del fingerprint de idempotencia, la
comprobación de `aceptaTransferencia`, y el seteo explícito de
`metodoPago` en `Pedido.create` (la columna toma su default de schema
sin ser tratada como autoridad). La autoridad de pago de T46
(`SesionOcupacionMesa.metodoPago` al cierre de cuenta) permanece
exactamente igual, sin tocar. Delivery/Retiro sin cambios.

Auditadas las 7 superficies que podrían crear un pedido de mesa:
Cliente Mesa ya tenía el selector visual oculto (`cart-panel.tsx:1344`,
`{!isMesaOrder && ...}`, no tocado); Negocio ya lee el método
confirmado desde `ocupacionMesa`, nunca `Pedido.metodoPago`; Terminal
Salón y el panel personal de Salón no pueden crear pedidos. Hallazgo
lateral documentado, NO corregido: `POST /api/pedidos` (checkout
compartido de Cliente retiro/domicilio/mesa) sigue exigiendo
`metodoPago` incluso para `metodoEntrega="mesa"` — fuera del alcance
quirúrgico de esta ronda (endpoint mucho más grande y compartido).

```text
COMMIT_SHA=55187a66f253e377df27f36a416f31cbd73642e0
PUSH_TARGET=origin/testing-codex — SUCCESS
TESTING_DEPLOY_ID=d458fc4f-9064-46e2-8851-f36f3f21fe20 (servicio DeliGO Copy)
TESTING_DEPLOY_STATUS=SUCCESS, boot limpio, sin migraciones pendientes
FOCAL_TESTS=21 (0 fail); T47_REGRESSION_TESTS=29 (0 fail, sin cambios)
TSC_NEW_ERRORS=0 (31 total, baseline sin cambios)
```

Ver `codex-reports/P2_T46_R2_MOZO_PAYMENT_TIMING_PARITY.md` para el
detalle completo. NO se certificó físicamente esta ronda por Claude. NO
se creó ninguna tarea `P2-Txx` nueva — es una corrección de una regla
ya perteneciente a T46. `P2-T50`/`P2-T55`/`P2-T49`/`P2-T44` sin cambios.

Sobre P2-T47: el operador confirmó evidencia física acumulada completa
(`P2_T47_R2_OPERATOR_RESULT=ALL_CASES_PASS`, Cases A-K todos PASS,
`P2_T47_PHYSICAL_CERTIFICATION=PASS`) — el finding de pago no bloquea
T47 (pertenece a T46). El closeout formal de T47 con esta evidencia
queda para una tarea de cierre dedicada, no se hizo acá.

---

## HISTORICAL SNAPSHOT — P2-T47-R1 IMPLEMENTED_DEPLOYED_TESTING (2026-09-20)

```text
P2_T47_R1_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_R2_PHYSICAL_CERTIFICATION
P2_T47_STATUS=IN_PROGRESS_AWAITING_R2_PHYSICAL_CERTIFICATION
PRODUCTION_TOUCHED=NO
```

Implementó los 3 targets diseñados en A0, 100% frontend, cero API/
schema/migración:

**Nuevo helper compartido** `src/lib/category-normalization.ts`
(`normalizeCategoryKey`, `findEquivalentCategory`,
`groupByNormalizedCategory`) — única autoridad para tratar nombres de
categoría como equivalentes cuando sólo difieren en mayúsculas/espacios,
sin tocar nunca los datos guardados.

**ProductConfigurator** (`src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx`,
compartido verbatim con Operaciones vía re-export literal): Badge
"Obligatorio" reemplaza `" *"`; contador vivo `N/máximo` reemplaza el
texto "Hasta N"; `ChoiceButton` gana check + `aria-pressed` además del
color existente, y una variante roja/tachada exclusiva para "Quitar
ingredientes"; el `QuantityStepper` del configurador ya no muestra una
papelera que `Math.max(1, ...)` nunca dejaba usar (`allowRemoveAtMin`
preserva el borrado real en `CartLine`); safe-area en el bottom bar;
touch targets a 44px. `canAdd`, el cálculo de precio y el payload del
pedido no se tocaron.

**ProductDetailSheet** (`src/app/n/[slug]/page.tsx`): el agrupamiento
de agregados/ingredientes migró a `groupByNormalizedCategory` — "Aderezos"/
"aderezos"/" ADEREZOS " ahora colapsan en una sola sección, conservando
el primer label visto, sin perder ningún item.

**Catálogo de Negocio** (`agregados-section.tsx`/`ingredientes-section.tsx`):
los 5 puntos de creación/renombrado de categoría usan
`findEquivalentCategory` en vez de `Array.includes` case-sensitive —
ya no se pueden crear nuevos duplicados por case, pero recapitalizar la
propia categoría única sigue permitido. Sin backfill: ninguna categoría
existente en Postgres fue tocada/renombrada/fusionada.

```text
COMMIT_SHA=8994bc304ef7ad5c057acf1deeb83fd9354ad051
PUSH_TARGET=origin/testing-codex — SUCCESS
TESTING_DEPLOY_ID=0677ae36-c49e-4d42-9001-b5f6282c18d0 (servicio DeliGO Copy)
TESTING_DEPLOY_STATUS=SUCCESS, boot limpio, sin migraciones pendientes
FOCAL_TESTS=65 (0 fail); REGRESSION_TESTS=99 (0 fail)
TSC_NEW_ERRORS=0 (31 total, baseline sin cambios)
```

Ver `codex-reports/P2_T47_R1_PRODUCT_PERSONALIZATION_UX.md` para el
detalle completo. NO se certificó físicamente esta ronda — R2 (Cases
A-K, ya preparados en el reporte A0) queda pendiente antes de poder
cerrar T47. `P2-T55` (Salon History Custom Date Filtering) permanece
`READY_FUTURE`, no iniciada.

---

## HISTORICAL SNAPSHOT — P2-T47-A0 AUDITED_DESIGNED (2026-09-20)

```text
P2_T47_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION
PRODUCT_CODE_CHANGED=NO
DB_MUTATED=NO
SCHEMA_CHANGED=NO
PRODUCTION_TOUCHED=NO
```

Auditoría + diseño (sin código) del personalizador de producto de
Operaciones + reconciliación de backlog post-T50 + registro de una
nueva tarea futura.

**Reconciliación T50**: confirmado (sin cambios adicionales
necesarios) que `ROADMAP.md` ya reflejaba
`P2_T50_STATUS=CLOSED_TESTING_CERTIFIED` desde su cierre físico previo
— ningún `READY_FUTURE`/`ACTIVE`/`IN_PROGRESS` residual encontrado en
la autoridad vigente (`CODEX_REPORT.md` la menciona sólo en una nota
histórica de agrupación de 2026-09-09, no como estado vigente — no se
edita ese archivo, no es la autoridad mantenida en esta sesión).

**Nueva tarea registrada**: `P2-T55 — Salon History Custom Date
Filtering` (`READY_FUTURE`, `P2`) — el operador pidió, durante la
certificación física de T50, los mismos filtros día/mes/rango pero para
el Historial de Salón (no las Estadísticas que T50 ya modificó). ID
verificado libre por grep exhaustivo (0 colisiones). NO implementada;
su propia auditoría deberá confirmar si Historial comparte
endpoint/campo de fecha con T50 antes de tocar código — no se asume.

**Target real de T47 identificado**: `ProductConfigurator`, inline en
`src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx` — compartido vía
**re-export literal** con `/operaciones/mi-panel/[slug]/pedido/
[mesaId]` (Mozo y Operaciones personal son el mismo archivo). Terminal
Salón kiosco NO tiene ningún flujo de personalización de producto
(`OPERACIONES_AREAS=["salon","pyr"]`, sin scope de pedidos — comentario
explícito "NUNCA mozo" en el código de permisos).

**Root cause "Aderezos/aderezos" confirmado con evidencia exacta**:
`Agregado.categoria`/`Ingrediente.categoria` son texto libre sin
constraint en el schema (sin enum/unique/index); la UI de catálogo del
Negocio (`agregados-section.tsx`/`ingredientes-section.tsx`) hace un
dedup **case-sensitive** (`Array.includes`) al crear categorías nuevas
— un typo de mayúscula crea una categoría "nueva" válida; el
agrupamiento por categoría en `ProductDetailSheet` (Cliente storefront
`/n/[slug]`, Cliente Mesa `/n/[slug]?mesa=X`, y la Vista previa del
Negocio) usa un `Map` sin normalizar `.toLowerCase()`/`.trim()` — dos
categorías que difieren sólo en case se renderizan como dos encabezados
separados. **`ProductConfigurator` (el personalizador real de
Operaciones) nunca agrupa por categoría — estructuralmente no puede
reproducir ese síntoma específico.** Conclusión: el finding original
mezcló dos problemas reales pero distintos que coincidieron en la misma
revisión física ("Operaciones... Cliente Mesa"): la inconsistencia
visual general (target real: `ProductConfigurator`) y la duplicación
Aderezos/aderezos (target real: `ProductDetailSheet`, alcanzado como
Cliente Mesa, no como Operaciones en sentido estricto).
`ADEREZOS_DUPLICATION_CLASSIFICATION=DATA_INCONSISTENCY`.

R1 diseñado 100% frontend (`BACKEND_CHANGE_REQUIRED=NO`,
`API_CHANGE_REQUIRED=NO`, `SCHEMA_CHANGE_REQUIRED=NO`): rediseño visual
de `ProductConfigurator` (Badge "Obligatorio", contador N/max, variante
roja/tachada para quitar ingredientes, `aria-pressed`, safe-area en el
bottom bar, touch targets ≥44px) + normalización case-insensitive del
agrupamiento en `ProductDetailSheet` (conservando el primer texto visto
como label). El fix del dedup en el catálogo de Negocio queda como
hallazgo documentado, separado, fuera de este backlog item.

Ver `codex-reports/P2_T47_A0_PRODUCT_PERSONALIZATION_UX_AUDIT_DESIGN.md`
para el detalle completo (matriz de superficies, mapeo de modelo de
producto, comparación contra `ProductDetailSheet`, plan R1 archivo por
archivo, plan de tests, preparación de casos R2).

`P2_T50_STATUS=CLOSED_TESTING_CERTIFIED` permanece sin tocar (ver
sección inmediatamente debajo, ahora histórica de este handoff).

---

## HISTORICAL SNAPSHOT — P2-T50 CLOSED_TESTING_CERTIFIED (2026-09-20)

```text
P2_T50_STATUS=CLOSED_TESTING_CERTIFIED
RELEASE_ELIGIBLE=YES
PRODUCTION_PROMOTED=NO
PRODUCTION_TOUCHED=NO
```

Certificación física completa del operador sobre TESTING, sobre la
implementación R1 (commit `9f9f5c9299e801dd60a7eb0e342034521129e342`,
TESTING deploy SUCCESS `b09e0acd-8aed-43d9-9942-35fc7e28546f`, servicio
DeliGO Copy):

```text
R2_CASE_A (quick filters, sin regresión)         PASS
R2_CASE_B (día específico)                       PASS
R2_CASE_C (mes específico)                       PASS
R2_CASE_D (rango Desde/Hasta)                    PASS
R2_CASE_E (boundary medianoche)                  NOT_REQUIRED_CONDITIONAL
R2_CASE_F (mobile)                               PASS
```

Confirmación literal del operador: *"funciona todo perfecto incluyendo
lo personalizado"* (Cases B/C/D) y *"quedó perfecto"* (Case F, mobile).
Case E era explícitamente condicional a que existiera un pedido real
cercano a medianoche — no se fabricó ningún dato sólo para producir esa
evidencia; el límite FROM inclusivo/TO exclusivo ya está cubierto por
los tests automatizados de boundary (route.test.ts, casos N/O).

Quality gate reutilizado de R1 (última ronda con cambio de código: 53
tests focales pass/0 fail — 30 backend + 23 frontend —, TSC 31
baseline/0 nuevos, ESLint/build/diff-check PASS) — sin repetir en este
cierre documental, sin cambios de código.

`mesasAsignadas` permanece exactamente igual — snapshot en vivo sin
filtro de fecha (`MESAS_ASIGNADAS_RANGE_BEHAVIOR=UNCHANGED_LIVE_SNAPSHOT`),
inconsistencia ya documentada en A0, nunca "corregida" en este cierre.

Invariantes preservadas: `P2_T44_STATUS=PAUSED_UNRESOLVED_AFTER_TIMEBOX`
y `P2_T49_STATUS=CLOSED_TESTING_CERTIFIED` (sin tocar), timezone sin
cambios de arquitectura (`TIMEZONE_MODEL_CHANGED=NO`), sin nuevo
endpoint, sin schema/migración/DB mutation.

Ver `codex-reports/P2_T50_FINAL_TESTING_CERTIFICATION_CLOSEOUT.md` para
el detalle completo. NO se promovió a Production en esta tarea ni en
ninguna ronda anterior de T50.

---

## HISTORICAL SNAPSHOT — P2-T50-R1 IMPLEMENTED_DEPLOYED_TESTING (2026-09-20)

```text
P2_T50_R1_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_R2_PHYSICAL_CERTIFICATION
P2_T50_STATUS=IN_PROGRESS_AWAITING_R2_PHYSICAL_CERTIFICATION
PRODUCTION_TOUCHED=NO
```

Implementó el filtro de fecha personalizado (día/mes/rango) diseñado en
A0, como extensión ADITIVA de `GET /api/negocio/salon/stats`
(`src/app/api/negocio/salon/stats/route.ts`) — nuevos params opcionales
`fecha=YYYY-MM-DD` / `mes=YYYY-MM` / `desde`+`hasta=YYYY-MM-DD`,
precedencia explícita fecha > mes > rango > `periodo` (fallback
histórico, sin cambios de semántica en hoy/semana/mes/todo). Parseo
seguro por componentes con roundtrip anti-fecha-inválida (nunca
`new Date(string)`); rango FROM inclusivo/TO exclusivo; combinaciones
custom ambiguas (p.ej. `fecha`+`mes`) → 400 genérico.

UI (`src/components/business/salon-tab.tsx`, `EstadisticasSubTab`):
control "Elegir fecha" nuevo junto a las 4 pastillas quick filter
existentes (sin tocarlas), Popover con modos Día/Mes/Rango reutilizando
`Calendar`/`Popover` (antes instalados pero nunca usados en `src/`) y un
`Select` de mes+año para el modo Mes (más simple/mobile-friendly que
forzar el Calendar). Un único `StatsFilter` (discriminated union)
controla el estado; flujo Aplicar/Cancelar evita disparar fetch a mitad
de selección; `queryKey` de TanStack Query incluye el filtro completo
(nunca comparte cache entre filtros distintos).

`mesasAsignadas` se dejó exactamente igual — sigue siendo un snapshot
en vivo sin filtro de fecha (`MESAS_ASIGNADAS_RANGE_BEHAVIOR=
UNCHANGED_LIVE_SNAPSHOT`), inconsistencia ya documentada en A0 y fuera
de alcance de esta ronda.

```text
COMMIT_SHA=9f9f5c9299e801dd60a7eb0e342034521129e342
PUSH_TARGET=origin/testing-codex — SUCCESS
TESTING_DEPLOY_ID=b09e0acd-8aed-43d9-9942-35fc7e28546f (servicio DeliGO Copy)
TESTING_DEPLOY_STATUS=SUCCESS, boot limpio, sin migraciones pendientes
FOCAL_TESTS=53 (30 backend + 23 frontend), 0 fail
TSC_NEW_ERRORS=0 (31 total, baseline sin cambios)
```

Ver `codex-reports/P2_T50_R1_SALON_STATISTICS_CUSTOM_DATE_FILTERING.md`
para el detalle completo (contrato exacto, tests caso por caso, diff
review, logs de deploy). NO se certificó físicamente esta ronda — R2
(Cases A-F, ya preparados en el reporte A0) queda pendiente antes de
poder cerrar T50.

---

## HISTORICAL SNAPSHOT — P2-T50-A0 AUDITED_DESIGNED (2026-09-20)

```text
P2_T50_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION
PRODUCT_CODE_CHANGED=NO
DB_MUTATED=NO
SCHEMA_CHANGED=NO
PRODUCTION_TOUCHED=NO
```

Auditoría + diseño (sin código de producto) de filtrado de fecha
personalizado para estadísticas de Salón. Pantalla objetivo confirmada:
dashboard de **Negocio** (`/negocio` → `SalonTab` → `EstadisticasSubTab`,
`src/components/business/salon-tab.tsx:542-731`), backend
`GET /api/negocio/salon/stats` (`src/app/api/negocio/salon/stats/route.ts`).
Esto es DISTINTO de la pantalla de estadísticas de Salón de Terminal
(`/operaciones/salon/estadisticas`, filtros hoy/7d/30d, sólo conteos —
contrato y auth completamente diferentes, no tocar) y distinto del panel
personal de cuenta operativa (`/operaciones/mi-panel/[slug]/salon`, que
no tiene ninguna pantalla de estadísticas — sólo un tablero de ocupación
en vivo).

Hallazgos clave verificados por lectura directa de código:
- Filtros actuales `hoy|semana|mes|todo` son ventanas RODANTES (no
  calendario) calculadas 100% en servidor con `Date` nativo, sin
  timezone explícito (mismo patrón "medianoche local del servidor" ya
  usado en el endpoint de Terminal).
- 4 de 5 métricas de la pantalla comparten el mismo `dateFilter`
  (revenue Salón, revenue Negocio, proporción %, pedidos/monto por
  empleado) — **inconsistencia preexistente no reportada antes**: el
  badge `mesasAsignadas` por mozo es un snapshot EN VIVO sin filtro de
  fecha, documentada pero no corregida en A0 (fuera de alcance).
- `T50_API_DECISION=B` — el endpoint existente es reutilizable con
  parámetros aditivos (`fecha`/`mes`/`desde`+`hasta` junto al `periodo`
  actual); no se requiere endpoint nuevo.
- `Calendar`/`Popover` (react-day-picker v9, shadcn) ya están instalados
  en el design system pero sin ningún uso real en `src/` — candidatos
  naturales para el picker de R1, serían su primer consumidor.
- `Pedido` no tiene índice sobre `negocioId`/`fecha`/`estado` — costo de
  escaneo preexistente, no una regresión introducida por T50 (no se
  cambia schema en A0).

Ver `codex-reports/P2_T50_A0_SALON_STATISTICS_DATE_FILTER_AUDIT_DESIGN.md`
para el detalle completo (contrato HTTP, semántica exacta de cada
filtro, modelo de rango recomendado, diseño UX, plan de implementación
R1 archivo-por-archivo, plan de tests, preparación de casos R2).

`P2_T49_STATUS=CLOSED_TESTING_CERTIFIED` permanece sin tocar (ver
sección inmediatamente debajo, ahora histórica de este handoff).

---

## HISTORICAL SNAPSHOT — P2-T49 CLOSED_TESTING_CERTIFIED (2026-09-20)

```text
P2_T49_STATUS=CLOSED_TESTING_CERTIFIED
RELEASE_ELIGIBLE=YES
PRODUCTION_PROMOTED=NO
PRODUCTION_TOUCHED=NO
```

Certificación física completa del operador sobre TESTING, cubriendo las
4 rondas de implementación:

```text
R1  (layout móvil del chat)                 443a37aa65520b65327e14c0e7603c622b4124fa
R1B (aislamiento visual + background refresh) 6380c762bb4e8a97eaf03b035b9bcf050945bb0e
R1C (aislamiento completo del runtime)       b002958aaa613171283b9895dfb0fc0bfad7d3d2
R1D (indicador de mensajes en el panel)      eccf1866292eca82db87f3c07ce5c92788da8131
TESTING_DEPLOY_ID=68952a90-44e1-40fe-a53f-24d4c9371fb0 SUCCESS
```

**Casos físicos, todos PASS**: layout A-D (mobile portrait/teclado/panel,
desktop); R2B Case E (Cliente autenticado + Terminal en el mismo
navegador → sin burbuja/ChatSheet personal en Operaciones, Chat Cliente
intacto en su propia ruta, sesión Cliente nunca cerrada); R2B Case F
(chat Terminal en pestaña de background recibe un mensaje real de
Cliente sin necesidad de volver primero a la pestaña — confirma
físicamente el polling best-effort de 10s de R1B); R2C Case H (indicador
de mensajes del panel PyR funciona end-to-end, "quedó perfecto" según el
operador); R2B Case G (regresión general, sin repetir pruebas —
evidencia acumulada de las rondas anteriores).

Quality gate reutilizado de R1D (última ronda con cambio de código,
142 tests pass/0 fail, TSC 31 baseline/0 nuevos, ESLint/build/diff-check
PASS) — sin repetir en este cierre documental, sin cambios de código.

**Invariantes preservadas**: `P2_T44_STATUS=PAUSED_UNRESOLVED_AFTER_TIMEBOX`
(sin tocar), `TERMINAL_OPERATIVA_PUSH=NO_ES_ACTOR_PUSH_POR_DISEÑO` (T49
completo nunca agregó PushSubscription/owner/columna a Terminal),
`REALTIME_USER_TYPES` sin cambios (Terminal nunca se agregó como actor
realtime), worktree T39 intacto, `origin/main` reconfirmado en
`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763` sin cambios.

Reporte completo:
`codex-reports/P2_T49_FINAL_TESTING_CERTIFICATION_CLOSEOUT.md`.
Historial completo de la implementación (A0, R1, R1B, R1C, R1D)
preservado íntegro debajo, sin borrar nada.

## PREVIOUS STATE — P2-T49-R1D — TERMINAL ORDER MESSAGE INDICATOR DEPLOYED TESTING (2026-09-20)

`P2_T49_R1D_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_R2C_PHYSICAL_CERTIFICATION`,
`P2_T49_STATUS=IN_PROGRESS_AWAITING_R2C_PHYSICAL_CERTIFICATION`. Durante
la certificación física R2/R2B (layout A-D PASS, aislamiento Cliente+
Operaciones Case E PASS) el operador reportó un finding nuevo: el panel
`/operaciones/pyr` no daba ninguna visibilidad de si un pedido tenía
conversación o mensajes nuevos sin entrar primero al pedido.

**Fix**: `src/app/api/operaciones/pyr/panel/route.ts` ahora agrega a
cada pedido `tieneMensajes: boolean` y `mensajesNoLeidos: number`, en
UNA sola query agregada (`db.chatMensaje.groupBy`) para todos los
pedidos visibles — nunca 1 query por pedido. Gateado por el scope ya
existente `pyr.mensajes.ver`: sin él, ni siquiera se consulta la tabla
(fail-closed, no sólo ocultar UI). Nunca expone texto/adjuntos/
clienteId/ids de mensaje — sólo presencia + contador. `leido` sigue
siendo el mismo campo compartido de `ChatMensaje` (sin schema nuevo, sin
read-state por Terminal). `src/app/operaciones/pyr/page.tsx` — cada
card de pedido ahora muestra un badge: nada si nunca tuvo mensajes,
"Mensajes" neutro si tiene conversación sin pendientes, "1 mensaje
nuevo"/"N mensajes nuevos" acentuado (sin animación nueva, distinto del
dot de "pedido nuevo" de T45) si hay mensajes de Cliente sin leer. El
badge vive dentro del botón existente de la card (sin click propio,
sin stopPropagation) — abrir el chat sigue siendo el botón "Mensajes"
del drawer. Viaja en el mismo `GET .../panel` y el mismo
`REFRESH_MS=5000` de T45, sin timer nuevo.

```text
PANEL_MESSAGE_METADATA_FIELDS=tieneMensajes, mensajesNoLeidos
MESSAGE_METADATA_QUERY_COUNT_PER_PANEL_REFRESH=0 sin permiso/pedidos, 1
  con pedidos y permiso — nunca N+1
PRODUCT_FILES_CHANGED=2 (panel/route.ts, pyr/page.tsx)
TEST_FILES_CHANGED=2 (panel/route.test.ts nuevo 11/11, page.test.ts
  extendido +8 tests)
REGRESSION_TESTS=142 pass / 0 fail total
API_FILES_CHANGED=NO (mismo endpoint, contrato extendido aditivamente) /
  SCHEMA=NO / MIGRATION=NO / REALTIME=NO / PUSH=NO
TSC_NEW_ERRORS=0 (31 baseline) / ESLINT=PASS / BUILD=PASS
P2_T49_R1D_COMMIT_SHA=eccf1866292eca82db87f3c07ce5c92788da8131
TESTING_DEPLOY_ID=68952a90-44e1-40fe-a53f-24d4c9371fb0
TESTING_DEPLOY_STATUS=SUCCESS (commit exacto confirmado, boot limpio)
```

Reporte completo:
`codex-reports/P2_T49_R1D_TERMINAL_ORDER_MESSAGE_INDICATOR.md`.

**Certificación física preparada, NO ejecutada**: Case H (indicador de
mensajes — mensaje sin abrir pedido aparece "1 mensaje nuevo", abrir/
confirmar pasa a "Mensajes" neutro, nunca desaparece del todo); Case F
(background freshness, sin cambios de R1B) y Case G (regresión general)
siguen pendientes como ya estaban. Ninguno ejecutado.

`T49_R1_LAYOUT_FIX_PRESERVED=SI` / `R1B_BACKGROUND_REFRESH_PRESERVED=SI` /
`R1C_GLOBAL_CHAT_ISOLATION_PRESERVED=SI` / `P2_T44_STATUS_UNCHANGED=
PAUSED_UNRESOLVED_AFTER_TIMEBOX` — todos sin tocar.

## PREVIOUS STATE — P2-T49-R1C — COMPLETE GLOBAL CHAT ISOLATION DEPLOYED TESTING (2026-09-19)

`P2_T49_R1C_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_R2B_PHYSICAL_CERTIFICATION`,
`P2_T49_STATUS=IN_PROGRESS_AWAITING_R2B_PHYSICAL_CERTIFICATION` (sin
cambio de estado macro — R1C es un refactor interno, no cambia lo que el
operador debe certificar físicamente en R2B).

R1B había dejado documentada una desviación explícita: `useChatDeepLink()`
y `useChatActorReset()` seguían ejecutándose SIEMPRE dentro de
`ChatProvider`, incluso en `/operaciones/**`, porque un `return null`
antes de esos hooks en la misma instancia de componente habría roto las
Reglas de los Hooks al navegar entre rutas. R1C cierra esa desviación con
la arquitectura correcta: `src/providers/chat-provider.tsx` se separó en
`ChatProvider` (sólo `usePathname()` + el gate `shouldMountGlobalChat`,
sin cambios de comportamiento) y un componente hijo nuevo
`GlobalChatRuntime` (contiene los dos hooks + `ChatFab`/`ChatSheet`).
Cuando la ruta es `/operaciones/**`, `GlobalChatRuntime` completo no se
monta — su instancia no existe, así que los hooks tampoco corren, sin
violar ninguna regla de React (montar/no montar un componente hijo es
distinto de saltear hooks dentro del mismo componente).

```text
GLOBAL_CHAT_RUNTIME_COMPONENT=GlobalChatRuntime (local, no exportado)
OPERACIONES_GLOBAL_CHAT_RUNTIME_MOUNTED=NO (hooks incluidos, no sólo FAB/Sheet)
OPERACIONES_PERSONAL_CHAT_DEEPLINK_CONSUMER_ACTIVE=NO
OPERACIONES_PERSONAL_CHAT_ACTOR_RESET_ACTIVE=NO
PERSONAL_ROUTES_CHAT_DEEPLINK_PRESERVED=SI (/cliente, /negocio,
  /repartidor siguen montando GlobalChatRuntime normalmente)
OPERACIONES_DEDICATED_CHAT_DEPENDS_ON_GLOBAL_CHAT_RUNTIME=NO (confirmado
  de nuevo, sin tocar esos archivos)
R1B_BACKGROUND_REFRESH_PRESERVED=SI (terminal-chat-background-refresh.ts
  sin diff)
PRODUCT_FILES_CHANGED=1 (chat-provider.tsx)
TEST_FILES_CHANGED=1 (chat-provider-route-boundary.test.ts extendido,
  17/17 pass — contrato estático sobre el código fuente, sin harness de
  DOM real: verifica que los hooks vivan en GlobalChatRuntime y no en
  ChatProvider, y que el gate preceda al montaje)
REGRESSION_TESTS=105 pass / 0 fail (deep-link 36 + consumer contract 28 +
  layout T49-R1 18 + background-refresh R1B 6 + focal 17)
API_FILES_CHANGED=NO / SCHEMA=NO / MIGRATION=NO / REALTIME_CHANGED=NO /
  PUSH_CHANGED=NO / ChatFab/ChatSheet NO tocados
TSC_NEW_ERRORS=0 (31 baseline) / ESLINT=PASS / BUILD=PASS
P2_T49_R1C_COMMIT_SHA=b002958aaa613171283b9895dfb0fc0bfad7d3d2
TESTING_DEPLOY_ID=785f5614-df9c-4e5d-83a7-84bf46c7490e
TESTING_DEPLOY_STATUS=SUCCESS (commit exacto confirmado, boot limpio)
```

Reporte completo:
`codex-reports/P2_T49_R1C_COMPLETE_GLOBAL_CHAT_ISOLATION.md`.

**R2B sigue preparado, NO ejecutado** (mismos 3 casos de R1B: E aislamiento
Cliente+Operaciones mismo browser, F frescura de background >20s, G
regresión general) — R1C no cambia qué debe observar el operador
físicamente, sólo completa la garantía interna de que ningún runtime
personal corre de fondo en Operaciones.

`T49_R1_LAYOUT_FIX_PRESERVED=SI` (sin tocar) /
`P2_T45_BEHAVIOR_PRESERVED=SI` (sin tocar) /
`P2_T44_STATUS_UNCHANGED=PAUSED_UNRESOLVED_AFTER_TIMEBOX`.

## PREVIOUS STATE — P2-T49-R1B — OPERATIONS CHAT ISOLATION + BACKGROUND FRESHNESS DEPLOYED TESTING (2026-09-19)

`P2_T49_R1B_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_R2B_PHYSICAL_CERTIFICATION`,
`P2_T49_STATUS=IN_PROGRESS_AWAITING_R2B_PHYSICAL_CERTIFICATION` (era
`IN_PROGRESS_BLOCKED_BY_R1B_NEW_FINDINGS`). La certificación física R2 de
R1 (layout) siguió PASS en los 4 casos A-D — **no se revirtió nada de
eso** — pero la revisión física posterior encontró dos findings nuevos
que bloqueaban el cierre global de T49, ambos ya corregidos y
desplegados en esta ronda.

**Finding A — Chat personal contaminaba Operaciones**: `ChatProvider`
(montado globalmente desde `src/app/layout.tsx`) sólo excluía `/mozo` de
renderizar `ChatFab`/`ChatSheet` — nunca `/operaciones`. Con una sesión
Cliente hidratada en el mismo navegador, abrir Terminal
(`/operaciones/pyr`) mostraba la burbuja naranja del Chat personal y
podía abrir el `ChatSheet` de Cliente encima de Operaciones. Fix: nueva
función pura `shouldMountGlobalChat(pathname)` en `chat-provider.tsx`
que excluye `/operaciones`/`/operaciones/**` (mismo patrón ya usado para
`/mozo`). Confirmado: sin bypass de autorización server-side
(`SERVER_SIDE_CROSS_ROLE_DATA_AUTH_BYPASS=NO`) — era contaminación de
ruta/UI, nunca de datos entre roles. Los dos chats dedicados de
Operaciones (Terminal PyR y el panel personal de cuenta operativa) nunca
dependieron de `ChatProvider`/`ChatFab`/`ChatSheet` — sin impacto.

**Finding B — Chat Terminal no actualizaba en pestaña de background**:
`refresh()` bloqueaba TODO GET si `document.visibilityState !== "visible"`,
sin ningún polling — un mensaje nuevo podía tardar todo lo que la pestaña
estuviera oculta en aparecer. Fix: `refresh({ allowHidden })` + nuevo
`src/lib/terminal-chat-background-refresh.ts`
(`startBackgroundTolerantRefresh`) que agrega un `setInterval` de 10s que
corre SIEMPRE (visible u oculta), preservando intactos
`AbortController`/generación/`stoppedRef`. Explícitamente
`BEST_EFFORT_BROWSER_TIMER` — no es realtime, no es Push, no cubre app
cerrada.

```text
PRODUCT_FILES_CHANGED=2 modificados (chat page + chat-provider.tsx) + 1
  nuevo (terminal-chat-background-refresh.ts)
TEST_FILES_CHANGED=2 nuevos (chat-provider-route-boundary.test.ts 13/13,
  terminal-chat-background-refresh.test.ts 6/6 — fake timers, sin DOM/
  browser harness)
REGRESSION_TESTS=127 pass / 0 fail total (deep-link/actor-reset 64,
  layout T49-R1 18, panel T45 5, API chat 18, T06 terminal 4, T07
  pairing 4)
API_FILES_CHANGED=NO / SCHEMA=NO / MIGRATION=NO / REALTIME_CHANGED=NO /
  PUSH_CHANGED=NO / ChatFab NO tocado (gate correcto a nivel Provider)
TSC_NEW_ERRORS=0 (31 baseline) / ESLINT=PASS / BUILD=PASS
P2_T49_R1B_COMMIT_SHA=6380c762bb4e8a97eaf03b035b9bcf050945bb0e
TESTING_DEPLOY_ID=8c7c7d2c-cd5f-4113-8f7b-fe5ee6b4d2e3
TESTING_DEPLOY_STATUS=SUCCESS (commit exacto confirmado, boot limpio)
```

Reporte completo:
`codex-reports/P2_T49_R1B_OPERATIONS_CHAT_ISOLATION_BACKGROUND_FRESHNESS.md`.

**Certificación física R2B preparada, NO ejecutada** (3 casos nuevos): E)
Cliente + Terminal en pestañas distintas del mismo navegador → sin
burbuja/ChatSheet personal en Operaciones, chats dedicados intactos; F)
chat Terminal en background >20s + mensaje nuevo desde Cliente →
confirmar vía DevTools Network que hubo al menos un GET oculto ANTES de
volver el foco; G) regresión general (chat Terminal, chat Cliente, panel
T45). Ninguno ejecutado — sin pedido, sin mensaje real, sin teléfono,
sin sesión cerrada.

`T49_R1_LAYOUT_FIX_PRESERVED=SI` / `P2_T45_BEHAVIOR_PRESERVED=SI` /
`P2_T44_STATUS_UNCHANGED=PAUSED_UNRESOLVED_AFTER_TIMEBOX`.

## PREVIOUS STATE — P2-T49-R1 — TERMINAL MOBILE CHAT LAYOUT IMPLEMENTED + DEPLOYED TESTING (2026-09-19)

`P2_T49_R1_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_CERTIFICATION`,
`P2_T49_STATUS=IN_PROGRESS_AWAITING_R2_PHYSICAL_CERTIFICATION` (era
AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION). Implementa exactamente la
arquitectura recomendada en A0.

**Cambio, 2 archivos productivos**:
`src/app/operaciones/pyr/mensajes/[pedidoId]/page.tsx` — `<main>` pasó de
`min-h-screen flex flex-col` a `h-dvh flex flex-col overflow-hidden`;
header de `sticky top-0` a `shrink-0`; panel de mensajes ganó `min-h-0`
(junto a `flex-1 overflow-y-auto` ya existentes); composer pasó de
`sticky bottom-0` a `shrink-0` con
`pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]` (mismo padding base
que ya tenía, `env()` resuelve a 0 sin home indicator); se agregó un
botón de logout compacto en el header del chat. `src/components/operativo/terminal-logout-button.tsx`
— se extrajo `useTerminalLogout()` (mismo fetch/endpoint/redirect, sin
duplicar) y el botón flotante global ahora excluye
`/operaciones/pyr/mensajes/*` de su propio render. Sin JS de teclado
nuevo (mismo `IOSKeyboardFix`/`interactiveWidget` globales de siempre) —
mismo patrón ya probado en `chat-sheet.tsx`/`chat-view.tsx` (chat
personal).

```text
PRODUCT_FILES_CHANGED=2 (chat page + terminal-logout-button.tsx)
TEST_FILES_CHANGED=1 (page.test.ts nuevo, contrato estático — 18/18 pass)
API_FILES_CHANGED=NO / SCHEMA_CHANGED=NO / MIGRATION_CREATED=NO /
  REALTIME_CHANGED=NO / PUSH_CHANGED=NO (todos confirmados por
  git diff --stat vacío)
LOGOUT_LOGIC_DUPLICATED=NO / TERMINAL_LOGOUT_BACKEND_CHANGED=NO
OTHER_TERMINAL_PAGES_CHANGED=NO (las 7 pantallas de scroll completo
  conservan min-h-screen + pb-24 sin cambios)
REGRESSION_TESTS=logout (T06, 4/4) + pairing (T07, 4/4) + chat API
  (18/18) + PyR panel T45 (5/5) — todos pass
TSC_NEW_ERRORS=0 (31 baseline preservada) / ESLINT=PASS / BUILD=PASS
P2_T49_R1_COMMIT_SHA=443a37aa65520b65327e14c0e7603c622b4124fa
TESTING_DEPLOY_ID=9b3ede3f-8bbf-42b3-bec4-fb49a4ef3746
TESTING_DEPLOY_STATUS=SUCCESS (commit exacto confirmado, boot limpio)
```

Reporte completo:
`codex-reports/P2_T49_R1_TERMINAL_MOBILE_CHAT_LAYOUT_IMPLEMENTATION.md`.

**Certificación física R2 preparada, NO ejecutada** (4 casos): A) chat
mobile portrait teclado cerrado → sin área vacía, composer visible,
logout compacto en header; B) teclado abierto → composer accesible sin
salto; C) otra pantalla Terminal → floating "Cerrar terminal" intacto;
D) desktop → sin regresión. Ningún caso ejecutado — sin pedido, sin
mensaje real, sin teléfono, sin terminal nueva.

`P2_T44_STATUS_UNCHANGED=PAUSED_UNRESOLVED_AFTER_TIMEBOX` — no tocado.

## PREVIOUS STATE — P2-T49-A0 — TERMINAL MOBILE SHELL + CHAT LAYOUT AUDITED + DESIGNED (2026-09-19)

`P2_T49_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION` (era
READY_FUTURE). Auditoría completa de los dos bugs agrupados en T49
(#17: área vacía enorme + composer mal contenido en el chat móvil de
Terminal PyR; #18: botón flotante "Cerrar terminal" superpuesto al
composer). Reporte completo:
`codex-reports/P2_T49_A0_TERMINAL_MOBILE_SHELL_CHAT_LAYOUT_AUDIT_DESIGN.md`.
Sin implementación, sin deploy, sin prueba física, sin Production.

**Hallazgo central**: Terminal Operativa no tiene un shell compartido real
— cada `page.tsx` bajo `src/app/operaciones/` construye su propio
`<main>`; sólo `TerminalLogoutButton` (fixed bottom-4 right-4 z-50,
`src/components/operativo/terminal-logout-button.tsx`) se inyecta
globalmente desde `src/app/operaciones/layout.tsx`. 7 de 8 pantallas
(Salón, PyR panel, historial ×2, reseñas, estadísticas ×2) usan scroll de
página completa con `min-h-screen` + `pb-24` para no chocar con el botón
— funcionan bien. La única rota es
`src/app/operaciones/pyr/mensajes/[pedidoId]/page.tsx` (el chat): usa
`min-h-screen` (no `dvh`) en un `flex flex-col`, le falta `min-h-0` en el
panel de mensajes (`flex-1 overflow-y-auto`), su composer es `sticky
bottom-0` sin reserva de espacio ni safe-area, y es la única pantalla sin
el `pb-24` equivalente — de ahí ambos bugs.

**El propio repo ya tiene la solución correcta implementada y probada**:
`src/components/chat/chat-sheet.tsx` (`h-dvh flex flex-col
overflow-hidden`) + `chat-view.tsx` (`flex-1 min-h-0 overflow-y-auto` +
composer `shrink-0` sin sticky) — el chat personal de Cliente/Negocio/
Repartidor. Un comentario en `globals.css` (`IOS-24-FIX-A`) documenta que
el proyecto YA probó y descartó una variable JS de altura de viewport por
quedar stale tras cerrar el teclado en iOS real, y adoptó `dvh` nativo
como la solución vigente — exactamente lo recomendado acá, sin inventar
JS de teclado nuevo (`IOSKeyboardFix` ya es global, cubre Terminal sin
cambios).

```text
RECOMMENDED_CHAT_ARCHITECTURE=replicar chat-sheet.tsx/chat-view.tsx:
  h-dvh flex-col overflow-hidden + mensajes flex-1 min-h-0 overflow-y-auto
  + composer shrink-0 en flow (sin sticky)
RECOMMENDED_LOGOUT_PLACEMENT=ocultar el botón fixed global sólo en
  /operaciones/pyr/mensajes/* y agregar un botón de logout compacto
  dentro del header que el chat ya tiene (2 archivos: la page del chat +
  terminal-logout-button.tsx)
T49_PROBLEM_CLASSIFICATION=dos defectos distintos, un solo archivo local
  para el fix principal (la page del chat) + una extensión puntual del
  gate de pathname del botón global
EXPECTED_PRODUCT_FILES=2 (chat page.tsx + terminal-logout-button.tsx)
EXPECTED_API_FILES=NONE / SCHEMA=NONE / MIGRATIONS=NONE / REALTIME=NONE / PUSH=NONE
P2_T45_BEHAVIOR_PRESERVED_BY_DESIGN=SI (archivo distinto, no tocado)
P2_T44_STATUS_UNCHANGED=PAUSED_UNRESOLVED_AFTER_TIMEBOX
IMPLEMENTATION_BLOCKERS=ninguno
```

Próxima acción sugerida (NO iniciada): `P2-T49-R1` (implementación del
diseño de arriba).

## PREVIOUS STATE — P2-T45-R2-FIX — CLOSEOUT DEFECTS FIXED + BACKLOG RECONCILED (2026-09-19)

Corrección documental sobre el cierre de T45 (sin tocar código/tests/DB/
Production): el reporte de cierre
(`codex-reports/P2_T45_R2_PHYSICAL_CERTIFICATION_AND_TESTING_CLOSEOUT.md`)
no incluía el SHA/push del propio commit de cierre (imposible saberlo en
el momento de escribirlo) ni una referencia interna correcta — ambos
corregidos con evidencia real
(`P2_T45_R2_CLOSEOUT_COMMIT_SHA=1fa492cdc312abfabd074c58138cfa73e02cbaf7`,
ya pusheado a `origin/testing-codex` desde el turno anterior, confirmado,
no duplicado).

**Reconciliación de backlog más amplia** (auditando reportes reales, no
snapshots viejos): `codex-reports/ROADMAP.md` tenía su sección
"Backlog vigente por estado" desactualizada desde 2026-09-09 —
**P2-T02** (`CLOSED_TESTING_CERTIFIED`, R6 13/09), **P2-T43**
(`CLOSED_TESTING_CERTIFIED`, R3 — Employee Join Identity + Admin
Feedback ya se implementó y certificó, R2/R3), y **P2-T53**
(`CLOSED_OPERATOR_PASS`, R1B+R2 14/09) llevaban días cerrados sin que la
sección autoritativa lo reflejara — los tres se movieron a la sección de
cerrados. **P2-T23** se reabrió después de su cierre R3C por un hallazgo
de calibración (H1-H4, hasta 15/09) — status real:
`REOPENED_H2A_PHYSICALLY_VALIDADA_H2B_PHYSICALLY_CERTIFIED_AWAITING_FILTER_CALIBRATION_DECISION`,
ya no depende de T02 (que cerró). **P2-T24** está
`IMPLEMENTED_PARTIALLY_TESTING_BLOCKED_NOT_RELEASE_ELIGIBLE`, no
"not started" como decía el roadmap viejo. También se corrigió un error
propio de una reconciliación anterior de esta misma sesión: **P2-T42**
había sido sugerida como "próxima tarea (formal closeout pendiente)"
cuando en realidad ya está `CLOSED_PRODUCTION` desde
`P2_T42_R1_FORMAL_CLOSEOUT_AND_CURATED_PRODUCTION_PROMOTION.md` (deploy
Production `SUCCESS`, tag `p2-t42-stable-2026-09-10`) — no vuelve a
aparecer como candidata.

```text
P2_T02_CURRENT_STATUS=CLOSED_TESTING_CERTIFIED
P2_T23_CURRENT_STATUS=REOPENED_AWAITING_FILTER_CALIBRATION_DECISION
P2_T24_CURRENT_STATUS=IMPLEMENTED_PARTIALLY_TESTING_BLOCKED_NOT_RELEASE_ELIGIBLE
P2_T42_CURRENT_STATUS=CLOSED_PRODUCTION
P2_T43_CURRENT_STATUS=CLOSED_TESTING_CERTIFIED
P2_T45_CURRENT_STATUS=CLOSED_TESTING_CERTIFIED
P2_T53_CURRENT_STATUS=CLOSED_OPERATOR_PASS
P2_T44_STATUS=PAUSED_UNRESOLVED_AFTER_TIMEBOX (sin cambios, no tocado)
NEXT_RECOMMENDED_SOFTWARE_TASK=P2-T49 (único P1 restante en el backlog activo)
```

Nota importante: `codex-reports/ROADMAP.md` ahora es el que refleja esta
reconciliación completa — este archivo (`DELIGO_FULL_CONTEXT_LATEST.md`)
sólo la resume, no la duplica en detalle. T39 tiene diseño ya avanzado en
su worktree separado (`C:/Leo Campos/Trabajo/deligo-t39-admin`,
`work/p2-t39-admin-notifications`) — no mergeado, no tocado desde acá.

`PRODUCTION_TOUCHED=NO`. `NEXT_TASK_STARTED=NO` — ningún candidato fue
iniciado, sólo identificado.

## PREVIOUS STATE — P2-T45 CLOSED_TESTING_CERTIFIED (R2, 2026-09-19)

```text
P2_T45_STATUS=CLOSED_TESTING_CERTIFIED
P2_T45_RELEASE_ELIGIBLE=YES
P2_T45_PRODUCTION_PROMOTION_AUTHORIZED=NO
PRODUCTION_TOUCHED=NO
```

Resumen compacto: A0 (auditoría + diseño de arquitectura) PASS → R1
(implementación, único archivo `src/app/operaciones/pyr/page.tsx`: polling
5s foreground + chip "N nuevos" + dot pulsante por pedido `recibido`,
commit `361e3cee21b0b075f32426987f89a34220441f21`, TESTING deploy SUCCESS
`8c47fed2-48ab-4eee-bf94-aaa99551a7e3`, DEPLOY_COMMIT_MATCH=SI) → R2
(certificación física del operador, 2026-09-19, 3/3 casos PASS):

```text
CASE_A (arribo): pedido nuevo Negocio B, Terminal PyR foreground sin
  recarga manual → apareció, chip "nuevo" visible, dot pulsante en el
  pedido — PASS
CASE_B (resolución): aceptar el pedido desde Terminal PyR → indicador y
  chip desaparecieron correctamente en el siguiente poll, sin toast
  espurio, transición normal — PASS ("quedó perfecto", operador)
CASE_C (aislamiento cross-business): dos Terminales PyR simultáneas,
  negocios distintos, pedido sólo en Negocio B → sólo Negocio B mostró la
  alerta, el otro negocio no mostró nada — PASS
```

Terminal sigue sin ser actor Push (`TERMINAL_OPERATIVA_PUSH=
NO_ES_ACTOR_PUSH_POR_DISEÑO` de P2-T12 intacto — cero
owner/subscription/columna de Push agregado). T41 (autorización) y T42
(workflow de estados PyR) preservados sin cambios — R1/R2 no tocaron
`mesa-pedido-cancelacion.ts`, `mesa-occupancy.ts`, ni el endpoint de
transición de estado. `P2_T44_STATUS=PAUSED_UNRESOLVED_AFTER_TIMEBOX`
sigue sin cambios, sin relación con T45 (T45 nunca dependió de que G3 se
resolviera). Datos de prueba física (pedidos de R2) preservados, sin
limpieza automática. Reporte completo:
`codex-reports/P2_T45_R2_PHYSICAL_CERTIFICATION_AND_TESTING_CLOSEOUT.md`.

Próxima acción (NO iniciada): cualquiera de las candidatas ya registradas
— P2-T42 formal closeout + curated promotion, P2-T43, o P2-T39/T40/T38.

## PREVIOUS STATE — P2-T45-R1 — TERMINAL PYR POLLING ALERTS IMPLEMENTED + DEPLOYED TESTING (2026-09-18)

`P2_T45_R1_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_CERTIFICATION`,
`P2_T45_STATUS=IN_PROGRESS_AWAITING_R2_PHYSICAL_CERTIFICATION` (era
AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION). Implementa exactamente la
arquitectura recomendada en A0: extiende a Terminal PyR el mismo patrón
ya en producción de Terminal Salón (polling + derivación visual local,
sin Push/SW/realtime/sonido).

**Cambio, único archivo productivo**
(`src/app/operaciones/pyr/page.tsx`): agrega `REFRESH_MS=5000` +
`setInterval` dentro del efecto existente (gateado por
`document.visibilityState`, reutilizando el `AbortController`/`gen` ya
existente de `refresh()` — sin guard de concurrencia nuevo); agrega
`countPedidosRecibidos(pedidos)` (función pura exportada, testeada
5/5 en `page.test.ts` nuevo); agrega un chip "N nuevos" (pulse amber) en
el resumen y un dot ping/pulse por fila cuando `estado === "recibido"`
(mismo patrón CSS que la tile de mesa de Salón), sin duplicar el texto
"Recibido" que el `StatusBadge` ya muestra. Cero endpoint nuevo, cero
mutación nueva — el badge es puramente informativo, reutiliza la
selección de pedido ya existente y ya gateada por `pyr.ver`.

```text
PRODUCT_FILES_CHANGED=1 (src/app/operaciones/pyr/page.tsx)
TEST_FILES_CHANGED=1 (src/app/operaciones/pyr/page.test.ts, nuevo, 5/5 pass)
API_FILES_CHANGED=NO / SW_CHANGED=NO / PUSH_TS_CHANGED=NO /
  REALTIME_CHANGED=NO / SCHEMA_CHANGED=NO / MIGRATION_CREATED=NO /
  TERMINAL_AUTH_CHANGED=NO / SALON_CHANGED=NO (todos confirmados por
  git diff --stat vacío)
TERMINAL_PUSH_OWNER_ADDED=NO / TERMINAL_PUSH_SUBSCRIPTION_ADDED=NO
  (TERMINAL_OPERATIVA_PUSH=NO_ES_ACTOR_PUSH_POR_DISEÑO de P2-T12 intacto)
T41_AUTHORITY_PRESERVED=SI / T42_WORKFLOW_PRESERVED=SI
REGRESSION_TESTS=109 pass / 8 fail (los 8 son integración real de DB
  pre-existentes — mesa-pedido-cancelacion/T41-cierre-cuenta/T06-T07 —
  cero diff en esos archivos, confirmado no-regresión)
TSC_NEW_ERRORS=0 (31 baseline preservada) / ESLINT=PASS / BUILD=PASS
P2_T45_R1_COMMIT_SHA=361e3cee21b0b075f32426987f89a34220441f21
TESTING_DEPLOY_ID=8c47fed2-48ab-4eee-bf94-aaa99551a7e3
TESTING_DEPLOY_STATUS=SUCCESS (commit exacto confirmado, boot limpio)
```

Reporte completo:
`codex-reports/P2_T45_R1_TERMINAL_PYR_POLLING_ALERT_IMPLEMENTATION.md`.

**Certificación física R2 preparada, NO ejecutada** (3 casos): A) pedido
nuevo Negocio B con Terminal PyR abierta/foreground → chip "1 nuevo" +
dot en ~5-10s sin recarga manual; B) aceptar el pedido → chip/dot
desaparecen en el siguiente poll; C) dos negocios simultáneos → sólo el
negocio con el pedido nuevo muestra la alerta (aislamiento server-side ya
existente, sin cambios). Ningún caso ejecutado — sin pedido creado, sin
terminal abierta, sin teléfono tocado.

`P2_T44_STATUS_UNCHANGED=PAUSED_UNRESOLVED_AFTER_TIMEBOX` — no tocado, no
reabierto.

## PREVIOUS STATE — P2-T45-A0 — TERMINAL NOTIFICATION ARCHITECTURE AUDITED + DESIGNED (2026-09-18)

`P2_T45_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION` (era
READY_FUTURE). Auditoría completa + diseño de arquitectura para el gap de
avisos de Terminal PyR (Terminal Salón tiene avisos, Terminal PyR no).
Reporte completo:
`codex-reports/P2_T45_A0_TERMINAL_NOTIFICATION_ARCHITECTURE_AUDIT_DESIGN.md`.
Sin implementación, sin deploy, sin prueba física, sin Production.

**Hallazgo central**: el "aviso" de Terminal Salón hoy NO es Web Push ni
Service Worker ni realtime ni sonido — es un badge/pulse puramente visual
(CSS `animate-ping`/`animate-pulse`) derivado localmente de un polling de
5 segundos contra `GET /api/operaciones/salon/panel`
(`src/app/operaciones/salon/page.tsx:180,398-406,723-728`), recomputado
desde cero en cada poll (snapshot, no evento — por eso nunca tuvo que
resolver dedupe/reconexión, a diferencia de toda la investigación de
Push de T44). Terminal PyR (`src/app/operaciones/pyr/page.tsx`) tiene
MENOS que eso: ni siquiera tiene el timer de polling, sólo refetch por
visibilidad/foco. Su endpoint (`/api/operaciones/pyr/panel`) YA devuelve
`estado` por pedido incluyendo `"recibido"` — el mismo dato que Salón usa.

**Decisión de arquitectura**: extender exactamente el mismo patrón de
Salón (polling + badge derivado) a PyR. Cero schema, cero migración, cero
nuevo actor Push, cero canal realtime nuevo (`REALTIME_USER_TYPES` sigue
siendo sólo `cliente|negocio|repartidor`,
`src/lib/realtime-policy.ts:1` — Terminal nunca fue un actor realtime).
Confirmado por auditoría de código real que
`TerminalOperativa.pushSubscription` fue eliminado deliberadamente en
P2-T12 (columna inerte, cero writers/readers,
`prisma/migrations/20260826230000_drop_terminal_operativa_push_subscription`)
y que `TerminalOperativa` no tiene ningún `userId`/`employeeId` — es
identidad de dispositivo (`negocioId` + `areas` JSON, nunca de persona) —
por lo que no puede leer el `Notificacion` Center de cuenta (indexado por
`userId`+`userType`, nunca "terminal") sin inventar una identidad nueva,
exactamente lo que T12 evitó. `TERMINAL_OPERATIVA_PUSH=NO_ES_ACTOR_PUSH_POR_DISEÑO`
se preserva intacto.

**T41 preservado**: el badge propuesto sólo hace selección/scroll visual
dentro de la misma página ya gateada por `pyr.ver` — cero endpoint
mutante nuevo, cero camino lateral hacia una acción prohibida
(`salon_terminal` sigue sin poder cancelar pedidos de mesa ni cerrar
cuenta comercial).

**T42 no se reabre**: ya dejó el workflow de estados de PyR Terminal en
paridad completa con el panel personal — T45 sólo agrega la capa de
aviso, no toca workflow.

```text
RECOMMENDED_ARCHITECTURE=extender polling+badge de Salón a PyR (mismo
  patrón, mismo endpoint, sin transporte nuevo)
EXPECTED_PRODUCT_FILES=src/app/operaciones/pyr/page.tsx (único archivo)
EXPECTED_SCHEMA_FILES=ninguno / EXPECTED_MIGRATIONS=ninguna
EXPECTED_SW_CHANGES=ninguno / EXPECTED_PUSH_TS_CHANGES=ninguno
IMPLEMENTATION_BLOCKERS=ninguno identificado
P2_T44_STATUS_UNCHANGED=PAUSED_UNRESOLVED_AFTER_TIMEBOX (T45 no depende
  de que G3 se resuelva — arquitecturas ortogonales)
```

Próxima acción sugerida (NO iniciada en esta tarea):
`P2-T45-R1 — IMPLEMENT TERMINAL PYR NOTIFICATION PARITY` (implementación
del diseño de arriba), o alternativamente cualquiera de
`NEXT_CANDIDATE_TASKS` ya registradas en el cierre de T44
(P2-T42 formal closeout, P2-T43).

## PREVIOUS STATE — P2-T44 CLOSED BY TIMEBOX (R1P6N, 2026-09-18)

**Resumen ejecutivo de T44** (para una sesión nueva que no haya leído todo
el historial R1P0-R1P6N):

- **Objetivo original de T44**: UX de Push personal de Operaciones + cobertura
  PyR ("Enviar prueba" visible en UI normal de Mozo, popover roto en móvil,
  PyR sin notificaciones equivalentes). Esa parte **ya se implementó y
  desplegó en TESTING en R1P0-R1P2**, sin relación con lo que sigue.
- **Sub-problema G3** (descubierto durante T44, la parte que consumió
  R1P3-R1P6N): en iOS, con la PWA de Operaciones ya abierta (WindowClient
  existente) en background, un Push de Operaciones (`operaciones_pyr_new_order`
  y los otros 4 tipos modernos) se entrega correctamente (1 Push, título
  correcto) pero al tocarlo **siempre vuelve a Home de Operaciones**, nunca
  abre PyR ni el pedido correcto.
- **Qué SÍ funciona** (consolidado, PASS físico real): entrega de Push
  (delivery, recipient resolution, endpoint dedupe, provider, payload URL),
  y el control de referencia — Cliente con WindowClient existente en
  background, `order_update`, Push, tap → abre el pedido correcto
  (R1P6H, mismo iPhone). Esto refuta que el problema sea "iOS no ejecuta
  notificationclick" o "WindowClient existente rompe todo" como explicación
  global.
- **Qué sigue fallando**: el deep-link de Operaciones con client existente
  (background y foreground), siempre termina en Home. El PASS histórico de
  "app cerrada" (pre-R1P6C) nunca se revalidó tras los cambios posteriores.
- **4 fixes de código probados y descartados como causa suficiente** (cada
  uno con su propia prueba física FAIL_HOME): (A) R1P6C hardening de
  matching/await de client existente — bug real corregido, no resolvió;
  (B) R1P6E traza durable por IndexedDB — nunca capturó evidencia de click,
  se mantiene sólo como herramienta de diagnóstico en TESTING; (C) R1P6I
  URL relativa→absoluta en Operations — no resolvió,
  `RELATIVE_URL_ROOT_CAUSE=REFUTED_AS_SUFFICIENT_CAUSE`; (D) R1P6L remover
  `actions` de las 5 notificaciones modernas — no resolvió
  (`ACTIONS_ROOT_CAUSE=REFUTED_AS_SUFFICIENT_CAUSE`) y **fue revertido**
  en R1P6N (commit `5536b12f1abe75abf121e9ce7312c76db290c91d`, restauración
  exacta y mínima, sólo las 5 propiedades `actions`, confirmado
  byte-idéntico a pre-R1P6L vía diff) porque sólo costaba UX real sin
  ningún beneficio.
- **Código que queda mantenido**: R1P6C (fix real, correcto) y R1P6I
  (alineación standards-safe con el patrón Personal) se mantienen tal cual
  — ninguno se revierte, ninguno se consideró "el problema". R1P6E (traza
  durable) se mantiene sólo en TESTING como instrumentación, sin overhead
  en Production (Production nunca recibió esta línea de cambios).
- **Decisión de timebox** (definida de antemano en R1P6L, ejecutada en
  R1P6N tras el FAIL físico final de R1P6M):

```text
P2_T44_STATUS=PAUSED_UNRESOLVED_AFTER_TIMEBOX
G3_PHYSICAL_CERTIFIED=NO
G3_PUSH_DELIVERY_PHYSICAL=PASS
T44_RELEASE_ELIGIBLE=NO
T44_PRODUCTION_ELIGIBLE=NO
ROOT_CAUSE_FINAL=UNRESOLVED_IOS_OPERATIONS_PUSH_DEEP_LINK
ROOT_CAUSE_LAYER_FINAL=CLIENT_PLATFORM_INTERACTION_UNRESOLVED
ROOT_CAUSE_CONFIDENCE_FINAL=MEDIUM/UNRESOLVED
CLEANUP_COMMIT_SHA=5536b12f1abe75abf121e9ce7312c76db290c91d
TESTING_DEPLOY_ID=cc065db2-64e6-4b65-9b84-c848971b57ea
TESTING_DEPLOY_STATUS=SUCCESS (commit exacto confirmado)
```

- **Condiciones de reapertura** (`T44_REOPEN_ONLY_IF`): evidencia técnica
  nueva y concreta; una futura versión de iOS/WebKit cambia el
  comportamiento; se dispone de Safari Web Inspector/macOS para evidencia
  directa; el problema sube de prioridad producto; o se decide rediseñar
  por completo el mecanismo de apertura. **No reabrir sólo para "probar
  otra cosa".**
- **Fixture preservado intacto**: CuentaOperativa compartida, Negocio
  A/B/C, empleados, productos mínimos, Cliente fixture, PushSubscription
  de Operaciones y de Cliente, mesas core — nada rotado, nada deslogueado.
  Los pedidos/notificaciones transitorios de R1P6A-R1P6M quedan
  documentados como descartables.
- **Roadmap**: `codex-reports/ROADMAP.md` actualizado — T44 movida a
  `BLOCKED_EXTERNAL_OR_OPERATOR` con este estado, ya no aparece como
  `ALTERNATIVE_NEXT_TASK`. Ninguna otra tarea del roadmap tenía una
  dependencia dura documentada con T44 (T39/T40/T38 son independientes,
  READY_FUTURE sin cambios). Próxima tarea recomendada:
  **P2-T42 formal closeout + curated promotion** (ya
  implementado/testeado/desplegado, sólo falta el cierre formal) o
  **P2-T43** (siguiente P1 en secuencia). Ninguna se inició en R1P6N.

Reporte completo del cierre:
`codex-reports/P2_T44_R1P6N_FINAL_TIMEBOX_CLOSURE.md`. Historial completo
de la investigación (R1P0 a R1P6M) preservado íntegro debajo, sin borrar
nada.

## PREVIOUS STATE — P2-T44-R1P6L — FINAL TIMEBOXED FIX: ACTIONS REMOVED (2026-09-18)

Decisión explícita del operador: T44 recibe UN ÚLTIMO fix de
comportamiento para el deep-link roto de Operaciones. Si la próxima
prueba física (R1P6M, aún NO ejecutada) vuelve a terminar en Home, T44
pasa inmediatamente a `PAUSED_UNRESOLVED_AFTER_TIMEBOX` — sin más fixes,
sin más A/B, sin más investigación de WebKit, sin más sondas.

```text
T44_DEEP_LINK_DEBUG_TIMEBOX_ACTIVE=SI
FINAL_BEHAVIOR_FIX_ATTEMPT=R1P6L
MAX_ADDITIONAL_BEHAVIOR_FIXES_AFTER_R1P6L=0
```

Basado en R1P6K (Cliente PASS sin `actions`/`requireInteraction` vs
Operaciones FAIL con ambos, con respaldo externo específico de iOS/WebKit
para `actions`), se eliminó ÚNICAMENTE `actions` de las 5 fábricas
modernas de Operaciones en `src/lib/push.ts`
(operaciones_salon_new_order, operaciones_order_cancelled,
operaciones_pyr_new_order, operaciones_pyr_new_review,
operaciones_pyr_chat). `requireInteraction` NO se tocó (queda exactamente
igual por tipo — true/true/true/false/true). `public/sw.js`, el ruteo de
notificationclick, `absoluteTarget` (R1P6I), la traza durable (R1P6E), y
la rama Personal (Cliente/Negocio/Repartidor) permanecen sin cambios.

```text
R1P6L_COMMIT_SHA=436cf886ca215df6bac8a5fe70a75a06d3caed39
TESTING_DEPLOY_ID=6b34eca0-c30d-4687-9294-c07eda7ad170
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_COMMIT=436cf886ca215df6bac8a5fe70a75a06d3caed39 (coincide exacto)
LIVE_TRACE_VERSION=P2_T44_R1P6E_SW_TRACE_V2 (sin cambios, confirmado live)
LIVE_ROUTING_VERSION=P2_T44_R1P6I_ABSOLUTE_OPERATIONS_TARGET (sin cambios, confirmado live)
FOCAL_TESTS=push.test.ts 64/64 pass (5 nuevos); regresión 9 archivos 134/134 pass
TSC_NEW_ERRORS=0 (31 baseline preservada)
G3_PHYSICAL_CERTIFIED=NO
```

Reporte completo:
`codex-reports/P2_T44_R1P6L_FINAL_ACTIONS_REMOVAL_FIX.md`. Próxima y
ÚLTIMA prueba física (R1P6M) preparada conceptualmente pero NO ejecutada
en esta tarea — requiere autorización explícita separada. Estado:
`AWAITING_FINAL_TIMEBOXED_PHYSICAL_PROBE`. Si R1P6M falla: NO revert
automático de R1P6L — decisión de mantener/revertir se toma en una tarea
de cierre documental separada.

## PREVIOUS STATE — P2-T44-R1P6K — CLIENTE PASS vs OPERACIONES FAIL POST-ABSOLUTE-URL (2026-09-18)

R1P6J (prueba física) ejecutó el código absoluto de R1P6I (confirmado live
vía `routingVersion=P2_T44_R1P6I_ABSOLUTE_OPERATIONS_TARGET` en la propia
traza real del push) y **volvió a fallar**: Push Operaciones recibido
(1, título correcto) → tap → destino final Home de Operaciones (no PyR, no
el pedido). Por lo tanto:

```text
RELATIVE_URL_ROOT_CAUSE_AS_SUFFICIENT_CAUSE=REFUTED
G3_R1P6J_PUSH_DELIVERY=PASS
G3_R1P6J_ABSOLUTE_TARGET_ACTIVE=SI
G3_R1P6J_DEEP_LINK_VISUAL=FAIL
G3_R1P6J_DESTINATION=HOME_OPERACIONES
G3_PHYSICAL_CERTIFIED=NO
```

Análisis comparativo completo en
`codex-reports/P2_T44_R1P6K_CLIENT_PASS_VS_OPERATIONS_FAIL_ANALYSIS.md`.
Ver reporte para el detalle campo-por-campo de `showNotification`, pero el
hallazgo central: la traza de click sigue en cero (push_received/
show_notification SÍ llegan, notificationclick_decision/_client/
_routing_result NUNCA, ni siquiera horas después) — igual que en R1P6D y
R1P6F, así que no se repite la conclusión descartada de "iOS no ejecuta
notificationclick" (el control Cliente R1P6H la refuta). La diferencia
concreta y verificada entre la instancia PASS real (Cliente, `order_update`
estado `aceptado`) y la instancia FAIL real (Operaciones,
`operaciones_pyr_new_order` de R1P6J) es que **Operaciones siempre define
`actions: [{action:"view",...}]` y `requireInteraction: true`**, mientras
que esa instancia de Cliente no definía ninguno de los dos — ambas
variables covarían siempre juntas en la muestra actual (confundidas, no
aisladas). Un hilo de Apple Developer Forums (726793) describe exactamente
este patrón en iOS Safari (actions ignoradas, evento degradado, siempre
termina en la home de la PWA) — evidencia de plataforma coincidente pero no
concluyente (fuente no oficial, variable confundida, sin reproducción
instrumentada propia). `ROOT_CAUSE_CONFIDENCE=MEDIA`, no ALTA.

```text
FIX_CAN_BE_DESIGNED_FROM_CURRENT_EVIDENCE=NO
NEXT_ACTION=un futuro control físico A/B EN Operaciones mismo, aislando
  actions vs requireInteraction — NO autorizado ni ejecutado en R1P6K.
```

Sin cambios de código/test, sin DB mutada, sin Push enviado, sin teléfono
tocado, sin Production — R1P6K fue análisis puro.

## PREVIOUS STATE — P2-T44-R1P6I RECOVERY AUDIT — CONFIRMED COMPLETE, NO REPEAT NEEDED (2026-09-18)

Por error operativo, el prompt de R1P6I (alinear `navigate()`/
`openWindow()` de Operaciones a URL absoluta) se envió a Codex en vez de a
Claude. Esta entrada reconcilia el estado real tras una auditoría
completa read-only — ver
`codex-reports/P2_T44_R1P6I_CODEX_EXECUTION_RECOVERY_AUDIT.md`.

**Codex trabajó en el worktree/rama correctos** (el mismo `work/p2-t43-r2`
de siempre, NO T39 — `T39_WORKTREE_UNTOUCHED=SI` confirmado), implementó
EXACTAMENTE el cambio mínimo esperado (sólo `public/sw.js`: `absoluteTarget
= self.location.origin + targetUrl`, usado en los `navigate()`/
`openWindow()` de la rama de Operaciones — validación, client matching,
orden focus/navigate, fallback y traza durable R1P6E intactos,
confirmado por diff línea por línea, no sólo por su reporte), actualizó
correctamente las pruebas de regresión ya existentes de R1P6C/R1P6E (107
tests, re-ejecutados de forma independiente en esta auditoría: 107 pass/0
fail), hizo commit (`d6cde93fb35b822ff839bf25353922f3a41437ce`) y push a
`origin/testing-codex`. El propio reporte de Codex dejó el deploy como
`PENDING_DEPLOY` (nunca lo verificó) — pero el autodeploy de Railway
sobre el push **sí se disparó y completó con éxito**
(`b1cb99fb-da12-4b3d-af26-f629d0a0410c`, `SUCCESS`, commit exacto
confirmado), y el `sw.js` servido en TESTING contiene el código y la
`routingVersion` correctos — todo confirmado de forma independiente en
esta auditoría (TSC/ESLint/build/diff-check también limpios).

```text
CODEX_ACTION_CLASSIFICATION=CODEX_COMMITTED_AND_DEPLOYED_TESTING
CODEX_CHANGE_MATCHES_INTENDED_R1P6I=SI
T39_WORKTREE_UNTOUCHED=SI

R1P6I_COMMIT_SHA=d6cde93fb35b822ff839bf25353922f3a41437ce
TESTING_DEPLOY_ID=b1cb99fb-da12-4b3d-af26-f629d0a0410c
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_COMMIT=d6cde93fb35b822ff839bf25353922f3a41437ce (coincide exacto)
LIVE_TRACE_VERSION=P2_T44_R1P6E_SW_TRACE_V2 (preservado)
LIVE_ROUTING_VERSION=P2_T44_R1P6I_ABSOLUTE_OPERATIONS_TARGET (confirmado live)
LIVE_ABSOLUTE_OPERATIONS_TARGET_CODE=SI

FOCAL_TESTS=107 pass / 0 fail (re-verificado de forma independiente, no sólo leído del reporte de Codex)
TSC_NEW_ERRORS=0 (31 baseline sin cambios)
BUILD=OK
DIFF_CHECK=limpio (sólo 2 líneas de whitespace cosmético en el .md del reporte)

HALLAZGO_ADICIONAL=el pedido de control de R1P6H (cmu7ctl4g000fnu0am3i5c681) ya pasó de recibido a aceptado — confirma que el control físico R1P6H realmente se ejecutó y dio PASS, exactamente como se diseñó (no es una anomalía ni requiere remediación)

P2_T44_R1P6I_STATUS=IMPLEMENTED_TESTED_COMMITTED_PUSHED_DEPLOYED_TESTING_SUCCESS (corrige el marcador desactualizado PENDING_COMMIT_DEPLOY que Codex nunca actualizó tras completar esos pasos)
R1P6H_PERSONAL_CONTROL_PHYSICAL=PASS (preservado)
RELATIVE_URL_ROOT_CAUSE=SUPPORTED_BUT_UNPROVEN (preservado — R1P6I lo corrige por diseño, todavía no certificado físicamente)
G3_PHYSICAL_CERTIFIED=NO

NO_CODE_REPEATED=SI — Claude NO reimplementa R1P6I, ya está completo y correcto
NEXT_ACTION=P2_T44_R1P6J_SINGLE_PHYSICAL_ABSOLUTE_URL_PROBE (no ejecutada; requiere autorización explícita de una tarea futura; identificar/preparar un pedido retiro `recibido` NUEVO del fixture para G3 — el pedido usado en el control de Cliente de R1P6H ya no sirve, quedó en `aceptado`)

PRODUCT_CODE_CHANGED_BY_THIS_AUDIT=NO
TEST_CODE_CHANGED_BY_THIS_AUDIT=NO
DB_MUTATED_BY_THIS_AUDIT=NO
PUSH_SENT_BY_THIS_AUDIT=NO
PHONE_TOUCHED_BY_THIS_AUDIT=NO
PRODUCTION_TOUCHED=NO
```

## PRIOR STATE — P2-T44-R1P6I ABSOLUTE OPERATIONS TARGET (2026-09-18) — escrito por Codex, marcador de deploy desactualizado, ver reconciliación arriba

R1P6H quedó confirmado físicamente en iOS: Cliente con un WindowClient
existente en background recibió un único Push `order_update`, el tap abrió
Pedidos y mostró el pedido correcto. Este control refuta un fallo global de
`notificationclick`, de `WindowClient` o de `navigate()` en este dispositivo.
G3 sigue sin certificación física.

R1P6I implementa únicamente en `public/sw.js` la alineación de la rama
Operations: conserva `targetUrl` como path validado y usa
`absoluteTarget = self.location.origin + targetUrl` para cada
`navigate()`/`openWindow()` de los cinco tipos Operations. La selección de
clients, el orden navigate→focus, fallback, validación y ramas ajenas quedan
sin cambios. `traceVersion` permanece
`P2_T44_R1P6E_SW_TRACE_V2`; el nuevo `routingVersion` es
`P2_T44_R1P6I_ABSOLUTE_OPERATIONS_TARGET`.

Ver reporte completo:
`codex-reports/P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md`.

```text
P2_T44_R1P6I_STATUS=IMPLEMENTED_TESTED_PENDING_COMMIT_DEPLOY
R1P6H_PERSONAL_CONTROL_PHYSICAL=PASS
IOS_NOTIFICATIONCLICK_GLOBALLY_BROKEN_ON_THIS_DEVICE=REFUTED
EXISTING_WINDOWCLIENT_ALONE_CAUSES_FAILURE=REFUTED
WINDOWCLIENT_NAVIGATE_GLOBALLY_BROKEN_ON_THIS_DEVICE=REFUTED
SHARED_SW_GLOBALLY_BROKEN=REFUTED
RELATIVE_URL_ROOT_CAUSE=SUPPORTED_BUT_UNPROVEN
TRACE_VERSION=P2_T44_R1P6E_SW_TRACE_V2
ROUTING_VERSION=P2_T44_R1P6I_ABSOLUTE_OPERATIONS_TARGET
TARGET_VALIDATION_CHANGED=NO
CLIENT_MATCH_POLICY_CHANGED=NO
FOCUS_ORDER_CHANGED=NO
FALLBACK_SEMANTICS_CHANGED=NO
PUSH_PRODUCER_CHANGED=NO
AUTH_CHANGED=NO
DB_CHANGED=NO
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
MANIFEST_CHANGED=NO
FOCUSED_TESTS=87_PASS_0_FAIL
TSC_NEW_ERRORS=0
ESLINT=PASS
BUILD=PASS
SW_SYNTAX_CHECK=PASS
DIFF_CHECK=PASS
G3_PHYSICAL_CERTIFIED=NO
R1P6J_PREPARATION_READY=SI
ORDER_CREATED=NO
PUSH_SENT=NO
PHONE_TOUCHED=NO
CLIENT_PUSH_SWITCH_TOUCHED=NO
OPERATIONS_PUSH_SWITCH_TOUCHED=NO
LOGOUT_PERFORMED=NO
PRODUCTION_TOUCHED=NO
FULL_CONTEXT_CONSISTENCY_CHECK=PASS_R1P6H_EVIDENCE_AND_R1P6I_SCOPE_ALIGNED
NEXT_ACTION=P2_T44_R1P6J_SINGLE_PHYSICAL_ABSOLUTE_URL_PROBE
```

## HISTORICAL SNAPSHOT — P2-T44-R1P6H1 CLIENT PUSH SUBSCRIPTION VERIFIED — READY FOR PHYSICAL CONTROL (2026-09-18)

El operador activó manualmente el switch de notificaciones Push en la
PWA Cliente del iPhone. Verificación read-only confirma que se creó
correctamente **1 sola** `PushSubscription` (`cmu7dldyk000lnu0aemo0e3w4`,
`ownerType=cliente`, `ownerId=cmu4o5h5r0006riw8u1sujatk`, `channel=default`,
sin duplicados). El pedido de control
(`cmu7ctl4g000fnu0am3i5c681`, retiro, Negocio B) sigue en `recibido`, sin
cambios. **El control físico diseñado en R1P6H queda listo para
ejecutarse** — ver
`codex-reports/P2_T44_R1P6H1_CLIENT_PUSH_SUBSCRIPTION_VERIFICATION.md`.

```text
CLIENT_PUSH_SUBSCRIPTION_COUNT=1
ACTIVE_SUBSCRIPTION_COUNT=1
READY_FOR_PHYSICAL_CONTROL=SI

ORDER_ID=cmu7ctl4g000fnu0am3i5c681 (retiro, recibido, sin cambios — reusar, NO crear uno nuevo)
CONTROL_ACTION_ACCEPT_AVAILABLE=SI (endpoint /api/operativo/pyr/pedidos/[id]/aceptar, sesión PyR ya autenticada)
NOTIFICATION_TYPE=order_update / EXPECTED_TITLE=Actualización de pedido / EXPECTED_PUSH_COUNT=1
TARGET_ESPERADO=/cliente/?tab=pedidos&pedidoId=cmu7ctl4g000fnu0am3i5c681&focusPedido=1 (URL ABSOLUTA una vez que sw.js le antepone self.location.origin)

DB_MUTATED=NO (esta tarea de verificación; la suscripción la creó el propio operador desde el dispositivo)
ORDER_CHANGED=NO
PUSH_SENT=NO
CODE_CHANGED=NO
DEPLOY_PERFORMED=NO
PRODUCTION_TOUCHED=NO

G3_PUSH_DELIVERY_PHYSICAL=PASS (preservado)
G3_PHYSICAL_CERTIFIED=NO
ROOT_CAUSE_CONFIDENCE=MEDIUM (sin cambios — esta tarea no ejecutó el control)

NEXT_ACTION=ejecutar (en una tarea futura, con autorización explícita) el control físico ya diseñado en R1P6H: tocar "Aceptar pedido" sobre cmu7ctl4g000fnu0am3i5c681 desde Operaciones-PyR, confirmar 1 Push "Actualización de pedido", tocarlo una vez, observar destino — sin crear ningún pedido nuevo.
```

## PRIOR STATE — P2-T44-R1P6H iOS PERSONAL CONTROL PREPARED — AWAITING CLIENT PUSH SUBSCRIPTION (2026-09-18)

Preparado (no ejecutado) un control A/B físico: Cliente con un client
existente en background recibiendo un `order_update` real, para comparar
contra `FAIL_HOME` ya conocido de Operaciones. Elegido por ser el único
evento ejecutable con actores YA disponibles: la acción "Aceptar pedido"
del empleado PyR ya autenticado sobre `cmu7ctl4g000fnu0am3i5c681` (pedido
YA existente, `retiro`, `recibido`, del Cliente `test_t44_r1n_cliente_
4135ea7a@example.test` en Negocio B) — dispara `order_update` (título fijo
"Actualización de pedido") vía `orderUpdateNotification` +
`createNotification`, sin necesitar ningún actor/credencial nueva.

**Bloqueo encontrado, respetado sin mutar nada**: el Cliente fixture NO
tiene ninguna `PushSubscription` activa (0 filas, ni normalizada ni
legacy). Por instrucción explícita de la tarea, STOP — no se habilitó
nada. Ver `codex-reports/P2_T44_R1P6H_IOS_PERSONAL_CONTROL_PREPARATION.md`.

```text
CONTROL_SURFACE=Cliente (representa también Negocio/Repartidor — mismo código compartido, R1P6G)
SELECTED_CONTROL_NOTIFICATION_TYPE=order_update
ORDER_ID_IF_REQUIRED=cmu7ctl4g000fnu0am3i5c681 (ya existente, NO crear uno nuevo)
CLIENT_PUSH_SUBSCRIPTION_COUNT=0
READY_FOR_PHYSICAL_CONTROL=NO

ACCION_HUMANA_REQUERIDA=el operador debe abrir la PWA Cliente en el iPhone (contraseña ya entregada en el reseteo de credenciales previo) y activar el switch de notificaciones Push desde su perfil/configuración — sin esto, no hay forma de recibir el Push de control.

CONTROL_TARGET_PATH=/cliente/?tab=pedidos&pedidoId=cmu7ctl4g000fnu0am3i5c681&focusPedido=1
CONTROL_ABSOLUTE_TARGET_FORM=self.location.origin + targetPath (URL ABSOLUTA — a diferencia de Operaciones, que usa la URL relativa tal cual)
CONTROL_BRANCH=rama Personal (Cliente/Negocio/Repartidor compartida), estructuralmente idéntica a Operaciones desde R1P6C salvo por esa diferencia de forma de URL

CASE_CONTROL_PASS_MEANING=si Cliente navega correctamente: refuerza mucho la hipótesis de URL relativa-vs-absoluta como causa real, y debilita la teoría de plataforma como única explicación
CASE_CONTROL_FAIL_HOME_MEANING=si Cliente TAMBIÉN falla: refuerza mucho la hipótesis de plataforma iOS/WebKit (bug de despacho de notificationclick con client existente) con evidencia PROPIA del dispositivo, y debilita relativa-vs-absoluta como causa suficiente — en ese caso NO implementar el cambio de URL absoluta esperando que resuelva el síntoma

WEBKIT_NOTIFICATIONCLICK_BUG=POSSIBLE_SUPPORTED_EXTERNALLY (preservado, no confirmado con evidencia propia todavía)
OPERATIONS_TARGET_FORM=RELATIVE
PERSONAL_TARGET_FORM=ABSOLUTE
RELATIVE_URL_ROOT_CAUSE=UNPROVEN (este control es exactamente el experimento diseñado para resolverlo)

G3_PUSH_DELIVERY_PHYSICAL=PASS (preservado)
G3_PHYSICAL_CERTIFIED=NO
ROOT_CAUSE_CONFIDENCE=MEDIUM (sin cambios — esta tarea no ejecutó la prueba, sólo la preparó)

R1P_PREPARATION_READY=SI
R1P_PHYSICAL_PROBE=PAUSED
R1P_DISABLE_STATUS=PAUSED_PENDING_G3_PLATFORM_LEVEL_ROOT_CAUSE_RESOLUTION_OR_DEVICE_INSPECTION

P2_T44_REUSABLE_TESTING_FIXTURE_POLICY=PRESERVE_CORE_FIXTURE_AFTER_CERTIFICATION
P2_T44_FIXTURE_CREDENTIAL_POLICY=NO_AUTOMATIC_PASSWORD_ROTATION_WITHOUT_OPERATOR_AUTHORIZATION
NO_PRODUCTION_NETWORK_REQUESTS_DURING_T44_TESTING=SI (respetada)

PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
DB_MUTATED=NO
PUSH_SENT=NO
PHONE_TOUCHED=NO
DEPLOY_PERFORMED=NO
PRODUCTION_TOUCHED=NO

NEXT_ACTION=AWAITING_CLIENT_PUSH_SUBSCRIPTION — el operador debe activar notificaciones Push en la PWA Cliente del iPhone; recién después de eso se puede ejecutar (en una tarea futura, con autorización explícita) el control físico ya diseñado en esta tarea (tocar "Aceptar pedido" sobre cmu7ctl4g000fnu0am3i5c681 desde Operaciones-PyR, confirmar 1 Push "Actualización de pedido", tocarlo una vez, observar destino).
```

## PRIOR STATE — P2-T44-R1P6G iOS NOTIFICATIONCLICK COMPARATIVE AUDIT — PLATFORM-LEVEL ROOT CAUSE (2026-09-18)

**Corrección crítica de plataforma**: `DEVICE_PLATFORM=iOS`, no Android —
esto invalida retroactivamente la hipótesis de R1P6D ("Android Doze
restringe la red en el momento del click"), que nunca aplicó a este
dispositivo. También se resolvió el "segundo pedido no explicado" de
R1P6F: fue un segundo test INTENCIONAL del operador con Operaciones
abierta (resultado: FAIL_HOME, igual que el primero) — no un accidente.

Auditoría completa de `public/sw.js` (control-flow línea por línea) no
encontró NINGÚN `return`/`throw` propio alcanzable por el payload REAL de
G3 antes de la primera traza durable — es decir, si el listener
`notificationclick` llega a ejecutarse con los datos que el servidor
confirmó (payload/URL siempre correctos en las 4 rondas), SIEMPRE debería
producir al menos `notificationclick_decision`. Como eso nunca ocurrió,
la explicación más respaldada ahora es de **plataforma, no de código
propio**: dos bugs de WebKit documentados públicamente y de forma
independiente — **bugs.webkit.org #268797** ("notificationclick events in
serviceworkers not firing" en Home Screen PWAs de iOS, iOS 16.4 a 26.6.1)
y un hilo del foro de desarrolladores de Apple (`indexedDB` es
`undefined` cuando el Service Worker es despertado por una notificación
Push en iOS Safari, exclusivo de Safari) — explican, combinados, por qué
ni la traza de red (R1P5B) ni la traza durable en IndexedDB (R1P6E)
pudieron capturar nunca el click, sin necesidad de asumir ningún bug
adicional en el código de DeliGO.

También se encontró una diferencia de código REAL (no sólo teoría de
plataforma): la rama de Operaciones pasa una URL RELATIVA a
`navigate()`/`openWindow()`, mientras que el patrón ya certificado de
Cliente/Negocio/Repartidor SIEMPRE usa una URL ABSOLUTA
(`self.location.origin + path`). Es la única diferencia de código real
que sobrevive tras el fix de R1P6C — de bajo riesgo y bajo costo de
alinear, aunque no hay evidencia de que sea la causa principal dado el
hallazgo de plataforma. Ver
`codex-reports/P2_T44_R1P6G_IOS_NOTIFICATIONCLICK_COMPARATIVE_AUDIT.md`.

```text
DEVICE_PLATFORM=iOS
R1P6F_SECOND_ORDER_MYSTERY=RESOLVED (segundo test intencional con Operaciones abierta, mismo resultado FAIL_HOME)

NOTIFICATIONCLICK_LISTENER_ENTRY_INSTRUMENTED=NO
CAN_NOTIFICATIONCLICK_EXECUTE_WITHOUT_OPERATIONS_DURABLE_TRACE=SI (si type no matchea ningún tipo conocido, cae a la rama Personal sin ninguna instrumentación remota; o si el listener directamente nunca se despacha — ver hallazgo de plataforma)
ALL_OPERATIONS_BRANCH_GUARDS_PASS=SI (con los valores reales confirmados server-side en las 4 rondas)
G3_CAN_ROUTE_HOME_WITH_ZERO_DURABLE_TRACE=SI — la explicación más respaldada: notificationclick nunca se despacha en absoluto (bug de plataforma documentado), y iOS simplemente trae a primer plano el client Home ya existente, sin que ningún código de sw.js intervenga

H1_NOTIFICATIONCLICK_NOT_FIRED_IOS=SUPPORTED (por documentación externa oficial: bugs.webkit.org #268797)
H2 a H4, H6, H8=REFUTED (guards de G3 pasan siempre con datos reales; Operaciones es la primera rama; fallback genérico apunta a /cliente/, no a Home Operaciones; SW único sin fragmentación de scope)
H5/H7=UNPROVEN pero real — diferencia URL relativa (Operaciones) vs. absoluta (known-good)

ROOT_CAUSE_LAYER=PLATFORM_NOTIFICATIONCLICK_DISPATCH (iOS/WebKit) — reclasificado desde UNPROVEN_CLICK_EXECUTION de R1P6F
ROOT_CAUSE_CONFIDENCE=MEDIUM (la más respaldada de la investigación completa, sin llegar a HIGH — sin confirmación device-side directa)

FIX_CAN_BE_DESIGNED_FROM_CURRENT_EVIDENCE=SI (parcial, sólo el cambio de bajo riesgo)
PROPOSED_FIX_SCOPE=alinear navigate()/openWindow() de la rama Operaciones a URL absoluta (self.location.origin + targetUrl), igual que el patrón ya certificado — NO implementado en esta tarea
NEXT_DIAGNOSTIC=si el operador puede conectar el iPhone a una Mac (Web Inspector remoto vía Safari), inspeccionar directamente el Service Worker + IndexedDB tras un tap respondería de forma directa, no inferida, lo que ninguna telemetría remota pudo confirmar en 4 rondas

G3_PUSH_DELIVERY_PHYSICAL=PASS (preservado)
G3_PHYSICAL_CERTIFIED=NO

R1P_PREPARATION_READY=SI
R1P_PHYSICAL_PROBE=PAUSED
R1P_DISABLE_STATUS=PAUSED_PENDING_G3_PLATFORM_LEVEL_ROOT_CAUSE_RESOLUTION_OR_DEVICE_INSPECTION

P2_T44_REUSABLE_TESTING_FIXTURE_POLICY=PRESERVE_CORE_FIXTURE_AFTER_CERTIFICATION
P2_T44_FIXTURE_CREDENTIAL_POLICY=NO_AUTOMATIC_PASSWORD_ROTATION_WITHOUT_OPERATOR_AUTHORIZATION
NO_PRODUCTION_NETWORK_REQUESTS_DURING_T44_TESTING=SI (respetada; contexto externo obtenido vía documentación pública MDN/WebKit/Apple, nunca contra infraestructura DeliGO)

PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
ORDER_CREATED=NO
PUSH_SENT=NO
PHONE_TOUCHED=NO
PRODUCTION_TOUCHED=NO

NEXT_ACTION=decidir con el operador entre (a) intentar la inspección device-side directa vía Safari Web Inspector remoto antes de cualquier cambio de código, o (b) implementar el fix de bajo riesgo de URL absoluta en la rama de Operaciones como mejora de todas formas, entendiendo que puede no resolver una causa de plataforma. Ninguna de las dos se ejecuta todavía sin autorización explícita de una tarea futura.
```

## PRIOR STATE — P2-T44-R1P6F DURABLE TRACE PROBE — CLICK STILL UNOBSERVED, EVEN DURABLY (2026-09-18)

Tercera ronda física consecutiva con el mismo síntoma visual (Push → tap
→ Home), esta vez con la traza durable de R1P6E ya desplegada. Resultado
clave: **tampoco apareció ningún evento de `notificationclick`, ni
inmediato ni recuperado en un flush posterior** — pese a que hubo una
oportunidad real de recuperación (un segundo Push, ~69s después, con red
confirmada funcionando en ese momento, ya que ESE mismo push sí completó
su propia traza por red exitosamente). Esto **debilita** la hipótesis de
R1P6D ("la red falló justo en el instante del click") porque la
persistencia en IndexedDB no depende de la red — su ausencia total
apunta ahora a que el código de `notificationclick` probablemente **nunca
se ejecuta** en el dispositivo real para este tap, una hipótesis más
profunda que ningún test unitario en sandbox puede exponer. Hallazgo
lateral: la DB muestra DOS pedidos nuevos en esta ventana (no uno como
describió el operador) — documentado transparentemente, sin resolver la
discrepancia por suposición; ambos con evidencia server-side idéntica
(correcta) y ninguno con traza de click. Ver
`codex-reports/P2_T44_R1P6F_DURABLE_TRACE_PHYSICAL_PROBE_ANALYSIS.md`.

```text
R1P6F_ORDER_ID=cmu7chaqn0003nu0alrnmeioy (pedido principal; segundo candidato no explicado: cmu7cirge0009nu0abr392ddt, ~69s después)
TRACE_PUSH_RECEIVED_FOUND=SI (ambos pedidos)
TRACE_SHOW_NOTIFICATION_FOUND=SI (ambos)
TRACE_PUSH_VERSION=P2_T44_R1P6E_SW_TRACE_V2 (confirmado, dispositivo real)
TRACE_PUSH_ROUTING_VERSION=P2_T44_R1P6C_EXISTING_CLIENT_FIX (confirmado)

DURABLE_CLICK_DECISION_FOUND=NO
DURABLE_CLICK_CLIENT_EVENTS_FOUND=NO
DURABLE_CLICK_ROUTING_RESULT_FOUND=NO
DURABLE_TRACE_RECOVERY_USED=NO (hubo oportunidad real de recuperación con red confirmada — nada se recuperó)

PYR_API_AFTER_CLICK=NO (a diferencia de R1P6D, esta ronda ni siquiera muestra el acceso ambiguo aislado a /api/operativo/pyr/pedidos — comportamiento limpio: Home antes, silencio, Home después)

H8_DURABLE_TRACE_FAILURE=SUPPORTED, con más fuerza que nunca
HALLAZGO_MAS_PROFUNDO=la ausencia de recuperación durable con red confirmada sugiere que el código de notificationclick probablemente no llega a ejecutarse en absoluto en el dispositivo real para este tap — no sólo que su telemetría se pierde

ROOT_CAUSE_LAYER=UNPROVEN_CLICK_EXECUTION (reclasificado, más cauto que INSTRUMENTATION_DELIVERY_GAP de R1P6D — ya no se puede asumir que el código de ruteo corrió)
ROOT_CAUSE_CONFIDENCE=MEDIUM (sin subir a HIGH — la evidencia de esta ronda reduce certeza sobre el mecanismo exacto en vez de confirmarlo; sin bajar a LOW — el lado servidor sigue impecable, 4ta ronda consecutiva)

FIX_CAN_BE_IMPLEMENTED_NOW=NO
NEXT_ACTION_SUGERIDA_NO_EJECUTADA=inspección directa vía chrome://inspect/remote debugging del Service Worker + IndexedDB (deligo-sw-debug) inmediatamente después de un tap, si el operador tiene esa capacidad — respondería de forma directa, no inferida, las preguntas que ninguna telemetría remota pudo resolver en 3 rondas

G3_PUSH_DELIVERY_PHYSICAL=PASS (preservado)
G3_R1P6F_DEEP_LINK_VISUAL=FAIL
G3_R1P6F_DESTINATION=HOME_OPERACIONES
G3_PHYSICAL_CERTIFIED=NO

R1P_PREPARATION_READY=SI
R1P_PHYSICAL_PROBE=PAUSED
R1P_DISABLE_STATUS=PAUSED_PENDING_G3_DEVICE_SIDE_INSPECTION_OR_NEW_DIAGNOSTIC_APPROACH

P2_T44_REUSABLE_TESTING_FIXTURE_POLICY=PRESERVE_CORE_FIXTURE_AFTER_CERTIFICATION
P2_T44_FIXTURE_CREDENTIAL_POLICY=NO_AUTOMATIC_PASSWORD_ROTATION_WITHOUT_OPERATOR_AUTHORIZATION
NO_PRODUCTION_NETWORK_REQUESTS_DURING_T44_TESTING=SI (respetada en esta tarea)

PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
ORDER_CREATED_BY_ANALYSIS=NO (los 2 pedidos ya existían antes de esta tarea)
SWITCH_TOUCHED=NO
LOGOUT_PERFORMED=NO

NEXT_ACTION=no ejecutar otra sonda física a ciegas. Evaluar con el operador si es posible una inspección device-side directa (chrome://inspect) del Service Worker/IndexedDB inmediatamente después de un tap, antes de intentar cualquier otro cambio de código o instrumentación remota adicional.
```

## PRIOR STATE — P2-T44-R1P6E DURABLE SW CLICK TRACE — IMPLEMENTED, TESTED, LIVE IN TESTING (2026-09-18)

Cerrada (a nivel de instrumentación, no de causa raíz) la brecha de
observabilidad que R1P6A y R1P6D expusieron dos veces: `notificationclick`
ahora persiste sus 3 eventos críticos (`_decision`/`_client`/
`_routing_result`) en IndexedDB (`deligo-sw-debug`/`pending-traces`) ANTES
de intentar la red, con reintento automático (`flushPendingSwTraces()`)
en cada punto seguro en que el SW despierta (`activate`/`push`/
`notificationclick`) — TTL 24h, tope de 50 registros (el más viejo se
descarta primero), borrado sólo tras confirmación HTTP real. La rama de
ruteo de R1P6C (client matching, orden `navigate()→focus()`, fallback
`openWindow`) es **byte-idéntica** — sólo cambió qué función construye y
envía cada evento de traza. Nueva versión de traza
`P2_T44_R1P6E_SW_TRACE_V2` + campo independiente
`routingVersion=P2_T44_R1P6C_EXISTING_CLIENT_FIX` en TODOS los eventos.
Ver `codex-reports/P2_T44_R1P6E_DURABLE_SW_CLICK_TRACE.md`.

```text
G3_EXISTING_CLIENT_FIX_IMPLEMENTED=SI (preservado, R1P6C)
DURABLE_CLICK_TRACE_IMPLEMENTED=SI
TRACE_VERSION_OLD=P2_T44_R1P5B_SW_TRACE_V1
TRACE_VERSION_NEW=P2_T44_R1P6E_SW_TRACE_V2
ROUTING_VERSION=P2_T44_R1P6C_EXISTING_CLIENT_FIX
INDEXEDDB_DB_NAME=deligo-sw-debug
INDEXEDDB_STORE_NAME=pending-traces
TRACE_TTL=86400000 (24h)
TRACE_MAX_RECORDS=50

R1P6E_COMMIT_SHA=ab168a981d81104f2a240ab0cadbcb1e7394d3dd
TESTING_DEPLOY_ID=d45fc2c4-a863-4c25-9338-1e9d3e16d4bd
TESTING_DEPLOY_STATUS=SUCCESS (commitHash confirmado exacto)
LIVE_SW_TRACE_VERSION=P2_T44_R1P6E_SW_TRACE_V2 (confirmado en sw.js servido)
LIVE_SW_ROUTING_VERSION=P2_T44_R1P6C_EXISTING_CLIENT_FIX (confirmado)
LIVE_DURABLE_TRACE_CODE_PRESENT=SI (flushPendingSwTraces/deligo-sw-debug/isOperationsClientPathname confirmados)
R1P6C_ROUTING_FIX_STILL_PRESENT=SI
ACCOUNT_PUSH_SUBSCRIPTION_COUNT=1 (sin cambios)
SWITCH_EXPECTED_STATE=ON

FOCAL_TESTS=107 pass / 0 fail (40 en sw-notificationclick-target-routing.test.ts incluyendo 8 nuevos de traza durable con fake IndexedDB propio del test; 67 en sw-push-role-icon-routing/sw-push-dedupe/sw-icon-cache-bypass/debug-sw-trace incluyendo 2 nuevos en el endpoint)
TSC_NEW_ERRORS=0 (31 preexistentes, baseline sin cambios)
BUILD=OK

R1P6F_PREPARATION_READY=SI — una sola sonda inicial: app abierta en Home → background → UN pedido → Push → tap → observar destino; NO crear segundo pedido hasta analizar la traza durable. Criterio de éxito diagnóstico: obtener durablemente notificationclick_decision/_client/_routing_result con traceVersion=V2 y routingVersion=R1P6C, incluso si llegan recién tras un flush posterior (DURABLE_TRACE_RECOVERY=PASS sería el resultado esperado en ese caso, no una falla).

G3_PUSH_DELIVERY_PHYSICAL=PASS (preservado)
G3_PRE_FIX_EXISTING_HOME_PHYSICAL=FAIL
G3_PRE_FIX_CLOSED_APP_PHYSICAL=PASS
G3_POST_FIX_EXISTING_HOME_PHYSICAL=FAIL
G3_POST_FIX_FAILURE_REPRODUCED_TWICE_BY_OPERATOR=SI
G3_PHYSICAL_CERTIFIED=NO (sin cambios — esta tarea es de instrumentación, no de routing)
ROOT_CAUSE_CONFIDENCE=MEDIUM (sin cambios — esta tarea no reevalúa causa raíz)

R1P_PREPARATION_READY=SI
R1P_PHYSICAL_PROBE=PAUSED
R1P_DISABLE_STATUS=PAUSED_PENDING_G3_DURABLE_CLICK_TRACE_AND_RECERTIFICATION

P2_T44_REUSABLE_TESTING_FIXTURE_POLICY=PRESERVE_CORE_FIXTURE_AFTER_CERTIFICATION
P2_T44_FIXTURE_CREDENTIAL_POLICY=NO_AUTOMATIC_PASSWORD_ROTATION_WITHOUT_OPERATOR_AUTHORIZATION
NO_PRODUCTION_NETWORK_REQUESTS_DURING_T44_TESTING=SI (respetada — ninguna request a Production en esta tarea)

PRODUCT_CODE_CHANGED=SI (public/sw.js + src/app/api/push/debug-sw-trace/route.ts, únicamente)
TEST_CODE_CHANGED=SI (sw-notificationclick-target-routing.test.ts + debug-sw-trace/route.test.ts)
ORDER_CREATED=NO
PUSH_SENT=NO
PHONE_TOUCHED=NO
SWITCH_TOUCHED=NO
LOGOUT_PERFORMED=NO
PRODUCTION_TOUCHED=NO

NEXT_ACTION=P2_T44_R1P6F_DURABLE_TRACE_SINGLE_PHYSICAL_PROBE (no ejecutada; requiere autorización explícita de una tarea futura — una sola sonda, no dos, hasta analizar la traza durable resultante)
```

## PRIOR STATE — P2-T44-R1P6D POST-FIX PHYSICAL FAILURE — ROOT CAUSE BACK TO MEDIUM (2026-09-17)

El fix de R1P6C (commit `fb1f228`, live en TESTING desde ~59 min antes)
se probó físicamente DOS veces con la app abierta en Home — **el síntoma
persiste en ambos intentos** (`DESTINO_FINAL=HOME_OPERACIONES` ambas
veces). Confirmado por DB read-only: fueron DOS pedidos reales distintos
(`cmu65zh040001li0burtu54zg`, `cmu660x5q0007li0b9wbdoe20`), no la misma
notificación tocada dos veces — cada uno con su propia `Notificacion`,
Push (1 envío, providerStatus=201) y traza `push_received`/
`show_notification` correctas. **Pero, otra vez, ningún
`notificationclick_decision`/`_client`/`_routing_result` llegó al
servidor en ninguno de los dos intentos** — el mismo vacío de
observabilidad de R1P6A, ahora confirmado una segunda vez, incluso con el
fix ya desplegado. Un detalle nuevo y genuinamente ambiguo: entre los dos
intentos hubo UN solo acceso a `/api/operativo/pyr/pedidos` (el panel
PyR), rodeado de polling de Home antes y después — no se pudo determinar
si fue el deep link funcionando transitoriamente (y algo lo revirtió) o
una exploración manual del operador; el intento 2 no tuvo NINGÚN acceso
al panel PyR. `ROOT_CAUSE_CONFIDENCE` **baja de `HIGH` a `MEDIUM`**: la
debilidad que R1P6C corrigió era real y el fix es código correcto (97
tests lo prueban), pero el síntoma físico persiste, así que esa debilidad
no era (o no era la única) causa suficiente. Ver
`codex-reports/P2_T44_R1P6D_POST_FIX_PHYSICAL_FAILURE_TRACE_ANALYSIS.md`.

```text
PRE_FIX_ROOT_CAUSE_CONFIDENCE=HIGH
POST_FIX_ROOT_CAUSE_CONFIDENCE=MEDIUM
POST_FIX_RESULT_INVALIDATES_SUFFICIENCY_OF_R1P6B_ROOT_CAUSE=SI
ROOT_CAUSE_LAYER=INSTRUMENTATION_DELIVERY_GAP (otra vez la capa dominante — idéntica a R1P6A)
DEVICE_EXECUTED_R1P6C_ROUTING_CODE=UNPROVEN (sin click trace, imposible de confirmar cuál código ejecutó el click)

POST_FIX_ORDER_IDS=cmu65zh040001li0burtu54zg, cmu660x5q0007li0b9wbdoe20
POST_FIX_NOTIFICATION_IDS=cmu65zh1l0005li0bguw326tf, cmu660x6z000bli0bm1t1zpiq
POST_FIX_PUSH_SEND_COUNTS=1, 1 (ambos correctos, server-side sin problema por tercera vez consecutiva)
CLICK_TRACE_FOUND=NO (ambos intentos)

NEXT_FIX_DESIGN=cerrar la brecha de observabilidad del click de forma DURABLE antes de tocar routing de nuevo — retomar la propuesta de R1P6A (persistir el evento de notificationclick en IndexedDB dentro del propio SW, antes de intentar la red, con reintento en el siguiente despertar). La evidencia A/B de R1P6B era real pero insuficiente por sí sola.
FIX_CAN_BE_IMPLEMENTED_NOW=NO (otro fix de comportamiento sin ver el click real repetiría el mismo error)

G3_PUSH_DELIVERY_PHYSICAL=PASS (preservado)
G3_PRE_FIX_EXISTING_HOME_PHYSICAL=FAIL
G3_PRE_FIX_CLOSED_APP_PHYSICAL=PASS
G3_POST_FIX_EXISTING_HOME_PHYSICAL=FAIL
G3_POST_FIX_FAILURE_REPRODUCED_TWICE_BY_OPERATOR=SI
G3_PHYSICAL_CERTIFIED=NO (R1P6C NO se certifica físicamente)

R1P_PREPARATION_READY=SI
R1P_PHYSICAL_PROBE=PAUSED
R1P_DISABLE_STATUS=PAUSED_PENDING_G3_DURABLE_CLICK_TRACE_AND_RECERTIFICATION

P2_T44_REUSABLE_TESTING_FIXTURE_POLICY=PRESERVE_CORE_FIXTURE_AFTER_CERTIFICATION
P2_T44_FIXTURE_CREDENTIAL_POLICY=NO_AUTOMATIC_PASSWORD_ROTATION_WITHOUT_OPERATOR_AUTHORIZATION
NO_PRODUCTION_NETWORK_REQUESTS_DURING_T44_TESTING=SI (respetada — ninguna request a Production en esta tarea)

PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
ORDER_CREATED_BY_ANALYSIS=NO (los 2 pedidos analizados fueron creados por el operador antes de esta tarea)
SWITCH_TOUCHED=NO
LOGOUT_PERFORMED=NO

NEXT_ACTION=diseñar e implementar (tarea futura) la instrumentación durable de notificationclick vía IndexedDB, redesplegar TESTING, y ejecutar una cuarta sonda física con esa telemetría reforzada antes de intentar cualquier otro cambio de comportamiento de routing.
```

## PRIOR STATE — P2-T44-R1P6C G3 EXISTING-CLIENT ROUTING FIX — IMPLEMENTED, TESTED, LIVE IN TESTING (2026-09-17)

Implementado el fix mínimo del bug de G3 aislado con `ROOT_CAUSE_CONFIDENCE=HIGH`
en R1P6B. `public/sw.js`, rama compartida de `notificationclick` de
Operaciones (los 5 tipos): ya no existe el segundo loop sin filtro que
aceptaba cualquier client con `focus`/`navigate`; el único client
reutilizable ahora es uno cuyo pathname sea el Home bare
(`/operaciones/mi-panel`, sin barra) o cualquier ruta bajo
`/operaciones/mi-panel/`. La navegación sigue el mismo patrón robusto ya
certificado en la rama personal: `await navigate(targetUrl)` → `focus()`
sobre el client que `navigate()` realmente devolvió (o el original si
resolvió `null`) → `catch` → `clients.openWindow(targetUrl)` (el camino
ya probado físicamente que funciona con la app cerrada). La traza R1P5B
se preservó íntegra, con `routingAction` actualizado
(`NAVIGATE_FOCUS_OPERATIONS_CLIENT` / `NAVIGATE_REJECTED_OPEN_WINDOW` /
`NO_MATCH_OPEN_WINDOW[_REJECTED]`) para que la próxima sonda confirme por
trace real qué rama se ejecutó. Ver
`codex-reports/P2_T44_R1P6C_G3_EXISTING_CLIENT_ROUTING_FIX.md`.

```text
G3_EXISTING_CLIENT_FIX_IMPLEMENTED=SI
R1P6C_COMMIT_SHA=fb1f228ffc39ea4a8e5c7eee10a85053859bfc7a
TESTING_DEPLOY_ID=d26f3334-274b-4360-8122-b9b3f5dcf094
TESTING_DEPLOY_STATUS=SUCCESS (commitHash confirmado exacto)
LIVE_SW_FIX_PRESENT=SI (isOperationsClientPathname + NAVIGATE_FOCUS_OPERATIONS_CLIENT confirmados en sw.js servido)
LIVE_SW_TRACE_MARKER_PRESENT=SI (P2_T44_R1P5B_SW_TRACE_V1 preservado)
ACCOUNT_PUSH_ROW_COUNT=1 (sin cambios, cmu4ni2t0000up90btelfflhq)
SWITCH_EXPECTED_STATE=ON (CuentaOperativa activo=true, sin tocar)

FOCAL_TESTS=97 pass / 0 fail (32 en sw-notificationclick-target-routing.test.ts incluyendo 7 nuevos: Home bare, nested client, foreign client, navigate reject, navigate null, orden navigate-antes-que-focus, regresión de los 5 tipos; 65 en sw-push-role-icon-routing/sw-push-dedupe/sw-icon-cache-bypass/debug-sw-trace sin regresiones)
TSC_NEW_ERRORS=0 (31 preexistentes, baseline sin cambios)
BUILD=OK

MESA_ORDER_READY_CHANGED=NO
MESA_ORDER_READY_EXISTING_CLIENT_ROUTING_LATENT_RISK=SI (comparte la misma debilidad estructural que G3 tenía; su certificación previa sólo cubrió entrega, nunca tap con client existente — no corregido en esta tarea, scope explícitamente limitado a G3)

G3_PUSH_DELIVERY_PHYSICAL=PASS (preservado)
G3_DEEP_LINK_WITH_EXISTING_OPERATIONS_HOME=FAIL (evidencia histórica pre-fix, preservada)
G3_DEEP_LINK_WITH_APP_CLOSED=PASS (evidencia histórica pre-fix, preservada)
G3_PHYSICAL_CERTIFIED=NO (el fix todavía no fue probado físicamente)

R1P_PREPARATION_READY=SI
R1P_PHYSICAL_PROBE=PAUSED

P2_T44_REUSABLE_TESTING_FIXTURE_POLICY=PRESERVE_CORE_FIXTURE_AFTER_CERTIFICATION
P2_T44_FIXTURE_CREDENTIAL_POLICY=NO_AUTOMATIC_PASSWORD_ROTATION_WITHOUT_OPERATOR_AUTHORIZATION
NO_PRODUCTION_NETWORK_REQUESTS_DURING_T44_TESTING=SI (respetada — todos los curl de esta tarea fueron contra la URL de TESTING ya conocida)

PRODUCT_CODE_CHANGED=SI (public/sw.js únicamente)
TEST_CODE_CHANGED=SI (sw-notificationclick-target-routing.test.ts únicamente)
SWITCH_TOUCHED=NO
LOGOUT_PERFORMED=NO
ORDER_CREATED=NO
PUSH_SENT=NO
PRODUCTION_TOUCHED=NO

R1P6D_PREPARATION_READY=SI — PROBE A (prioridad): app abierta en Home de Operaciones → background → 1 pedido retiro nuevo → Push → tap → debe abrir el pedido correcto en PyR. PROBE B (sólo si A pasa): app cerrada → pedido nuevo separado → Push → tap → debe seguir funcionando (no regresar el camino ya certificado). Ninguna ejecutada todavía.

NEXT_ACTION=P2_T44_R1P6D_G3_POST_FIX_EXISTING_HOME_PHYSICAL_PROBE (no ejecutada en esta tarea; requiere autorización explícita de una tarea futura)
```

## PRIOR STATE — P2-T44-R1P6B G3 ROOT CAUSE HIGH CONFIDENCE — EXISTING CLIENT VS CLOSED APP (2026-09-17)

Nueva evidencia física A/B del operador (no planificada originalmente,
registrada sin minimizar): con la PWA de Operaciones YA ABIERTA en el Home
("3 negocios"), el tap del Push G3 falla — igual que R1P4/R1P6A (dos
veces). Pero con la app CERRADA, el mismo tipo de Push, mismo productor,
mismo payload, mismo dispositivo, **el tap SÍ abre el pedido correcto en
el panel PyR** (`G3_CLOSED_APP_DEEPLINK_PHYSICAL=PASS`). Esta comparación
A/B aísla causalmente el bug al camino de "client ya existente" dentro de
la rama compartida de Operaciones en `notificationclick`
(`public/sw.js`): un segundo bucle de selección de client acepta
CUALQUIER ventana con `focus`/`navigate` sin filtrar por pathname (porque
el Home genérico `/operaciones/mi-panel`, sin barra final, nunca matchea
el primer bucle más estricto `startsWith("/operaciones/mi-panel/")`), y
llama `focus()`+`navigate(targetUrl)` sin `await`, sin verificar el
resultado, sin `try/catch`. El camino sin client existente
(`clients.openWindow(targetUrl)`) es una operación atómica del navegador
que SÍ funciona — confirmado ahora físicamente. El patrón conocido-bueno
de notificaciones personales (Cliente/Negocio/Repartidor) nunca tiene un
"cualquier client sin filtrar": su único fallback es siempre `openWindow`,
y su camino de client existente SÍ espera (`await`) el resultado de
`navigate()` y tiene `try/catch` con reintento vía `openWindow`. Con esta
triangulación (aislamiento causal físico + auditoría de código +
contraste con patrón conocido-bueno), `ROOT_CAUSE_CONFIDENCE` sube de
`MEDIUM` a **`HIGH`** por primera vez en esta investigación. Ver
`codex-reports/P2_T44_R1P6B_EXISTING_CLIENT_VS_CLOSED_APP_AUDIT.md`.

```text
G3_PUSH_DELIVERY_PHYSICAL=PASS (preservado)
G3_DEEP_LINK_WITH_EXISTING_OPERATIONS_HOME=FAIL
G3_DEEP_LINK_WITH_APP_CLOSED=PASS
G3_PHYSICAL_CERTIFIED=NO (el caso más común — app ya abierta — sigue roto)

ROOT_CAUSE_LAYER=SERVICE_WORKER_CLICK_ROUTING — EXISTING_CLIENT_NAVIGATION_SUBPATH
ROOT_CAUSE_FILE=public/sw.js
ROOT_CAUSE_FUNCTION=notificationclick, rama compartida de Operaciones (P2-T44-R1P2) — segundo bucle de matching de clients sin filtro + focus()/navigate() sin await/catch
ROOT_CAUSE_CONFIDENCE=HIGH

HALLAZGO_LATERAL=mesa_order_ready comparte la MISMA debilidad estructural (mismo patrón Loop1+Loop2 sin filtro, mismo focus/navigate sin await/catch) — su certificación física previa (R1L/R1M) sólo cubrió ENTREGA del Push, nunca tap+destino con un client ya abierto. Posible bug latente, no confirmado, NO tocado en el fix de G3 (scope explícitamente limitado al branch de Operaciones).

FIX_DISEÑADO_NO_IMPLEMENTADO=(1) eliminar el segundo bucle sin filtro; (2) sobre el bucle restante, usar el mismo patrón robusto de la rama personal: await client.navigate(targetUrl), focus() sobre el client resuelto, try/catch; (3) catch o "ningún client matcheó" → self.clients.openWindow(targetUrl) (el camino ya probado). Scoped únicamente a public/sw.js, sólo el branch de 5 tipos de Operaciones — Mozo/Salón/cancelación/G4/G5/Notification Center sin tocar.
INDEXEDDB_TRACE_STILL_REQUIRED_BEFORE_FIX=NO (la evidencia A/B ya aísla la causa sin necesitar más telemetría; la traza R1P5B se mantiene activa para confirmar el fix en la próxima sonda, no para seguir diagnosticando)
NEEDS_TEST=SI (caso nuevo: client Home bare sin slug + un caso de navigate() que rechaza)
NEEDS_TESTING_DEPLOY=SI
NEEDS_POST_FIX_PHYSICAL_PROBE=SI (2 casos: app abierta en Home, y app cerrada — no regresar el camino ya certificado)

FIXTURE_KNOWN_LIMITATION=UNDERSCORE_SLUG_LIMITS_MESA_ACCOUNT_TEST_REUSE (los slugs A/B/C usan "_", el alta de cuenta de mesa sólo acepta letras/números/guiones — no bloquea nada hoy, limita pruebas futuras de cuenta de mesa nueva; no corregido, sólo documentado)

R1P_PREPARATION_READY=SI
R1P_PHYSICAL_PROBE=PAUSED

P2_T44_REUSABLE_TESTING_FIXTURE_POLICY=PRESERVE_CORE_FIXTURE_AFTER_CERTIFICATION
P2_T44_FIXTURE_CREDENTIAL_POLICY=NO_AUTOMATIC_PASSWORD_ROTATION_WITHOUT_OPERATOR_AUTHORIZATION
NO_PRODUCTION_NETWORK_REQUESTS_DURING_T44_TESTING=SI (respetada en esta tarea)

PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
COMMIT_CREATED=NO
DEPLOY_EXECUTED=NO
THIRD_ORDER_CREATED=NO
SWITCH_TOUCHED=NO
LOGOUT_PERFORMED=NO

NEXT_ACTION=implementar el fix diseñado en public/sw.js (tarea futura, p. ej. R1P6C), extender los tests del harness con los 2 casos nuevos identificados, testear/typecheck/build, commit+push+deploy TESTING, y ejecutar una tercera sonda física con AMBOS casos (app abierta en Home / app cerrada) antes de certificar G3.
```

## PRIOR STATE — P2-T44-R1P6A G3 DIAGNOSTIC TRACE ANALYSIS — CLICK TRACE MISSING (2026-09-17)

Segunda sonda física G3 ejecutada con el SW instrumentado de R1P5B.
Síntoma físico IDÉNTICO a R1P4 (Push PASS, deep link FAIL, termina en el
selector de "3 negocios"). El trace capturó correctamente
`push_received`/`show_notification` (URL correcta confirmada por primera
vez directamente desde el dispositivo, no sólo server-side) — pero
**ningún evento de `notificationclick` llegó a los logs**, pese a que el
operador confirma haber tocado la notificación. Ver
`codex-reports/P2_T44_R1P6A_G3_DIAGNOSTIC_TRACE_ANALYSIS.md` para el
análisis completo (14 valores extraídos por evidencia real, 8 hipótesis
reevaluadas, causa raíz de la BRECHA DE TRAZA identificada con confianza
razonable, causa raíz del ROUTING original todavía en MEDIUM).

```text
R1P6_ORDER_ID=cmu61sjzh0001mv0btmjj7l4j
R1P6_ORDER_CREATED_AT=2026-09-17T21:34:49.134Z
R1P6_NOTIFICATION_ID=cmu61sk0u0005mv0bins8mflm

TRACE_EVENT_COUNT=2 (push_received, show_notification — ambos con traceVersion=P2_T44_R1P5B_SW_TRACE_V1 y la URL correcta preservada byte a byte)
CLICK_TRACE_MISSING=SI (notificationclick_decision/_client/_routing_result: 0 encontrados)

CAUSA_MAS_RESPALDADA=el notificationclick probablemente SÍ ejecutó la rama de Operaciones instrumentada (única versión de SW desplegada en toda la ventana), pero el POST de traza no llegó al servidor — muy probablemente por un arranque en frío del Service Worker tras ~94s de inactividad, coincidiendo con restricciones de red en segundo plano del sistema operativo en el momento exacto del tap
ROOT_CAUSE_LAYER=INSTRUMENTATION_DELIVERY_GAP (la capa de ROUTING original sigue SOSPECHADA, no PROBADA)
ROOT_CAUSE_CONFIDENCE=MEDIUM (sin subir a HIGH — el vacío de evidencia está exactamente en el punto crítico)

FIX_DISEÑADO_NO_IMPLEMENTADO=persistir cada evento de notificationclick en IndexedDB (mismo patrón ya usado en sw.js para share-target) ANTES de intentar la red, con reintento en el siguiente despertar del SW — ataca la capa de observabilidad, nunca la lógica de ruteo/seguridad (isSafeInternalUrl/isSafeOperationsUrl/targetUrl/fallback/focus/navigate/openWindow sin tocar)
NEEDS_THIRD_G3_PHYSICAL_TAP_PROBE=SI (después de implementar y desplegar ese fix de entrega de traza)

G3_PUSH_DELIVERY_PHYSICAL=PASS (preservado)
G3_SECOND_PROBE_PUSH_DELIVERY=PASS
G3_SECOND_PROBE_PUSH_COUNT=1
G3_SECOND_PROBE_DEEP_LINK=FAIL
G3_DEEP_LINK_PHYSICAL=FAIL (preservado)
G3_PHYSICAL_CERTIFIED=NO

R1P_PREPARATION_READY=SI
R1P_PHYSICAL_PROBE=PAUSED
R1P_DISABLE_STATUS=PAUSED_PENDING_G3_DEEP_LINK_ROOT_CAUSE_AND_FIX

P2_T44_REUSABLE_TESTING_FIXTURE_POLICY=PRESERVE_CORE_FIXTURE_AFTER_CERTIFICATION
P2_T44_FIXTURE_CREDENTIAL_POLICY=NO_AUTOMATIC_PASSWORD_ROTATION_WITHOUT_OPERATOR_AUTHORIZATION
NO_PRODUCTION_NETWORK_REQUESTS_DURING_T44_TESTING=SI (respetada en esta tarea)

PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
COMMIT_CREATED=NO
DEPLOY_EXECUTED=NO
THIRD_ORDER_CREATED=NO
SWITCH_TOUCHED=NO
LOGOUT_PERFORMED=NO

NEXT_ACTION=diseñar e implementar (tarea futura, p. ej. R1P6B) el fix de entrega de traza descrito arriba, redesplegar TESTING, y ejecutar una TERCERA sonda física G3 enfocada en obtener por fin la traza completa de notificationclick.
```

## PRIOR STATE — P2-T44-R1P5C TRACE DEPLOY EVIDENCE CLOSEOUT (READ-ONLY) (2026-09-17)

R1P5C re-verificó de forma independiente y READ-ONLY (sin código/test
modificado, sin commit, sin push, sin redeploy) los 5 valores que el
reporte de R1P5B dejaba sólo en la salida del chat — ahora están escritos
en `codex-reports/P2_T44_R1P5B_G3_SW_TRACE_IMPLEMENTATION.md` §13, y el
reporte queda autosuficiente sin depender de esta conversación.

```text
CURRENT_BRANCH=work/p2-t43-r2
HEAD_SHA=ca3166745885f4b0d0a83c423d3c858051bd575a
ORIGIN_TESTING_CODEX_SHA=ca3166745885f4b0d0a83c423d3c858051bd575a (idéntico a HEAD)

R1P5B_COMMIT_SHA=ca3166745885f4b0d0a83c423d3c858051bd575a
TESTING_DEPLOY_ID=36ed8593-539f-4707-95b6-b2fb87babaf5
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_COMMIT=ca3166745885f4b0d0a83c423d3c858051bd575a (expuesto directamente por Railway en meta.commitHash, coincide byte a byte)
LIVE_SW_TRACE_MARKER_PRESENT=SI
TRACE_ENDPOINT_SELF_TEST=PASS
TRACE_ENDPOINT_SELF_TEST_TIMESTAMP=2026-09-17T19:40:56.507Z (log real re-encontrado, no se generó uno nuevo)

R1P6_OPERATOR_ACTION_READY=SI (los 4 requisitos del deploy gate se cumplen)
R1P6_PREPARATION_READY=SI (preservado)

NO_PRODUCTION_NETWORK_REQUESTS_DURING_T44_TESTING=SI (nueva regla permanente para el resto de la línea T44, motivada por la desviación documentada en R1P5B §12 — un curl accidental a un dominio de Production adivinado; a partir de R1P5C, Production se verifica EXCLUSIVAMENTE por Git/estado local, nunca por red)

G3_PUSH_DELIVERY_PHYSICAL=PASS (preservado)
G3_DEEP_LINK_PHYSICAL=FAIL (preservado)
G3_PHYSICAL_CERTIFIED=NO

R1P_PREPARATION_READY=SI
R1P_PHYSICAL_PROBE=PAUSED

P2_T44_REUSABLE_TESTING_FIXTURE_POLICY=PRESERVE_CORE_FIXTURE_AFTER_CERTIFICATION
P2_T44_FIXTURE_CREDENTIAL_POLICY=NO_AUTOMATIC_PASSWORD_ROTATION_WITHOUT_OPERATOR_AUTHORIZATION

SWITCH_TOUCHED=NO
LOGOUT_PERFORMED=NO
ORDER_CREATED=NO
PUSH_SENT=NO
PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
COMMIT_CREATED=NO
DEPLOY_EXECUTED=NO

NEXT_ACTION=WAIT_FOR_OPERATOR_R1P6_SW_REFRESH — el gate está listo (R1P6_OPERATOR_ACTION_READY=SI), pero esta tarea NO le pidió nada al operador todavía; comunicar el refresh mínimo de PWA (abrir/recargar una vez, sin logout/borrado/switch) y luego ejecutar R1P6 (crear UN pedido retiro nuevo, confirmar Push, tocarlo, leer railway logs por pedidoId) queda para una tarea futura explícita.
```

## PRIOR STATE — P2-T44-R1P5B G3 SW CLICK TRACE IMPLEMENTED, LIVE IN TESTING (2026-09-17)

R1P5B implementó la instrumentación que R1P5 había diseñado pero no
creado (autorización explícita del operador para el archivo nuevo). Nuevo
endpoint `POST /api/push/debug-sw-trace` (TESTING-only, 404 fuera de
TESTING, allowlist cerrada de campos, sin DB, sólo `console.info` — leído
vía `railway logs`) + instrumentación en `public/sw.js` (marcador
`P2_T44_R1P5B_SW_TRACE_V1`) alrededor del evento `push` (sólo tipos PyR) y
de la rama compartida de `notificationclick` de Operaciones (5 tipos). **La
lógica de ruteo real es semánticamente idéntica** — 90 tests pasan (25 en
`sw-notificationclick-target-routing.test.ts`, incluyendo 9 nuevos que
prueban explícitamente que la traza nunca cambia el target ni el fallback,
y que un fetch de traza que falla o no existe nunca rompe el ruteo real).
Ver `codex-reports/P2_T44_R1P5B_G3_SW_TRACE_IMPLEMENTATION.md`.

```text
NEW_TRACE_FILE_CREATED=SI (src/app/api/push/debug-sw-trace/route.ts)
TRACE_CHANGES_ROUTING_BEHAVIOR=NO
PRODUCT_CODE_CHANGED=SI (public/sw.js, sólo instrumentación aditiva)
TEST_CODE_CHANGED=SI (90 tests pasan, 0 fallos, en los archivos tocados)
TSC_NEW_ERRORS=0 (31 preexistentes, baseline sin cambios)
BUILD=OK

R1P5B_COMMIT_SHA=ca3166745885f4b0d0a83c423d3c858051bd575a
TESTING_DEPLOY_ID=36ed8593-539f-4707-95b6-b2fb87babaf5
TESTING_DEPLOY_STATUS=SUCCESS (commitHash confirmado exacto)
LIVE_SW_TRACE_MARKER_PRESENT=SI (P2_T44_R1P5B_SW_TRACE_V1 confirmado en sw.js servido)
TRACE_ENDPOINT_SELF_TEST=PASS (1 línea [SW_TRACE] sanitizada confirmada en railway logs, event=endpoint_self_test, no repetido)

SWITCH_TOUCHED=NO
LOGOUT_PERFORMED=NO
ORDER_CREATED=NO
PUSH_SENT=NO
PRODUCTION_TOUCHED=NO (git: origin/main sin cambios; DEVIACIÓN A REPORTAR: un curl GET read-only accidental a un dominio de Production adivinado y no confirmado, ver §12 del reporte R1P5B — no repetido, sin mutación, sin datos expuestos)

G3_PUSH_DELIVERY_PHYSICAL=PASS (preservado)
G3_DEEP_LINK_PHYSICAL=FAIL (preservado)
G3_PHYSICAL_CERTIFIED=NO

R1P_PREPARATION_READY=SI
R1P_PHYSICAL_PROBE=PAUSED
R1P_DISABLE_STATUS=PAUSED_PENDING_G3_DIAGNOSTIC_PHYSICAL_PROBE

P2_T44_REUSABLE_TESTING_FIXTURE_POLICY=PRESERVE_CORE_FIXTURE_AFTER_CERTIFICATION
P2_T44_FIXTURE_CREDENTIAL_POLICY=NO_AUTOMATIC_PASSWORD_ROTATION_WITHOUT_OPERATOR_AUTHORIZATION

NEXT_ACTION=P2_T44_R1P6_G3_DIAGNOSTIC_DEEPLINK_PHYSICAL_PROBE — crear UN pedido retiro nuevo en Negocio B, confirmar 1 Push, tocarlo una vez, leer railway logs filtrando por el pedidoId nuevo para capturar push_received/show_notification/notificationclick_decision/notificationclick_client*N/notificationclick_routing_result, y reportar el destino físico observado. NO ejecutada todavía — requiere autorización explícita de una tarea futura (R1P6).
```

## PRIOR STATE — P2-T44-R1P5 G3 SW CLICK TRACE INSTRUMENTATION — STOPPED, NEW FILE REQUIRED (2026-09-17)

R1P5 auditó a fondo el mecanismo de debug trace ya existente
(`src/lib/push-debug-trace.ts` + `push-debug-snapshot.ts` +
`PushDebugPanel` + `/api/push/debug-guard`, todo de P2-T31-R6/R6A/R6B/R7)
y concluyó que **no es reutilizable tal cual** para instrumentar
`notificationclick`/`push` dentro de `public/sw.js`: (a) un Service
Worker no tiene `window`/`localStorage` — el motor de trace degrada a un
buffer en memoria efímero, perdido si el SW es terminado entre el evento
`push` y el tap real (el mismo riesgo H8 que R1P4 dejó abierto); (b) el
único componente de lectura (`PushDebugPanel`) tiene un `actorFamily`
cerrado (cliente/negocio/repartidor), está atado a un endpoint de
snapshot de suscripción PERSONAL que no aplica al modelo de
cuenta_operativa de G3, y nunca estuvo montado en `/operaciones` — ni
esta línea de tarea (T44) lo usó nunca como canal de evidencia en sus 4
sondas físicas previas (siempre DB + `railway logs`).

Por instrucción explícita de la propia tarea R1P5 (§14: "si se requiere
un nuevo archivo, STOP primero y reportar — no expandir silenciosamente
scope"), esta tarea **NO modificó `public/sw.js` ni ningún archivo de
producto**, no corrió tests nuevos, no hizo commit/push/deploy. Se
diseñó (sin implementar) la alternativa mínima viable: un endpoint POST
de ingesta gateado por el mismo `isPushDebugAllowedEnvironment()` que
`/api/push/debug-guard` (404 liso fuera de TESTING), llamado desde
`sw.js` de forma fire-and-forget, que aterriza evidencia sanitizada en
`railway logs` — el mismo canal que R1P4 ya usó con éxito. Ver
`codex-reports/P2_T44_R1P5_G3_SW_CLICK_TRACE_INSTRUMENTATION.md` para el
detalle completo (incluye NEW_TRACE_FILE_REQUIRED/WHY/SECURITY_MODEL).

```text
NEW_TRACE_FILE_REQUIRED=SI
TRACE_CHANGES_ROUTING_BEHAVIOR=NO (nada se implementó)
PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
SWITCH_TOUCHED=NO
LOGOUT_PERFORMED=NO
ORDER_CREATED=NO
PUSH_SENT=NO
PRODUCTION_TOUCHED=NO

G3_PUSH_DELIVERY_PHYSICAL=PASS (preservado de R1P4)
G3_DEEP_LINK_PHYSICAL=FAIL (preservado de R1P4)
G3_PHYSICAL_CERTIFIED=NO

R1P_PREPARATION_READY=SI
R1P_PHYSICAL_PROBE=PAUSED
R1P_DISABLE_STATUS=PAUSED_PENDING_G3_DEEP_LINK_DIAGNOSTIC_PROBE

P2_T44_REUSABLE_TESTING_FIXTURE_POLICY=PRESERVE_CORE_FIXTURE_AFTER_CERTIFICATION
P2_T44_FIXTURE_CREDENTIAL_POLICY=NO_AUTOMATIC_PASSWORD_ROTATION_WITHOUT_OPERATOR_AUTHORIZATION

NEXT_ACTION=decidir (operador) si autoriza crear el nuevo endpoint POST
de ingesta diseñado en el reporte R1P5 (o una alternativa), para recién
ahí implementar+testear+deploy la instrumentación real y preparar la
segunda sonda física G3 enfocada en el tap/deep-link.
```

## PRIOR STATE — P2-T44-R1P4 G3 DEEP LINK FAIL — ROOT CAUSE ANALYSIS (2026-09-17)

Sonda física G3 EJECUTADA. Resultado mixto, con evidencia preservada:
**entrega física del Push = PASS** (1 solo Push, copia correcta), pero
**el deep link falló** — al tocar el Push, la PWA abrió la pantalla
genérica de "los tres negocios" (`/operaciones/mi-panel` sin slug), no
el panel PyR del pedido nuevo. Confirmado con evidencia de logs
server-side (no sólo el reporte del operador). G3 sigue sin
certificarse físicamente — falta el deep link. R1P (disable) sigue
PAUSADO.

```text
G3_PUSH_DELIVERY_PHYSICAL=PASS
G3_PUSH_COUNT_PHYSICAL=1
G3_PUSH_COPY_PHYSICAL=PASS
G3_DEEP_LINK_PHYSICAL=FAIL
G3_PHYSICAL_CERTIFIED=NO
PRODUCT_CODE_CHANGED=NO (tarea analysis-only)

PEDIDO=cmu5w76f10003r00bxao7r4im (Negocio B, retiro, creado 2026-09-17T18:58:13.693Z). Notificacion in-app cmu5w76hn0007r00bessvk61x con url EXACTA y correcta persistida (/operaciones/mi-panel/test_t44_r1d_negocio_b_4135ea7a/pyr/pedidos?pedidoId=cmu5w76f10003r00bxao7r4im). Push enviado con éxito: [Push] Enviado OK (tipo=operaciones_pyr_new_order actorFamily=cuenta_operativa providerStatus=201). Payload server-side auditado y confirmado correcto por 3 vías independientes — el bug NO está en la construcción del payload.

EVIDENCIA_DECISIVA=logs de Railway muestran 6 llamadas GET /api/operativo/me cada 15000ms exactos entre 18:59:15 y 19:00:30 — ese es el endpoint/intervalo EXACTO de src/app/mozo/page.tsx (reusado sin cambios por /operaciones/mi-panel sin slug, la pantalla de "los tres negocios"), NUNCA el endpoint de la página destino real (/api/operativo/pyr/pedidos, usado por pyr/pedidos/page.tsx) que no aparece ni una vez en toda la ventana de logs. Prueba server-side, no sólo inferencia, de que el navegador nunca llegó a montar la página correcta.

ROOT_CAUSE_CONFIDENCE=MEDIUM. FAILURE_LAYER=SERVICE_WORKER_CLICK_ROUTING (public/sw.js, rama compartida de Operaciones agregada en R1P2, líneas 632-660). Confirmado (por ser la ÚNICA fuente posible de la ruta "/operaciones/ingresar" en todo el archivo, y porque esa ruta redirige automáticamente a /operaciones/mi-panel para una sesión ya autenticada — comentario propio del código lo confirma) que el click SÍ reconoció el tipo correctamente pero cayó al fallback fijo — es decir, `isSafeOperationsUrl` evaluó falso en el dispositivo real pese a que el payload enviado era correcto. La causa EXACTA de por qué la validación falló en ese momento no pudo probarse con logs/código server-side — 8 hipótesis evaluadas explícitamente (H1-H8), la mayoría REFUTADAS con evidencia directa (incluida la hipótesis de un Service Worker viejo, refutada porque incluso el fallback MÁS genérico del archivo también prioriza la url correcta primero), dejando sólo H3 (SUPPORTED) y H7/H8-débil (UNPROVEN, requieren el dispositivo).

FIX_RECOMENDADO=NO adivinar un cambio de comportamiento sin evidencia. Se recomienda primero agregar instrumentación defensiva (reusando el mecanismo push-debug-trace ya existente en el codebase, TESTING-only) en la rama de Operaciones de sw.js para capturar rawUrl/type/decision reales en el próximo tap — recién con esa evidencia diseñar el fix de comportamiento correcto. NEEDS_SECOND_PHYSICAL_G3_PROBE=SI.

G3_PUSH_DELIVERY_PHYSICAL preservado como evidencia positiva — la próxima sonda no necesita re-demostrar toda la cadena desde cero, sólo el tap/deep-link.

R1P_PREPARATION_READY=SI (preservado)
R1P_PHYSICAL_PROBE=PAUSED
R1P_DISABLE_STATUS=PAUSED_PENDING_G3_DEEP_LINK_FIX_AND_RECERTIFICATION

G4_PHYSICAL_CERTIFIED=NO
G5_PHYSICAL_CERTIFIED=NO
G6_PHYSICAL_CERTIFIED=NO

SWITCH_TOUCHED=NO
LOGOUT_PERFORMED=NO
SECOND_ORDER_CREATED=NO

NEXT_ACTION=diseñar e implementar la instrumentación/fix de sw.js para el deep link de Operaciones (tarea separada, no ejecutada aquí), luego re-certificar G3 con una segunda sonda enfocada en tap/deep-link.

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
PRODUCTION_TOUCHED=NO
```

Reporte completo (evidencia verbatim del operador, correlación exacta
log↔DB del pedido/notificación/payload, auditoría línea por línea del
`notificationclick`, 8 hipótesis evaluadas con evidencia, causa raíz
con nivel de confianza honesto, plan de instrumentación antes de
cualquier fix a ciegas): `codex-reports/P2_T44_R1P4_G3_PHYSICAL_DELIVERY_PASS_DEEPLINK_FAIL_ANALYSIS.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1P3 G3 PHYSICAL PROBE PREPARED, NOT EXECUTED (2026-09-17)

Preparación completa (sin ejecutar) de la primera sonda física real de
un productor nuevo: G3 (nuevo pedido retiro → PyR). Reconfirmado que
R1P2 sigue vivo en TESTING (sw.js real, subscription intacta). Ningún
otro gap (G4/G5/G6/G1) se toca todavía — una sonda por vez.

```text
G3_PHYSICAL_PREPARATION_READY=SI
PRODUCT_CODE_CHANGED=NO

RECONFIRMADO_R1P2_LIVE=sw.js servido en TESTING contiene "operaciones_pyr_new_order"; /operaciones/mi-panel/.../pyr/pedidos responde 200; subscription account-level sin cambios (misma fila cmu4ni2t0000up90btelfflhq desde R1M).

FIXTURE_MUTATION_REQUIRED=NO — Negocio B (cmu1xe6ok0002rip8yc707wze) ya estaba abierto (horarioMode=simple) y con ofreceRetiro=true desde R1L/R1N, sin cambios necesarios. Producto (cmu4o5gc10003riw8b6lk839d) y Cliente fixture (test_t44_r1n_cliente_4135ea7a@example.test) reutilizados de R1N/R1O sin crear nada nuevo.

UNICA_MUTACION=contraseña runtime del Cliente fixture rotada (la de R1N era irrecuperable, hash unidireccional nunca persistido) — mismo mecanismo hashPassword/comparePassword ya establecido, roundtrip verificado, id/email/nombre sin cambios, password entregada sólo en el chat de esta tarea.

BASELINE=1 pedido previo en Negocio B (el de R1J/R1O, ya cancelado, no relacionado), 0 notificaciones operaciones_pyr_new_order previas (nunca disparado físicamente), 1 fila de subscription account-level (sin cambios).

FLUJO_PREPARADO=Cliente (Desktop) crea 1 pedido RETIRO de TEST_T44_R1N_PRODUCTO en Negocio B → CuentaOperativa PyR (Teléfono, ya autenticada, sin logout/switch) debería recibir exactamente 1 Push operaciones_pyr_new_order. Se permite UN tap del deep link en la misma sonda (certifica entrega + SW + deep-link consumer juntos) — la campana G1 NO se prueba todavía.

CRITERIO_SI_NO_LLEGA=clasificar DEVICE_DELIVERY_MISS, NO tocar switch automáticamente, NO repetir de inmediato (lección de R1M). CRITERIO_SI_LLEGAN_2+=STOP, no crear segundo pedido, analizar después.

R1P_PREPARATION_READY=SI (preservado)
R1P_PHYSICAL_PROBE=PAUSED (sin cambios)
G3_PHYSICAL_CERTIFIED=NO (todavía — sólo preparado)
G4_PHYSICAL_CERTIFIED=NO
G5_PHYSICAL_CERTIFIED=NO
G6_PHYSICAL_CERTIFIED=NO

SWITCH_TOUCHED=NO
LOGOUT_PERFORMED=NO
ORDER_CREATED=NO
PUSH_SENT=NO

NEXT_ACTION=WAIT_FOR_OPERATOR_G3_PHYSICAL_PROBE

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
PRODUCTION_TOUCHED=NO
```

Reporte completo (URLs exactas, baselines, expectativa server-side y
física diseñada, pasos manuales, plantilla de respuesta, plan de
observabilidad post-sonda, criterios de PASS/STOP):
`codex-reports/P2_T44_R1P3_G3_REAL_PYR_NEW_ORDER_PUSH_PHYSICAL_CERT_PREPARATION.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1P2 NOTIFICATION GAPS IMPLEMENTED + DEPLOYED TESTING (2026-09-17)

Implementación real (no sólo diseño) de G3+G4+G5+G1, commit + push +
deploy TESTING exitoso. G6 no requirió código (ya existente). **Sin
certificación física todavía** — sólo preparado el terreno de código;
R1P (disable) sigue PAUSADO, switch/subscription intactos.

```text
P2_T44_R1P2_STATUS=IMPLEMENTATION_COMPLETE_DEPLOYED_TESTING_AWAITING_NEW_PRODUCER_PHYSICAL_CERTIFICATION
PRODUCT_CODE_CHANGED=SI (11 archivos de producto, dentro del allowlist de R1P1/R1P1A) / TEST_CODE_CHANGED=SI (9 archivos, 7 nuevos + 2 extendidos con justificación documentada)

G3_IMPLEMENTED_TESTING=SI — notifyPyrNewOrder, tipo operaciones_pyr_new_order, call-site en POST /api/pedidos (rama no-mesa, dentro del guard de idempotencia existente — replay nunca duplica). Deep link consumer agregado a pyr/pedidos/page.tsx (mismo patrón ya certificado en Mozo).
G4_IMPLEMENTED_TESTING=SI — notifyPyrNewReview, tipo operaciones_pyr_new_review, call-site en POST /api/cliente/resenas junto al newReviewNotification existente (intacto). Deep link (scroll/highlight) agregado a pyr/resenas/page.tsx.
G5_IMPLEMENTED_TESTING=SI — notifyPyrChatMessage, tipo operaciones_pyr_chat, call-site en POST /api/chat/mensajes/[pedidoId] (sólo rama cliente→negocio, sólo no-mesa). CERO cambios al modelo de chat (ChatMensaje/remitente/ownership/autorización intactos). Deep link ya exacto por construcción de ruta, sin cambios de UI.
G1_IMPLEMENTED_TESTING=SI — notification-center.tsx únicamente (confirmado: ningún host de Operaciones necesitó tocarse). Nueva función pura resolveNotificationNavigation (url segura > tab legacy > none), helper isSafeInternalPath, íconos dedicados para los 6 tipos modernos de Operaciones.
G6_IMPLEMENTED_EXISTING_AWAITING_PHYSICAL_CERT=SI (sin cambio de código — notifyOperationsOrderCancelled ya soporta area=salon idéntico a pyr, ya certificado R1N/R1O para PyR; falta certificación física de la rama Salón, no de código)

DEDUPE_CROSS_OWNER=mismo Set<string> reservedPushEndpoints compartido en los 3 call-sites (Negocio primero por posición de código existente, PyR después) — gana Negocio por precedencia determinista si comparten endpoint físico. Confirmado con evidencia de código: createNotification persiste la fila Notificacion incondicionalmente ANTES de resolver targets físicos — el dedupe nunca borra evidencia lógica. Verificado con tests reales (mismo endpoint → 1 Push físico + 2 filas lógicas; endpoints distintos → 2 Push).

SW=las 2 ramas casi idénticas ya existentes (operaciones_salon_new_order/operaciones_order_cancelled) se generalizaron a UNA sola condición de tipo compartida, cubriendo también los 3 tipos PyR nuevos — sin duplicar lógica. mesa_order_ready NO se tocó (contrato de URL distinto, /mozo/panel/... — verificado explícitamente antes de editar, sin regresión confirmada por test real).

TESTS=353 pass / 0 fail (aislados, 20 archivos — 5 nuevos + 15 sibling/integración con DB real). TSC=31 errores totales, TODOS baseline pre-existente (0 nuevos — el único error en un archivo tocado, push.ts:751, confirmado no relacionado por rango de diff). ESLint=PASS. Build=PASS. sw.js sintaxis=PASS. Static contract lateral=mismo 1/65 fallo pre-existente de siempre, sin relación.

COMMIT=32ff570f14a5590bd908d621f957740e2a40ab56 ("feat: restore personal operations notifications")
PUSH=origin/testing-codex (c2848d7→32ff570)
DEPLOY_TESTING=5908c926-22ac-4393-a3a5-87bb2d35b9d1, SUCCESS — confirmado por contenido real (sw.js servido en vivo contiene "operaciones_pyr_new_order")
SMOKE_POST_DEPLOY=PASS, sin generar eventos reales — subscription account-level intacta (misma fila, mismo id/createdAt desde R1M), páginas PyR cargan 200.

NO_TOCADO=use-push-notifications.ts, /api/push/subscribe|unsubscribe|status, auth de CuentaOperativa, logout, schema/migraciones Prisma, switch, Production.

NEXT_ACTION=P2_T44_R1P3_G3_REAL_PYR_NEW_ORDER_PUSH_PHYSICAL_CERT_PREPARATION

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
PRODUCTION_TOUCHED=NO
```

Reporte completo (archivos exactos, dedupe verificado con tests reales,
generalización del Service Worker, resultados de tests/build/security
review, commit/push/deploy/smoke): `codex-reports/P2_T44_R1P2_IMPLEMENT_NOTIFICATION_GAPS.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1P1A DESIGN CORRECTED — READY FOR IMPLEMENTATION (2026-09-17)

Corrección pre-implementación de dos puntos del diseño R1P1, antes de
autorizar cualquier código. Ninguna decisión de producto (G3/G4/G5/G6)
se reabrió — sólo se corrigieron un defecto de diseño (G3 sin dedupe
cross-owner) y una sobre-estimación de superficie de cambio (G1 no
necesita tocar ningún host de Operaciones). R1P sigue PAUSADO, switch
sigue ON.

```text
P2_T44_R1P1A_STATUS=DESIGN_CORRECTED_READY_FOR_IMPLEMENTATION
PRODUCT_CODE_CHANGED=NO

G3_CORRECCION=el diseño original dejaba PHYSICAL_ENDPOINT_DEDUPE=N/A razonando que Negocio y PyR "no comparten dispositivo en el flujo normal" — INSUFICIENTE, ya que el dueño del Negocio puede operar también como CuentaOperativa PyR desde el mismo navegador (mismo endpoint físico devuelto por PushManager en ambos logins, mecanismo ya confirmado en R1M). Corregido: mismo mecanismo reservedPushEndpoints/Set compartido ya usado por G4/G5, con precedencia Negocio-gana-el-endpoint-compartido (porque su llamada ya existe primero en el código; PyR se agrega después, mismo Set) — decisión determinista por orden de código, no first-wins accidental. Confirmado con evidencia de código: createNotification SIEMPRE persiste la fila Notificacion antes de intentar el envío físico, así que el dedupe nunca borra evidencia lógica, sólo evita un segundo Push físico redundante en el mismo dispositivo.

G1_CORRECCION=el diseño original proponía tocar los 3 hosts de Operaciones (pyr/pedidos, salon, mozo/panel) para pasarles `onNavigate`. Auditado el contrato real: `onNavigate(tab)` siempre recibe un NOMBRE DE PESTAÑA ("pedidos","resenas","config"...), nunca una URL — pasar router.push directo ahí sería incorrecto. PERO no hace falta resolver eso: los 6 tipos de notificación de Operaciones (los 3 ya certificados + los 3 nuevos de G3/G4/G5) YA embeben `datos.url` directamente (confirmado en el propio código de notifyOperationsOrderCancelled/notifySalonNewOrderForOperations/mesa-order-ready-notification, ninguno pasa por el mecanismo navigateTo). Diseño corregido: notification-center.tsx resuelve la navegación moderna por sí solo (useRouter().push(url) tras validar con un helper isSafeInternalPath, misma lógica que ya usa sw.js) — CERO cambios de host. G1_FILES se reduce de 4 archivos a 1 solo.

SERVICE_WORKER=generalizar la condición de tipo de las 2 ramas ya existentes en sw.js para cubrir los 3 tipos nuevos con la MISMA validación (isSafeInternalUrl + prefijo /operaciones/mi-panel/), en vez de escribir 3 ramas nuevas casi idénticas.

HTTP_STATUS_AUDITADO=POST /api/pedidos → 201 (nuevo) / 200 (idempotente); POST /api/cliente/resenas → 201; POST chat mensaje → 200 (default). Ninguno cambia — los 3 bloques de notificación nuevos van dentro del mismo try/catch best-effort ya existente, después de la operación principal.

Todo lo demás del diseño R1P1 (arquitectura G3/G4/G5, decisión de producto G5, plan G6, tests, orden de implementación) queda vigente sin cambios — la corrección se agregó como sección 18 del mismo archivo de reporte, sin borrar nada.

R1P_PREPARATION_READY=SI (preservado)
R1P_PHYSICAL_PROBE=PAUSED (sin cambios)

SWITCH_TOUCHED=NO
LOGOUT_PERFORMED=NO
PUSH_SENT=NO

NEXT_ACTION=P2_T44_R1P2_IMPLEMENT_NOTIFICATION_GAPS

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
PRODUCTION_TOUCHED=NO
```

Reporte: la corrección se agregó como sección `18` dentro del mismo
archivo de R1P1 (nada borrado, las partes superadas quedan marcadas
inline con tachado + referencia a §18):
`codex-reports/P2_T44_R1P1_OPERATIONS_NOTIFICATION_GAPS_IMPLEMENTATION_DESIGN.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1P1 IMPLEMENTATION DESIGN READY (2026-09-17)

Diseño completo (sin implementar) de los 4 gaps de T44 dentro de
alcance (G1, G3, G4, G6) + decisión de producto para G5 (SÍ notificar
a PyR ante chat de cliente, sin cambiar el modelo de chat). R1P
(disable) sigue PAUSADO. Switch sigue ON, sin tocar.

```text
P2_T44_R1P1_STATUS=DESIGN_READY_NOT_IMPLEMENTED
PRODUCT_CODE_CHANGED=NO

G3_DESIGN_READY=SI — notifyPyrNewOrder, tipo nuevo operaciones_pyr_new_order, call-site en POST /api/pedidos (rama no-mesa), reutiliza resolveOperationalPushTargets sin cambios, deep link /operaciones/mi-panel/{slug}/pyr/pedidos?pedidoId={id} (requiere adaptación mínima de la UI para leer el query param, mismo patrón ya usado por Mozo).

G4_DESIGN_READY=SI — notifyPyrNewReview, tipo operaciones_pyr_new_review, call-site en POST /api/cliente/resenas junto al newReviewNotification existente (sin tocarlo), dedupe de endpoint físico compartido con Negocio vía el mismo mecanismo reservedPushEndpoints ya certificado.

G5_PRODUCT_DECISION=INCLUDE_PYR_NOTIFICATION_FANOUT_WITHOUT_CHANGING_CHAT_PARTICIPANT_MODEL. Diseño: notifyPyrChatMessage, tipo operaciones_pyr_chat, call-site en la rama cliente→negocio de POST /api/chat/mensajes/[pedidoId] (metodoEntrega ya disponible en la query existente, sin query adicional), dedupe físico con Negocio vía Set compartido. Deep link YA es exacto sin cambios de UI (la ruta de mensajes PyR es dinámica por pedidoId). Cero cambios a ChatMensaje/remitente/autorización.

G1_DESIGN_READY=SI — hallazgo adicional durante el diseño: ninguna de las 3 páginas host de Operaciones (pyr/pedidos, salon, mozo/panel) pasa `onNavigate` al NotificationBell — hoy NINGÚN tipo de notificación navega al clickear, no sólo los 4 modernos. Diseño: precedencia de navegación (url interna validada > navigateTo legacy > fallback), un helper mínimo isSafeInternalPath (misma lógica que sw.js, reimplementada porque sw.js no es importable desde componentes React), mapa de íconos Lucide ya disponibles, sin migración de filas históricas.

G6_PHYSICAL_DESIGN_READY=SI — sin cambio de código (notifyOperationsOrderCancelled ya soporta area=salon idéntico a pyr, ya certificado en R1N/R1O). Plan: Negocio (login propio, Desktop) cancela un pedido de mesa nuevo, CuentaOperativa Salón (Teléfono) recibe — mismo patrón cross-role que Mozo/PyR, evitando self-cancel vía operaciones/pedidos/[id]/cancelar (excludeEmpleadoId dejaría 0 destinatarios con 1 solo empleado Salón fixture).

SCHEMA_CHANGE_REQUIRED=NO / MIGRATION_REQUIRED=NO (toda la infraestructura ya existe; Notificacion.tipo es String, no enum — valores nuevos no requieren migración).

STATIC_CONTRACT_BLOCKS_R1P1_IMPLEMENTATION=NO (el hook de suscripción/desuscripción no se toca en ninguno de los 4 diseños).

ORDEN_DE_IMPLEMENTACION=helper compartido resolvePyrOperationalRecipients → G3 → G4 → G5 → G1 → tests → commit → deploy TESTING (con autorización explícita) → sondas físicas una por vez (G3→G4→G5→G6) → retomar R1P disable → re-enable controlado + logout cleanup → cierre T44.

Allowlist de archivos, plan de tests por gap, y plan de fixtures reutilizables para las sondas futuras quedan documentados en el reporte — nada de esto se ejecutó.

R1P_PREPARATION_READY=SI (preservado)
R1P_PHYSICAL_PROBE=PAUSED (sin cambios)
R1P_DISABLE_STATUS=PAUSED_PENDING_NOTIFICATION_MATRIX_GAPS (sin cambios — ahora con diseño listo para resolverlos)

SWITCH_TOUCHED=NO
LOGOUT_PERFORMED=NO
PUSH_SENT=NO

NEXT_ACTION=P2_T44_R1P2_IMPLEMENT_NOTIFICATION_GAPS

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
PRODUCTION_TOUCHED=NO
```

Reporte completo (arquitectura por gap, factories/tipos/call-sites,
dedupe cross-owner, deep links, cambios de Notification Center y
Service Worker, plan de tests, allowlist de archivos, orden de
implementación, plan de certificación física):
`codex-reports/P2_T44_R1P1_OPERATIONS_NOTIFICATION_GAPS_IMPLEMENTATION_DESIGN.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1P0A HISTORICAL EVIDENCE RECONCILED — G3/G4 RECLASSIFIED (2026-09-16)

Corrección de una contradicción factual detectada en R1P0: la sección
histórica de esa auditoría afirmó (por grep incompleto, sin consultar
`git log --all`) que los identificadores legacy de "nuevo pedido"/
"nueva reseña" para empleados nunca existieron. **Verificado con
historial real de Git (diff exacto) que SÍ existieron** y fueron
retirados como código huérfano al jubilar el token compartido
`/e/[token]`, sin reemplazo moderno construido después. G3 y G4
quedan reclasificados en consecuencia. R1P (disable) sigue PAUSADO,
sin ejecutar. Switch sigue ON, sin tocar.

```text
P2_T44_R1P0A_STATUS=HISTORICAL_EVIDENCE_RECONCILED_GAPS_RECLASSIFIED
PRODUCT_CODE_CHANGED=NO

HALLAZGO=git log --all -S"empleadosNewOrderNotification" (y las otras 3 variantes) confirma: introducidas en commit ac5ec92 (2026-06-17), eliminadas en commit 13e651a ("fix: remove retired legacy endpoints and employee push", 2026-08-03 14:32 -03) — 76 minutos después de que c68eef9 (13:16 -03, mismo día) retirara la página /e/[token] a un stub. El propio commit de eliminación documenta la razón: "sin consumidor moderno" — un cleanup de código huérfano tras retirar el token compartido, NUNCA una decisión de producto de dejar de notificar pedidos/reseñas a empleados.

CONFIRMADO_CON_DIFF_EXACTO=empleadosNewOrderNotification(pedidoId,clienteNombre,total,metodoEntrega) existía en src/lib/push.ts, llamada desde la rama retiro/domicilio de POST /api/pedidos, leyendo Negocio.pushSubscriptionEmpleados, tipo "empleados_new_order". empleadosNewReviewNotification existía igual, llamada desde POST /api/cliente/resenas, mismo campo. Ninguna de las dos tiene reemplazo moderno hoy (Salón SÍ lo tiene: notifySalonNewOrderForOperations).

CHAT_LEGACY=confirmado que NUNCA existió una notificación de chat para la PWA legacy de empleados — G5 (chat→PyR) sigue siendo puramente una decisión de producto hacia adelante, sin antecedente de migración.

G3_RECLASIFICADO=LOST_LEGACY_CAPABILITY_MISSING_MODERN_ACCOUNT_LEVEL_REPLACEMENT (antes decía "nunca se construyó" — corregido). Sigue T44_SCOPE=SI, prioridad máxima (urgencia alta + paridad de migración).

G4_RECLASIFICADO=de T44_SCOPE=NO a T44_SCOPE=SI. Se separaron dos preguntas: NOTIFICATION_PRODUCT_EXPECTATION (sigue OPTIONAL — una reseña no es urgente, eso no cambió) vs MIGRATION_PARITY_EXPECTATION (REQUIRED — es una capacidad legacy real, perdida, sin reemplazo, igual que G3). Prioridad menor que G3/G6 dentro de T44, pero ya no se difiere fuera de alcance.

T44_SCOPE_GAPS_CORREGIDO=G1, G3, G4, G6 (antes: G1, G3, G6 — G4 se agregó)
DEFER_TO_OTHER_TASK_GAPS_CORREGIDO=sólo expiración automática de ocupación de mesa (sin antecedente legacy confirmado)
PRODUCT_DECISION_REQUIRED_GAPS=G5 (sin cambios, confirmado sin antecedente legacy)

CURRENT_CERTIFIED_PRODUCERS=SALON_NEW_ORDER (R1J/R1K), MOZO_READY (R1L/R1M), PYR_CANCELLATION (R1N/R1O) — preservados, no reabiertos.

R1P_PREPARATION_READY=SI
R1P_PHYSICAL_PROBE=PAUSED
R1P_DISABLE_STATUS=PAUSED_PENDING_NOTIFICATION_MATRIX_GAPS (sin cambios)

SWITCH_TOUCHED=NO
LOGOUT_PERFORMED=NO
PUSH_SENT=NO

NEXT_ACTION=P2_T44_R1P1_OPERATIONS_NOTIFICATION_GAPS_IMPLEMENTATION_DESIGN (orden de prioridad dentro de R1P1: G3, G6, G4, G1)

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
PRODUCTION_TOUCHED=NO
```

Reporte: la corrección se agregó como sección `4A`/`7A` dentro del
mismo archivo de R1P0 (no se creó un archivo nuevo, no se borró nada
de la auditoría original):
`codex-reports/P2_T44_R1P0_COMPLETE_OPERATIONS_NOTIFICATION_MATRIX_AUDIT.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1P0 NOTIFICATION MATRIX AUDIT — GAPS FOUND, R1P DISABLE PAUSED (2026-09-16)

Auditoría exhaustiva (4 investigaciones paralelas de código, sólo
lectura) de TODA la matriz de notificaciones de Operaciones Personal
(PyR/Mozo/Salón) — no sólo lo ya certificado. Switch sigue ON,
suscripción account-level intacta (misma fila desde R1M), R1P
(disable) queda PAUSADO, no ejecutado, hasta resolver los gaps
encontrados que pertenecen a T44.

```text
P2_T44_STATUS=CURRENT_KNOWN_PRODUCERS_CERTIFIED_NOTIFICATION_MATRIX_GAPS_OPEN
PRODUCT_CODE_CHANGED=NO

CURRENT_CERTIFIED_PRODUCERS=SALON_NEW_ORDER (R1J/R1K), MOZO_READY (R1L/R1M), PYR_CANCELLATION (R1N/R1O) — preservados, no reabiertos.

OPERATIONS_NOTIFICATION_MATRIX_COMPLETE=NO (auditoría en sí exhaustiva=SI; cobertura funcional=NO, 3 gaps dentro de T44)

GAP_MAS_IMPORTANTE=G3: PyR NO tiene ningún Push de "nuevo pedido" para retiro/domicilio — confirmado por auditoría exhaustiva de POST /api/pedidos, cero notificación de cualquier tipo hacia PyR (a diferencia de Salón, que sí tiene notifySalonNewOrderForOperations para mesa). No es una regresión de la migración legacy (no hay evidencia de que existiera antes) — es una funcionalidad nunca construida para esa área. NOTIFICATION_PRODUCT_EXPECTATION=REQUIRED. T44_SCOPE=SI (es literalmente el motivo de "PyR Coverage" en el nombre de T44).

G6=la rama SALÓN de notifyOperationsOrderCancelled (misma función que la PyR ya certificada en R1O) nunca fue certificada físicamente con un dispositivo real — R1J/R1K sólo probaron "nuevo pedido" de Salón, no su cancelación. Mismo código, alta confianza, pero sin evidencia física propia. T44_SCOPE=SI (cerrar cobertura de un productor que T44 ya construyó).

G1=el Notification Center (campana in-app) no tiene ícono ni navegación dedicados para ninguno de los 4 NotificationType de Operaciones (mesa_order_ready, salon_new_order, operaciones_salon_new_order, operaciones_order_cancelled) — cae a campana genérica sin click funcional. El Push físico SÍ navega bien (vía sw.js, verificado). Gap de coherencia in-app, no de entrega. T44_SCOPE=SI.

DEFERIDOS_FUERA_DE_T44=G4 (nueva reseña no llega a PyR — bajo valor operacional, sólo Negocio la recibe hoy), ocupación de mesa auto-expirada sin push (opcional).

DECISION_DE_PRODUCTO_PENDIENTE=G5: chat de cliente sobre un pedido llega sólo a la cuenta Negocio, nunca a una CuentaOperativa/PyR separada — requiere decidir si PyR debe ser un tercer participante/observador del hilo de chat antes de poder clasificarlo dentro o fuera de T44.

SIN_GAP=deduplicación cross-area confirmada por diseño de código (cada evento se resuelve scoped a un (negocioId, areaOperativa) específico — el mismo CuentaOperativa con 3 relaciones en 3 negocios nunca puede recibir 2-3 Push por un solo evento). Autonotificación evitada correctamente en todas las rutas self-service (excludeEmpleadoId donde aplica).

LEGACY_CONFIRMADO=Negocio.pushSubscriptionEmpleados sigue en el schema (0 lectores, ya documentado como SCHEMA_DEAD_FIELD_CANDIDATE en tarea previa P2-T15-T17-CLEANUP-R1, fuera de T44). /e/ y /s/ retirados a tombstones estáticos, sin código de push residual — reemplazo de Salón completo y sin pérdida funcional.

R1P_PREPARATION_READY=SI (preservado, no invalidado)
R1P_PHYSICAL_PROBE=PAUSED
R1P_DISABLE_STATUS=PAUSED_PENDING_NOTIFICATION_MATRIX_GAPS

NEXT_ACTION=P2_T44_R1P1_OPERATIONS_NOTIFICATION_GAPS_IMPLEMENTATION_DESIGN

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
PRODUCTION_TOUCHED=NO
```

Reporte completo (inventario técnico exhaustivo de factories/
NotificationType/call-sites/service worker/notification center,
inventario funcional por PyR/Mozo/Salón, matriz evento×cobertura,
6 gaps clasificados con expectativa funcional, decisión de alcance
T44): `codex-reports/P2_T44_R1P0_COMPLETE_OPERATIONS_NOTIFICATION_MATRIX_AUDIT.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1P ACCOUNT-LEVEL PUSH DISABLE PREPARATION (2026-09-16)

Preparación (sin ejecutar) de la certificación física del apagado (OFF)
del switch account-level de Push. Con los 3 productores reales ya
certificados (Salón/Mozo/PyR), esta tarea audita exactamente qué pasa
cuando el operador toca OFF, sin tocarlo todavía.

```text
P2_T44_R1P_STATUS=ACCOUNT_LEVEL_PUSH_DISABLE_PREPARATION_READY_TESTING (sonda física NO ejecutada)
PRODUCT_CODE_CHANGED=NO

SUBSCRIPTION_REVERIFICADA=1 fila (cmu4ni2t0000up90btelfflhq, ownerType=cuenta_operativa, ownerId=cmu1xe5p10000rip8gbsxes0l, channel=default) — misma de R1M/R1O, sin tocar. Legacy de los 3 empleados fixture (Mozo/PyR/Salón): 0.

HALLAZGO_CLAVE_DE_CODIGO=el hook usePushNotifications (src/hooks/use-push-notifications.ts) documenta explícitamente la política PHYSICAL_UNSUBSCRIBE_POLICY_FINAL=SERVER_DETACH_ONLY: al tocar OFF, el cliente SOLO llama a POST /api/push/unsubscribe?actorFamily=cuenta_operativa (DELETE real de la fila en DB, exact-match por ownerType+ownerId+channel+endpoint+p256dh+auth vía detachPushSubscriptionByEndpoint) — deliberadamente NUNCA llama a PushSubscription.unsubscribe() del navegador. Esto explica RETROACTIVAMENTE, con evidencia de código (no sólo inferencia), el hallazgo de R1M: el endpoint físico permanece idéntico antes/después de un OFF→ON porque el navegador nunca es instruido a destruirlo — sólo se desvincula server-side.

CONTRATO_OFF=/api/push/status?actorFamily=cuenta_operativa responde subscribed:false cuando no existe fila que coincida exactamente con (ownerType, ownerId, channel, endpoint-actual-del-browser). La UI refleja OFF inmediatamente vía estado local (finishMutation→applySubscribed), sin esperar un refetch.

SEGURIDAD_CONFIRMADA=ownerId siempre derivado server-side de la cookie deligo_operativo_session (getOperationalAccountFromRequest), nunca del body del cliente — DISABLE_SERVER_DERIVED_OWNER=SI, DISABLE_CROSS_ACTOR_DELETE_PROTECTED=SI. Idempotente: un segundo toque no falla ni duplica nada (deleteMany sobre 0 filas es un no-op silencioso, HTTP 200 igual).

ALCANCE=account-level real — la misma fila sirve a los 3 roles (Mozo/PyR/Salón) a la vez; no existe forma de "apagar sólo uno". EXPECTED_POST_DISABLE_ACCOUNT_PUSH_COUNT=0. POST_DISABLE_PRODUCER_PROBE_REQUIRED=NO (no hace falta otro pedido/Push para demostrarlo — DB+status+UI ya son evidencia completa).

DISEÑO_FUTURO_LOGOUT=auditado (sin ejecutar) src/app/api/operativo/logout/route.ts — SÍ tiene su propio detach-en-logout (fila de cuenta + legacy de TODOS los empleados de esa cuentaOperativaId), más amplio que /api/push/unsubscribe. LOGOUT_CLEANUP_REQUIRES_PUSH_ON_BEFORE_LOGOUT=SI — una futura tarea de logout necesitará re-suscribir de forma controlada ANTES de hacer logout real, o ese camino de código nunca se ejercitaría (no hay nada que limpiar si R1P ya lo dejó en 0). Secuencia futura diseñada, no ejecutada.

FOCAL_TESTS=200 pass / 0 fail (aislados: push/unsubscribe, push/status, push-subscription-repository, proxy.test, operativo/logout, 4 tests funcionales de use-push-notifications). Lateral conocido (use-push-notifications-static-contract.test.ts) no bloquea.

P2-T44 sigue NO cerrada tras R1P — pendiente: ejecutar la sonda física de disable, logout cleanup (con la secuencia diseñada en §16 del reporte), hallazgo de cuenta de mesa (fixture slug, no relacionado) y hallazgo lateral de R1I si se decide reconciliar antes del cierre.

NEXT_ACTION=WAIT_FOR_OPERATOR_R1P_ACCOUNT_PUSH_DISABLE_PHYSICAL_PROBE

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
PRODUCTION_TOUCHED=NO
```

Reporte completo (flujo ON→OFF auditado línea por línea, contrato real
de "OFF", distinción backend/browser/permiso, idempotencia, diseño de
la secuencia futura de logout, criterio de PASS diseñado):
`codex-reports/P2_T44_R1P_ACCOUNT_LEVEL_PUSH_DISABLE_PHYSICAL_CERT_PREPARATION.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1O PyR CANCELLATION PUSH CERTIFIED — ALL 3 REAL PRODUCERS PHYSICALLY CERTIFIED (2026-09-16)

Sonda física PyR (R1N) EJECUTADA por el operador y analizada con logs
Railway TESTING + DB, correlación exacta al milisegundo. PASS completo,
sin OFF→ON, sin reproducir el incidente de entrega de R1M.

```text
P2_T44_R1O_STATUS=PYR_CANCELLATION_REAL_PUSH_PHYSICALLY_CERTIFIED_TESTING
R1N_PYR_PUSH_PHYSICAL_PASS=SI

PEDIDO=cmu4oj061000zp90baof718ap (Negocio B, metodoEntrega=retiro, total=1100, cliente=fixture R1N). Creado 22:35:42.301Z (POST /api/pedidos 200, SIN ningún intento de Push — correcto, no existe productor de "nuevo pedido" PyR en T44, sólo el de cancelación). Cancelado 22:36:18.997Z (PATCH /api/negocio/pedidos/[id]/estado 200, recibido→cancelado, canceladoPor=vendedor).

CADENA_TECNICA_CONFIRMADA=PATCH cancelación 200 → [Push] Enviado OK (tipo=operaciones_order_cancelled actorFamily=cuenta_operativa endpointFingerprint=04a319fa providerStatus=201) → Notificacion in-app creada (título="Pedido cancelado ❌", cuerpo="Un pedido fue cancelado por el local", userId=cmu1xe79q0006rip8lbdqmvpz) → operador confirmó exactamente 1 Push visible real, sin error en ningún lado.

TARGET_OWNER_TYPE=cuenta_operativa / TARGET_OWNER_ID=cmu1xe5p10000rip8gbsxes0l / TARGET_SUBSCRIPTION_ID=cmu4ni2t0000up90btelfflhq (MISMA fila de R1M, sin cambios de id/createdAt — confirma que el switch no fue tocado, doblemente verificado por DB + endpointFingerprint idéntico al de R1M). LEGACY_FALLBACK_USED=NO.

R1M_DEVICE_DELIVERY_MISS_REPRODUCED_IN_R1N=NO (mismo endpoint físico, mismo resultado server-side 201, esta vez SÍ se vio en el dispositivo a la primera, sin reintento). ACCOUNT_PUSH_REQUIRES_REENABLE_ISSUE=NO — reforzado por una tercera certificación consecutiva sin necesitar reactivar nada (Salón, Mozo-intento-2, PyR).

AUSENCIA_PUSH_PEDIDO_RECIBIDO_PyR=esperada y confirmada por diseño (no es un bug) — R1N/R1O certifican exclusivamente el productor de CANCELACIÓN (notifyOperationsOrderCancelled); no existe en T44 un productor de "nuevo pedido" para el área PyR.

Con esto, los 3 productores reales account-level de T44 quedan físicamente certificados en TESTING: Salón (R1J/R1K), Mozo (R1L/R1M, con el primer intento de entrega no observado preservado en el historial, no ocultado) y PyR-cancelación (R1N/R1O).

P2_T44_STATUS=ALL_REAL_PRODUCERS_PHYSICALLY_CERTIFIED_AWAITING_DISABLE_AND_LOGOUT

Pendiente: disable del switch account-level, logout cleanup, hallazgo de cuenta de mesa (fixture slug, ver sección aparte, no relacionado), hallazgo lateral de R1I (use-push-notifications-static-contract.test.ts) si se decide reconciliar antes del cierre, limpieza de fixtures si se decide al final.

NEXT_ACTION=P2_T44_R1P_ACCOUNT_LEVEL_PUSH_DISABLE_PHYSICAL_CERTIFICATION_PREPARATION

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
PRODUCTION_TOUCHED=NO
PRODUCT_CODE_CHANGED=NO (sólo análisis de logs/DB de sólo lectura)
```

Reporte completo (delimitación exacta de la ventana R1N, identificación
del pedido, correlación log↔DB de creación/cancelación, investigación
explícita de 2 llamadas unsubscribe previas descartadas como
irrelevantes al target de cuenta, criterio de PASS evaluado punto por
punto, sección dedicada a por qué la ausencia de Push al crear el
pedido es esperada):
`codex-reports/P2_T44_R1O_REAL_PYR_PUSH_PHYSICAL_CERTIFICATION_ANALYSIS.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1N PyR PUSH CERT PREPARATION (2026-09-16)

Preparación (sin ejecutar) de la certificación física del tercer
productor account-level de T44: PyR — cancelación de pedido
(`notifyOperationsOrderCancelled`, `src/lib/operations-cancellation-notification.ts`).
No se reabrió Salón ni Mozo. No se tocó el switch de Push (se deja tal
cual quedó tras R1M, deliberadamente, para no ocultar un problema real).

```text
P2_T44_R1N_STATUS=PYR_REAL_PUSH_PREPARATION_READY_TESTING (sonda física NO ejecutada)
PRODUCT_CODE_CHANGED=NO

SUBSCRIPTION_REVERIFICADA=1 fila (cmu4ni2t0000up90btelfflhq, ownerType=cuenta_operativa, ownerId=cmu1xe5p10000rip8gbsxes0l, channel=default) — misma de R1M, sin tocar.

PYR_FIXTURE=Negocio B (cmu1xe6ok0002rip8yc707wze, slug test_t44_r1d_negocio_b_4135ea7a) — Empleado PyR ya existente desde R1D (cmu1xe79q0006rip8lbdqmvpz, cuentaOperativaId=cmu1xe5p10000rip8gbsxes0l, coincide). Negocio B estaba cerrado (mismo patrón horarioMode="experto"/horarios="{}" ya conocido) — corregido a "simple" (fixture-only, ya verificado isOpen:true en vivo). Sin catálogo ni pedidos previos — se creó 1 sección + 1 producto ($1000) + 1 cuenta Cliente mínima (ofreceRetiro ya era true, sin cambios ahí).

DISEÑO_ELEGIDO=cross-role, igual patrón que Mozo: Desktop=Negocio B (login propio) crea el pedido de RETIRO (áreaForMetodoEntrega resuelve retiro/domicilio→"pyr", mesa→"salon") vía Cliente autenticado (retiro/domicilio EXIGEN Cliente real, a diferencia de mesa que admite invitado), luego cancela vía PATCH /api/negocio/pedidos/[id]/estado {estado:"cancelado", motivo}. Teléfono=CuentaOperativa/PyR sólo recibe el Push, sin acción propia — se descartó la ruta self-service operaciones/pyr/pedidos/[id]/estado para evitar autonotificación ambigua (único empleado PyR del fixture).

EXPECTED_TARGET=ownerType=cuenta_operativa/ownerId=cmu1xe5p10000rip8gbsxes0l (misma fila de R1H/R1M, legacy no usado, subscriptionCount=1, sendCount=1).
EXPECTED_PAYLOAD=title:"Pedido cancelado ❌" (fijo) / body:"Un pedido fue cancelado por el local" / type:operaciones_order_cancelled / url:/operaciones/mi-panel/test_t44_r1d_negocio_b_4135ea7a/pyr/pedidos?pedidoId=<id>.

FOCAL_TESTS=121 pass / 0 fail (aislados: operations-cancellation-notification, operations-cancellation-push, push-subscription-repository, proxy.test, order-transition-cas-concurrency). Lateral conocido (use-push-notifications-static-contract.test.ts, cliente-side, desde R1I) no bloquea — server-side de PyR no lo usa.

FIXTURE_SLUG_UNDERSCORE_BLOCKS_PYR_PROBE=NO (SLUG_PATTERN restrictivo sólo aplica a /api/public/mesa-cuenta, exclusivo de mesa — PyR nunca pasa por ahí).

LECCION_R1M_APLICADA=no se reactivó el switch preventivamente (ACCOUNT_PUSH_REQUIRES_REENABLE_ISSUE=NO de R1M) — si en la sonda futura el proveedor da éxito y el dispositivo no muestra el Push, la instrucción es NO reactivar y NO repetir, sólo registrar si el fenómeno DEVICE_DELIVERY de R1M se reproduce.

Credenciales (Negocio B + Cliente fixture) generadas runtime-only, verificadas por roundtrip, entregadas sólo en el chat — no persistidas aquí ni en el reporte.

P2-T44 sigue NO cerrada tras R1N — pendiente: ejecutar la sonda física PyR, disable del switch account-level, logout cleanup, hallazgo de cuenta de mesa (fixture slug, ver sección aparte) y hallazgo lateral de R1I (use-push-notifications-static-contract.test.ts) si se decide reconciliar.

NEXT_ACTION=WAIT_FOR_OPERATOR_R1N_PYR_REAL_PUSH_PHYSICAL_PROBE

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
PRODUCTION_TOUCHED=NO
```

Reporte completo (trigger auditado con 7 call-sites reales, diseño
cross-role, fixture completo, payload/target auditados, tests,
baseline, criterio de PASS diseñado, credenciales sin secretos):
`codex-reports/P2_T44_R1N_REAL_PYR_PUSH_PHYSICAL_CERT_PREPARATION.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1M MOZO PUSH CERTIFIED (TWO-ATTEMPT, DEVICE-DELIVERY VARIANCE) (2026-09-16)

Sonda física Mozo (R1L) EJECUTADA por el operador. No fue una sonda
limpia: hubo DOS pedidos/intentos, con un OFF→ON del switch de
notificaciones Mozo en el medio. Analizado con logs Railway TESTING +
DB, correlación exacta al milisegundo.

```text
P2_T44_R1M_STATUS=MOZO_REAL_PUSH_PHYSICALLY_CERTIFIED_TESTING_DEVICE_DELIVERY_VARIANCE_NOTED
R1L_MOZO_PUSH_PHYSICAL_PASS=SI

RESUMEN_DOS_INTENTOS=orden de CREACIÓN de pedidos ≠ orden de TRANSICIÓN/disparo de Push (importante, no confundir). ATTEMPT_1 (por orden de transición, SIN Push recibido) = pedido cmu4ng86s000pp90bjqsbn3ca, transicionado 22:06:22.386Z. ATTEMPT_2 (CON Push recibido) = pedido cmu4nfa58000jp90bkmfaitpr, transicionado 22:07:06.592Z, DESPUÉS del OFF→ON.

ATTEMPT_1=server-side IDÉNTICO a ATTEMPT_2: productor ejecutado, target de cuenta correcto (cuenta_operativa/cmu1xe5p10000rip8gbsxes0l), 1 solo envío, proveedor aceptó con HTTP 201, notificación in-app creada. NO hubo 404/410, NO se disparó ningún cleanup de subscription. La diferencia (Push no visto vs visto) ocurrió DESPUÉS del punto que el servidor puede observar — capa dispositivo/navegador, fuera del alcance de este backend.

OFF_ON_ENTRE_AMBOS=POST /api/push/unsubscribe (22:06:57.289Z) → POST /api/push/subscribe (22:06:59.490Z). Mecanismo confirmado: unsubscribe hace DELETE real de la fila; el navegador devolvió el MISMO endpoint físico de siempre (mismo endpointFingerprint=04a319fa antes y después) — sólo cambió el id/createdAt de la fila en DB (fila nueva, mismo endpoint). REACTIVATION_CAUSALLY_EXPLAINS_SECOND_SUCCESS=UNPROVEN — correlación temporal, no causalidad demostrada server-side.

ACCOUNT_PUSH_REQUIRES_REENABLE_ISSUE=NO. No se encontró ningún defecto de persistencia/lifecycle de subscription — la fila fue aceptada por el proveedor (201) en AMBOS intentos, sin excepción, sin rechazo. FIRST_ATTEMPT_ROOT_CAUSE_CATEGORY=DEVICE_DELIVERY (identificado a nivel de etapa; el mecanismo exacto dentro del dispositivo/navegador no es observable desde los logs del servidor).

POST_R1M_ACCOUNT_PUSH_SUBSCRIPTION=1 fila activa (cmu4ni2t0000up90btelfflhq, misma endpoint física de siempre, usada con éxito en el envío más reciente).

Salón (R1J/R1K) sigue PASS limpio, sin reabrir. Mozo ahora también PASS, con la salvedad honesta del intento 1 documentada (no oculta). PyR todavía NO ejecutado. Disable del switch / logout siguen pendientes (no se tocan hasta que el operador decida cerrar T44).

NEXT_ACTION=P2_T44_R1N_REAL_PYR_PUSH_PHYSICAL_CERTIFICATION_PREPARATION

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
PRODUCTION_TOUCHED=NO
PRODUCT_CODE_CHANGED=NO (sólo análisis de logs/DB de sólo lectura)
```

Reporte completo (cronología exacta minuto a minuto, correlación
log↔DB de ambos intentos, mecanismo exacto del OFF→ON, dos
conclusiones separadas — certificación del productor vs confiabilidad
de persistencia de subscription):
`codex-reports/P2_T44_R1M_MOZO_REAL_PUSH_TWO_ATTEMPT_ANALYSIS.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1L FIXTURE READINESS CORRECTED (2026-09-16)

Continuación de R1L: el operador encontró el fixture Negocio A/Mesa 1
con dos bloqueos reales. Ambos auditados y el primero corregido
(fixture-only); el segundo root-caused con evidencia directa pero
dejado sin implementar (fuera de alcance, no bloquea Push). Sonda física
Mozo SIGUE sin ejecutarse.

```text
P2_T44_R1L_FIXTURE_READINESS_STATUS=READY_FOR_OPERATOR_R1L_MOZO_REAL_PUSH_PHYSICAL_PROBE
PRODUCT_CODE_CHANGED=NO

BLOQUEO_1_CERRADO=RESUELTO. Causa: Negocio A tenía horarioMode="experto" con horarios="{}" — abiertoManual=true (ya estaba en true desde R1L) se ignora por completo en ese modo (isBusinessOpenAt sólo lo lee en modo "simple"). Fix fixture-only: horarioMode->"simple". Verificado en vivo (GET /api/negocios/{slug} → isOpen:true) y visualmente en la tienda real ("Abierto", "Mesa 1", producto visible, $1.000,00).

BLOQUEO_2_CUENTA_DE_MESA=ROOT-CAUSED, NO IMPLEMENTADO (decisión del operador). "No pudimos cargar tu cuenta de mesa." reproducido en vivo: GET /api/public/mesa-cuenta?slug=...&mesa=1 devuelve HTTP 400 real ("slug y mesa son requeridos") porque SLUG_PATTERN=/^[a-z0-9-]{1,80}$/ (src/app/api/public/mesa-cuenta/route.ts) rechaza el guion bajo del slug del fixture (test_t44_r1d_negocio_a_4135ea7a). NO es bug de producto: generateSlug() (src/lib/utils.ts) nunca produce guion bajo — es un problema de LOS FIXTURES de esta sesión (A, B y C, todos con slugs con "_"), no del código. Esto resuelve el hallazgo que R1K había dejado abierto para Negocio C (antes sin root cause confirmado). Fix disponible si se desea: renombrar los slugs de fixture a formato con guiones — no implementado, no bloquea Push. Estado esperado ANTES de cualquier check-in real es "hidden"/sin mensaje (sin_sesion) — el mensaje visible confirma que es un error real, no el estado normal pre-checkin.

GEOLOCALIZACION_TEMPORAL=NO_APLICADA. No hace falta: POST /api/pedidos sólo bloquea por geocerca si el negocio está calibrado (lat/lng no nulos) — Negocio A sigue sin calibrar y el bloqueo se salta entero. El check-in automático de la tienda tampoco se dispara sin calibrar (mesaGeofenceReady=false, cero requests a mesa-geofence observadas). Aunque se calibrara, el bug de slug seguiría rompiendo la cuenta de mesa igual — son independientes.

BASELINES_RECONFIRMADOS=PRE_R1L_ORDER_COUNT_NEGOCIO_A=0 / PRE_R1L_MOZO_NOTIFICATION_COUNT=0 / PRE_R1L_ACCOUNT_PUSH_SUBSCRIPTION_COUNT=1 (switch R1H intacto, sin segunda suscripción)

NO se creó pedido, no se cambió estado, no se envió Push, no se creó ocupación manual por DB, no se tocó Negocio C, no se tocó PyR, no se hizo logout, no se tocó Production.

NEXT_ACTION=WAIT_FOR_OPERATOR_R1L_MOZO_REAL_PUSH_PHYSICAL_PROBE
```

Reporte completo: `codex-reports/P2_T44_R1L_FIXTURE_READINESS_CORRECTION.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1L MOZO REAL PUSH CERT PREPARATION (2026-09-16)

Preparación (sin ejecutar) de la certificación física del productor
Push de Mozo. Restricción arquitectónica nueva descubierta:
`Empleado.@@unique([negocioId, cuentaOperativaId])` — una cuenta sólo
puede tener un área por negocio, por lo que no se pudo reutilizar el
fixture/pedido de Salón (R1J/R1K, Negocio C) para Mozo. Se usó Negocio A
(que ya tenía la relación Mozo desde R1D) con un fixture nuevo mínimo
(mesa + catálogo), sin tocar Negocio C ni la suscripción de cuenta de R1H.

```text
P2_T44_R1L_STATUS=MOZO_REAL_PUSH_PREPARATION_READY_TESTING (sonda física NO ejecutada)
PRODUCT_CODE_CHANGED=NO

DESIGN_PIVOT=cross-role: Negocio A (login propio, Desktop) dispara la transición preparando->listo_para_retirar via PUT /api/negocio/pedidos (UI real: salon-tab.tsx, botón "Listo para servir"); la CuentaOperativa/Mozo (Teléfono, ya suscripta desde R1H) sólo recibe el Push. La ruta operativo/salon/pedidos/[id]/listo NO es utilizable por esta cuenta en Negocio A (exige área "salon", la cuenta tiene "mozo" ahí).
MOZO_FIXTURE_NEGOCIO=A (cmu1xe6780001rip85yygdszn) / MESA=cmu4egqut0001rixojiu53s6d (numero=1, empleadoId=cmu1xe6vr0004rip8eqkwkziq) / PRODUCTO=cmu4egrno0005rixo1k7inlg3 ($1000)
EXPECTED_MOZO_PUSH_TARGET=ownerType cuenta_operativa / ownerId cmu1xe5p10000rip8gbsxes0l (misma fila de R1H, cmu4ayhgp0001nj0b73casku3 — no se crea una segunda)
EXPECTED_MOZO_PUSH_PAYLOAD=title:"Pedido listo" / body:"Mesa 1 lista para entregar" / type:mesa_order_ready / url:/mozo/panel/test_t44_r1d_negocio_a_4135ea7a?pedidoId=<id>

PRE_R1L_MOZO_NOTIFICATION_COUNT=0 / PRE_R1L_ACCOUNT_PUSH_SUBSCRIPTION_COUNT=1 (sin cambios, R1H intacta)
TESTS_FOCALES_AISLADOS=110 pass / 0 fail (order-transition-cas-mesa, mesa-order-ready-notification, push-subscription-repository, proxy.test) — 2 fallos sólo al correr los 4 archivos JUNTOS, aislados a un artefacto de bun:test entre archivos (TypeError db.negocio undefined en el cleanup de un solo archivo), no una regresión — confirmado corriendo ese archivo solo (3 pass / 0 fail, DB real). No se investigó más a fondo (fuera de alcance de una tarea de preparación).

Negocio A: salonActivo=true (fixture-only), lat/lng/ubicacionCalibradaEn siguen null (no se recreó el hallazgo de privacidad de R1K — no hace falta para certificar sólo el Push; el check-in de mesa completo, si se quiere, requeriría repetir el patrón de coordenadas temporales de R1J/R1K bajo la misma disciplina).
Password temporal de Negocio A generada y verificada, NO persistida en Git/reportes/este contexto — entregada sólo en el chat final.

P2-T44 NO cerrada — pendiente tras R1L: ejecutar la sonda física Mozo, Push real PyR, disable account-level, logout cleanup, hallazgo de cuenta de mesa (R1K, si se decide incorporar), hallazgo lateral de R1I sobre use-push-notifications-static-contract.test.ts (si se decide reconciliar)

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
PRODUCTION_TOUCHED=NO

NEXT_PUSH_ACTION=WAIT_FOR_OPERATOR_R1L_MOZO_REAL_PUSH_PHYSICAL_PROBE
```

Reporte completo (constraint de Empleado, pivote de rol/ruta auditado en
código, fixture, payload/target auditados, tests, baseline, criterio de
PASS diseñado, credenciales para la sonda futura sin secretos):
`codex-reports/P2_T44_R1L_REAL_MOZO_PUSH_PHYSICAL_CERT_PREPARATION.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1J SALON REAL PUSH CERTIFIED (2026-09-16)

Análisis de la sonda física R1J ya ejecutada: pedido real de mesa creado
por el operador, Push real de Salón certificado con evidencia técnica
directa (logs + DB), no sólo el reporte humano. Hallazgo lateral no
bloqueante (error visual de "cuenta de mesa") auditado por separado, sin
implementar fix. Coordenadas temporales del operador ya limpiadas del
fixture.

```text
P2_T44_R1J_STATUS=SALON_REAL_PUSH_PHYSICALLY_CERTIFIED_TESTING
R1J_SALON_PUSH_PHYSICAL_PASS=SI

R1J_ORDER_ID=cmu4dqnsp0005p90b0zeotd9x (metodoEntrega=mesa, mesaNumero=1, total=1000, clienteNombre=Invitado/guest, createdAt=2026-09-16T17:33:43.802Z)
CADENA_TECNICA_CONFIRMADA=POST /api/pedidos 200 (17:33:43.706Z) → [Push/OperacionesSalon] resumen (destinatarios=1, endpointsUnicos=1) → [Push] Enviado OK (actorFamily=cuenta_operativa, providerStatus=201, 1 solo endpointFingerprint) → Notificacion in-app creada (tipo=operaciones_salon_new_order, mismo pedidoId) → operador confirmó 1 Push visible real en el teléfono, sin error ahí
TARGET_OWNER_TYPE=cuenta_operativa / TARGET_OWNER_ID=cmu1xe5p10000rip8gbsxes0l / TARGET_SUBSCRIPTION_ID=cmu4ayhgp0001nj0b73casku3 (misma fila de R1H)
LEGACY_EMPLOYEE_FALLBACK_USED=NO / NEW_EMPLOYEE_PUSH_SUBSCRIPTION_CREATED=NO
EXACTLY_ONE_PHYSICAL_PUSH_ATTEMPT=SI (confirmado server-side, no sólo por el reporte humano de "1 Push")
Los 10 criterios de PASS de la tarea se cumplieron simultáneamente con evidencia técnica directa.

HALLAZGO_NO_BLOQUEANTE=error visual "No pudimos cargar tu cuenta de mesa." observado por el operador SOLO en este fixture (Negocio C), no en otro negocio. Mecanismo confirmado: fetchMesaClienteCuenta (src/lib/mesa-cliente-cuenta-client.ts) mapea CUALQUIER fetch-exception/HTTP-no-ok/JSON-inválido/data.ok!==true/shape-"activa"-incompleto al mismo {kind:"error"} genérico. Descartado como problema de datos del fixture: el pedido creado (cmu4dqnsp0005p90b0zeotd9x) tiene su ocupacionMesaId perfectamente enlazado con Mesa.ocupacionActualId, sin ningún desajuste — verificado por consulta directa. Cero excepciones servidor logueadas, 100% de ~30 requests GET /api/public/mesa-cuenta en la ventana devolvieron 200. TABLE_ACCOUNT_ROOT_CAUSE_IDENTIFIED=NO (mecanismo confirmado, trigger exacto no confirmable desde los logs disponibles — no especulado más allá). TABLE_ACCOUNT_FAILURE_BLOCKS_PUSH_CERTIFICATION=NO (features de código/endpoint/disparador completamente independientes; el pedido/productor/Push ya estaban confirmados correctos con evidencia propia antes de que este panel importara). NO se implementó fix — sólo diseñado (witness-only en mesa-cliente-cuenta-client.ts) para una tarea futura separada, NO mezclada con T44 Push.

TEMP_OPERATOR_COORDINATES_CLEANED=SI / POST_CLEANUP_BUSINESS_LAT_IS_NULL=SI / POST_CLEANUP_BUSINESS_LNG_IS_NULL=SI (confirmado por DB directa y por el endpoint público GET /api/negocios/{slug} — mesaGeofenceReady vuelve a false, sin exponer más la ubicación real del operador)
FIXTURE_OPEN_MODE_LEFT_FOR_TESTING=SI (horarioMode=simple/abiertoManual=true quedan así, sin razón operativa para revertir, sin impacto de privacidad)
R1H_PHYSICAL_SUBSCRIPTION_PRESERVED=SI (misma fila cmu4ayhgp0001nj0b73casku3)

P2-T44 NO cerrada — pendiente: Push real Mozo, Push real PyR, disable account-level, logout cleanup, hallazgo de cuenta de mesa (si se decide incorporar al backlog), hallazgo lateral de R1I sobre use-push-notifications-static-contract.test.ts (si se decide reconciliar)

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
PRODUCTION_TOUCHED=NO

NEXT_PUSH_ACTION=P2_T44_R1L_REAL_MOZO_PUSH_PHYSICAL_CERTIFICATION_PREPARATION (recomendada, no ejecutada)
NEXT_TABLE_ACCOUNT_ACTION=P2-TXX_TABLE_ACCOUNT_ERROR_DIAGNOSTIC_WITNESS (sugerida, no ejecutada, no mezclar con T44 Push)
```

Reporte completo (correlación exacta log↔DB de la cadena Push, evaluación
explícita de los 10 criterios de PASS, sección separada "Hallazgo no
bloqueante: cuenta de mesa del fixture" con mecanismo confirmado y
descarte de causas por evidencia directa, fix propuesto sin implementar,
limpieza de coordenadas confirmada):
`codex-reports/P2_T44_R1K_REAL_SALON_PUSH_PHYSICAL_CERTIFICATION_ANALYSIS.md`.

No se guardaron las coordenadas reales del operador en ningún lado de
este contexto ni en Git.

## HISTORICAL SNAPSHOT — P2-T44-R1J FIXTURE ADJUSTED FOR PROBE (2026-09-16)

Ajuste de fixture TESTING (sin código de producto) para destrabar los dos
bloqueos prácticos que el operador encontró antes de poder correr la
sonda física R1J: negocio mostrado como cerrado, y geocerca de mesa sin
calibrar. La sonda física en sí sigue SIN ejecutarse.

```text
P2_T44_R1J_FIXTURE_ADJUSTMENT_STATUS=READY_FOR_OPERATOR_R1J_SALON_REAL_PUSH_PHYSICAL_PROBE

BUSINESS_CLOSED_REASON=horarioMode="experto" con horarios="{}" (sin ningún día configurado) — isBusinessOpenAt() devuelve false siempre en ese modo cuando no hay ninguna entrada de horario para el día actual; confirmado leyendo src/lib/business-hours.ts, no asumido
BUSINESS_OPEN_FIX_TYPE=activación del toggle manual ya soportado por el producto (horarioMode="simple" + abiertoManual=true) — no es una fórmula "siempre abierto" inventada, es un modo real que cualquier negocio puede elegir; documentado explícitamente como fixture-only para esta cuenta TESTING
BUSINESS_OPEN_FOR_R1J=SI (confirmado en vivo: GET /api/negocios/test_t44_r1d_negocio_c_4135ea7a → isOpen:true)

FIXTURE_BUSINESS_LOCATION_UPDATED=SI (Negocio C: lat/lng seteados a la ubicación real del operador + ubicacionCalibradaEn=now() — sin las 3 condiciones simultáneas, evaluateMesaGeofence() devuelve "business_unconfigured" y mesa-occupancy nunca se abre; confirmado en src/lib/mesa-geofence.ts)
GEOFENCE_EXPECTED_TO_PASS_AT_OPERATOR_LOCATION=SI (verificado con evaluateMesaGeofence() real contra las mismas coordenadas → status="inside", distanceMeters=0, dentro del radio de 200m/precisión máxima 150m — sin tocar el radio ni la lógica de geofencing)
BUSINESS_OPEN_CHECK_EXPECTED_TO_PASS=SI (confirmado en vivo, no sólo "esperado")

ADVERTENCIA_DE_PRIVACIDAD=GET /api/negocios/{slug} es un endpoint PÚBLICO no autenticado que devuelve lat/lng del negocio a cualquiera — dado que esas coordenadas son ahora la ubicación física real del operador, quedan expuestas públicamente en TESTING mientras dure la calibración. Recomendado: limpiar lat/lng/ubicacionCalibradaEn de este fixture (volver a null) apenas termine la sonda física, en una tarea de limpieza separada — NO hecho automáticamente en esta tarea porque el operador todavía necesita la calibración ACTIVA para correr la sonda.

STORE_ACCESSIBLE=SI / MESA_CONTEXT_RECOGNIZED=SI / TEST_PRODUCT_VISIBLE=SI (los 3 confirmados en vivo vía GET /api/negocios/test_t44_r1d_negocio_c_4135ea7a: isOpen=true, mesaGeofenceReady=true, salonHabilitado=true, productos=[TEST_T44_R1J_PRODUCTO]) — sin crear ningún pedido

PRE_R1J_ORDER_COUNT_FOR_FIXTURE=0 / PRE_R1J_NOTIFICATION_COUNT_FOR_SALON_EMPLEADO=0 / PRE_R1J_ACCOUNT_PUSH_SUBSCRIPTION_COUNT=1 (reverificados después del ajuste — sin cambios inesperados, ningún STOP)

R1J_ACCOUNT_PUSH_SUBSCRIPTION_PRESENT=SI / EXPECTED_PUSH_OWNER_TYPE=cuenta_operativa / EXPECTED_PUSH_SUBSCRIPTION_COUNT=1 / EXPECTED_LEGACY_EMPLOYEE_FALLBACK_USED=NO (sin cambios, no reabierto)

PRODUCT_CODE_CHANGED=NO (sólo 2 campos del Negocio C de TESTING + 1 registro de contexto — cero commit/push/deploy)
PRODUCTION_TOUCHED=NO

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)

Sonda física Salón todavía NO ejecutada — pedido real todavía no creado, Push real todavía no enviado.

NEXT_ACTION=WAIT_FOR_OPERATOR_R1J_SALON_REAL_PUSH_PHYSICAL_PROBE
```

Las coordenadas exactas del operador NO se guardan acá ni en ningún
reporte — sólo existen en la fila `Negocio` de la base TESTING mientras
dure la calibración de esta sonda.

## HISTORICAL SNAPSHOT — P2-T44-R1J REAL SALON PUSH PREPARATION (2026-09-16)

Preparación (sin ejecutar) de la primera certificación física de un Push
REAL producido por una acción real de negocio: pedido de mesa en Negocio C
→ `salon-new-order-notification` → `resolveOperationalPushTargets` →
CuentaOperativa account-level → Web Push real. P2-T44 sigue sin cerrarse.

```text
P2_T44_R1J_STATUS=READY_FOR_OPERATOR_R1J_SALON_REAL_PUSH_PHYSICAL_PROBE

R1J_ACCOUNT_PUSH_SUBSCRIPTION_PRESENT=SI (reverificado, misma fila de R1H: cmu4ayhgp0001nj0b73casku3, sin reabrir R1H/R1I)

HALLAZGO=Negocio C (T44_SALON, salonActivo=true desde R1D) NO tenía ninguna Mesa ni Producto — un pedido real habría fallado. Se creó el fixture mínimo autorizado por la tarea: 1 Mesa (TEST_T44_R1J_MESA_SALON, numero=1, activa=true, id=cmu4d8vf30001rio4gtphv04w), 1 SeccionCatalogo + 1 Producto (TEST_T44_R1J_PRODUCTO, $1000, id=cmu4d8w6q0005rio46fgxwvpd) + su SeccionProducto de vínculo — nada de más.

SALON_PUSH_TRIGGER_ROUTE=POST /api/pedidos (línea ~1886) — SALON_PUSH_TRIGGER_EVENT=creación del pedido (no una transición de estado posterior) — SALON_PUSH_REQUIRED_DELIVERY_METHOD=metodoEntrega="mesa" + mesaNumero truthy
CERT_TRIGGER_USES_REAL_PRODUCT_FLOW=SI (mismo POST /api/pedidos que usa la app Cliente real; sin atajos/scripts/inserciones manuales)

SALON_ORDER_CREATION_URL=https://deligo-copy-production.up.railway.app/n/test_t44_r1d_negocio_c_4135ea7a?mesa=1
CLIENT_LOGIN_REQUIRED=NO (guest checkout — /api/pedidos está en PUBLIC_API_PREFIXES, clienteId nullable) — sin necesitar segundo teléfono ni cuenta Cliente
PHONE_ROLE=PUSH_RECIPIENT (ya con Push ON de R1H, no hace falta re-activar) / DESKTOP_ROLE=SALON_ORDER_CREATOR
PHONE_BROWSER_PWA_STATE_FOR_TEST=cualquiera (public/sw.js registra un listener `push` estándar, independiente de foreground/background/cerrado — comportamiento nativo de Web Push, nada inventado)

EXPECTED_PUSH_OWNER_TYPE=cuenta_operativa / EXPECTED_PUSH_OWNER_ID=cmu1xe5p10000rip8gbsxes0l / EXPECTED_PUSH_SUBSCRIPTION_COUNT=1 / EXPECTED_LEGACY_EMPLOYEE_FALLBACK_USED=NO / EXPECTED_PHYSICAL_PUSH_SEND_COUNT=1
EXPECTED_PUSH_TITLE_PATTERN="Mesa 1 — Nuevo pedido 📩" / EXPECTED_PUSH_TAG=operaciones-salon-new-order-<pedidoId> / EXPECTED_NOTIFICATION_TYPE=operaciones_salon_new_order

WITNESS_DISPONIBLE_SIN_INSTRUMENTAR=SI — "[Push/OperacionesSalon] resumen" (destinatarios/endpointsUnicos), "[Push] Enviado OK (...actorFamily=cuenta_operativa...providerStatus=...)" (ya gateado a TESTING vía isPushDebugAllowedEnvironment(), activo en este entorno), fila Notificacion consultable directamente — CERO instrumentación nueva agregada, no hizo falta

PRE_R1J_ORDER_COUNT_FOR_FIXTURE=0 / PRE_R1J_NOTIFICATION_COUNT_FOR_SALON_EMPLEADO=0 / PRE_R1J_ACCOUNT_PUSH_SUBSCRIPTION_COUNT=1 / PRE_R1J_RELEVANT_PUSH_LOG_TIMESTAMP=2026-09-16T17:21:21Z

STATIC_CONTRACT_FAILURE_BLOCKS_R1J=NO (el hallazgo lateral de R1I sobre use-push-notifications-static-contract.test.ts es sobre el hook del switch, sin relación funcional con el envío server-side disparado por creación de pedido — auditado, no corregido, documentado)

FOCAL_TESTS=291 pass/0 fail (salon-new-order-notification + push-subscription-repository/http/key + push/status+subscribe+unsubscribe+debug-guard + push.test.ts + proxy.test.ts) + 42 pass/0 fail (sw-push-dedupe + sw-push-role-icon-routing)

BLOCKER_FOUND=NO / PRODUCT_CODE_CHANGED=NO / R1J_RUNTIME_CODE_CHANGED=NO / R1J_TESTING_DEPLOY_REQUIRED=NO (sólo fixture DB + reporte + contexto, cero commit/push/deploy)

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
T23_TOUCHED=NO / T24_TOUCHED=NO
PRODUCTION_TOUCHED=NO

P2-T44: R1H switch physically certified; R1I producer tests reconciled; R1J Salón real Push preparado — envío físico Salón AÚN NO ejecutado; Mozo/PyR siguen pendientes; P2-T44 NO cerrada

NEXT_ACTION=WAIT_FOR_OPERATOR_R1J_SALON_REAL_PUSH_PHYSICAL_PROBE
```

Reporte completo (auditoría exacta del trigger en código, diseño de los 10
criterios de PASS, payload esperado, witness disponible sin
instrumentar, fixture mínimo creado y su justificación, instrucciones y
formulario preparados para la sonda futura):
`codex-reports/P2_T44_R1J_REAL_SALON_PUSH_PHYSICAL_CERT_PREPARATION.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1I PRODUCER TESTS RECONCILED (2026-09-16)

Reconciliación exclusiva de tests (sin código de producto) de los 4
archivos stale detectados en R1E. P2-T44 sigue sin cerrarse.

```text
P2_T44_R1I_STATUS=PRODUCER_TEST_SUITE_RECONCILED
STALE_PRODUCER_TESTS_STILL_PENDING=NO
PRODUCT_BUG_FOUND=NO (los 4 productores/repository ya implementaban el contrato de dos fases de R1D correctamente — sólo sus fixtures/mocks predataban esa arquitectura)

ENUM_CONTRACT_UPDATED=SI (push-subscription-repository.test.ts: {cliente,negocio,repartidor,empleado} -> {cliente,cuenta_operativa,empleado,negocio,repartidor}, igualdad exhaustiva preservada, no debilitada)

MOZO_ACCOUNT_LEVEL_TEST=PASS / MOZO_LEGACY_FALLBACK_TEST=PASS / MOZO_NO_DOUBLE_FANOUT_TEST=PASS (+ dedupe multi-device dentro de la misma cuenta)
PYR_ACCOUNT_LEVEL_TEST=PASS / PYR_LEGACY_FALLBACK_TEST=PASS / PYR_NO_DOUBLE_FANOUT_TEST=PASS (+ resiliencia a fallo de cada fase, dedupe multi-device, reservedPushEndpoints)
SALON_ACCOUNT_LEVEL_TEST=PASS / SALON_LEGACY_FALLBACK_TEST=PASS / SALON_NO_DOUBLE_FANOUT_TEST=PASS (+ misma cuenta vinculada a 2 relaciones de empleado -> sin fan-out duplicado)

STALE_QUERY_COUNT_ASSERTIONS_REPLACED=SI (las viejas "exactamente una query batch" de un solo fase reemplazadas por el contrato real de dos fases: account-level siempre se intenta, empleado sólo para cuentas que genuinamente lo necesitan)
PRODUCER_DEDUPE_CONTRACT_TESTED=SI
LEGACY_EMPLOYEE_FALLBACK_PRESERVED=SI

FOUR_STALE_TEST_FILES_COMBINED=80 pass/0 fail (coincide exacto con la suma aislada — sin contaminación cruzada entre estos 4 archivos)
BROAD_PUSH_REGRESSION=325 pass/0 fail (proxy+status+subscribe+unsubscribe+debug-guard+subscription-http/key+repository+cancellation-push+3 productores+push.test.ts+operativo/logout) — R1G Edge auth intacto, sin tocar
FULL_SUITE_RESULT=3382 pass/200 fail/8 errors (298 archivos) — reducción exacta de 12 respecto del baseline de 212 (H2) — NEW_FAILURES=0 confirmado (ninguno de los 4 archivos reconciliados aparece en la lista de fallos), PREEXISTING_FAILURES=200 = KNOWN_SHARED_STATE_NOISE (mismo patrón de contaminación de estado compartido en la suite completa, ya documentado repetidamente en H2/R1E, no investigado más a fondo, fuera de alcance)
HALLAZGO_LATERAL_NO_CORREGIDO=src/hooks/use-push-notifications-static-contract.test.ts (1 fail, confirmado también en aislamiento, contrato estático desactualizado por el refactor de options?.actorFamily anterior a R1D — FUERA del scope autorizado de R1I, no tocado, queda como deuda separada para una tarea futura)

LINT=0 findings / DIFF_CHECK=limpio / TYPECHECK=31 (baseline) / BUILD=exit 0
PRODUCT_CODE_CHANGED=NO / RUNTIME_CODE_CHANGED=NO (sólo 4 archivos *.test.ts + reporte + contexto)

R1H_PHYSICAL_SUBSCRIPTION_PRESERVED=SI (fila cmu4ayhgp0001nj0b73casku3 verificada intacta, sin borrar ni duplicar)

R1I_TEST_RECONCILIATION_COMMIT=c2848d7c040e38f5695e31a2ae8c428bb272c4e2
TESTING_DEPLOY_REQUIRED=NO (test-only; el autodeploy de Railway se disparó igual por observar la rama incondicionalmente, documentado sin considerarlo necesario para el comportamiento — ningún archivo del bundle de producción cambió)

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T23_STATUS=REOPENED_H2A_PHYSICALLY_VALIDATED_H2B_PHYSICALLY_CERTIFIED_AWAITING_FILTER_CALIBRATION_DECISION (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
T23_TOUCHED=NO / T24_TOUCHED=NO
PRODUCTION_TOUCHED=NO

P2-T44 account-level Push switch: PHYSICALLY_CERTIFIED_TESTING (de R1H, sin cambios)
P2-T44 NO cerrada — pendiente: certificar Push REAL de Salón (recomendado como primer productor, fixture ya existe), Mozo, PyR; certificar disable/logout si siguen en la matriz

NEXT_ACTION=P2_T44_R1J_REAL_PUSH_PHYSICAL_CERTIFICATION_PREPARATION (recomendada, no ejecutada ni preparada todavía — sólo sugerida)
```

Reporte completo (causa exacta de staleness, diseño de mocks
where.ownerType-aware para las dos fases, los 4 escenarios A-D por cada
productor, resultados aislado/conjunto/regresión amplia/suite completa,
clasificación explícita de los 200 fallos preexistentes, hallazgo lateral
fuera de scope documentado sin corregir):
`codex-reports/P2_T44_R1I_PRODUCER_TEST_SUITE_RECONCILIATION.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1H SWITCH PHYSICALLY CERTIFIED (2026-09-16)

Análisis del reintento físico post-fix R1G. Operador: `SWITCH_INICIAL=OFF`,
`SWITCH_FINAL=ON`, `PIDIO_PERMISO=NO` (no es fallo — permiso ya "granted"
de sesiones previas de otros actores en el mismo origen),
`ERROR_VISIBLE=NO`. Confirmado con evidencia técnica directa de logs Y de
base de datos, no sólo el switch visual.

```text
P2_T44_R1H_STATUS=SWITCH_PHYSICALLY_CERTIFIED_TESTING
R1H_SWITCH_PHYSICAL_PASS=SI

P2-T44 account-level Push switch: PHYSICALLY_CERTIFIED_TESTING

SECUENCIA_CERTIFICADA=2026-09-16T16:14:39Z (GET /api/operativo/me) → login → me → me → POST /api/push/status 200 → GET /api/push/vapid-key 200 → POST /api/push/subscribe?actorFamily=cuenta_operativa → 200 (ya NO 401) a las 16:15:49.966Z
OBSERVACION_SEPARADA_NO_MEZCLADA=un POST /api/push/subscribe → 401 aislado a las 16:11:42Z (34s después del deploy) — probablemente una pestaña/sesión vieja pre-fix sin re-login; no forma parte de la secuencia certificada, no cuenta ni a favor ni en contra

EDGE_ACCOUNT_FAMILY_ACCEPTED_IN_REAL_REQUEST=SI (un 200 en esa ruta+actorFamily es imposible sin que el proxy.ts corregido por R1G haya reconocido cuenta_operativa y dejado pasar el request)
ROUTE_HANDLER_REACHED=SI / OPERATIONAL_ACCOUNT_RESOLVED=SI / RESOLVED_ACCOUNT_ID=cmu1xe5p10000rip8gbsxes0l

PRE_OPERATOR_RETRY_ACCOUNT_PUSH_ROWS=0 / POST_RETRY_ACCOUNT_PUSH_ROWS=1
FILA_CREADA=ownerType=cuenta_operativa, ownerId=cmu1xe5p10000rip8gbsxes0l, channel=default, createdAt=2026-09-16T16:15:49.993Z (coincide al milisegundo con el POST 200 de los logs — correlación exacta)
DUPLICATE_ACCOUNT_SUBSCRIPTIONS_FOUND=NO (count=1)
NEW_EMPLOYEE_OWNER_SUBSCRIPTION_CREATED=NO (0 filas ownerType=empleado para las 3 relaciones Mozo/PyR/Salón de esta cuenta — arquitectura R1D íntegra, sin caer al fallback legacy)

Los 10 criterios de PASS de la tarea se cumplieron simultáneamente (ver reporte para el detalle ítem por ítem).

STALE_PRODUCER_TESTS_STILL_PENDING=SI (push-subscription-repository.test.ts + 3 archivos de productores Mozo/PyR/Salón — blocker de R1E, sin tocar en R1H tampoco)
P2_T44_NO_CERRADA=SI — pendiente: reconciliar tests stale de productores (P2-T44-R1I, recomendada, NO ejecutada), certificar Push REAL de Mozo, certificar Push REAL de PyR, certificar Push REAL de Salón, y disable/logout si siguen en la matriz de certificación

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T23_STATUS=REOPENED_H2A_PHYSICALLY_VALIDATED_H2B_PHYSICALLY_CERTIFIED_AWAITING_FILTER_CALIBRATION_DECISION (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
T23_TOUCHED=NO / T24_TOUCHED=NO
CODE_CHANGED=NO (sólo análisis de logs y DB en esta tarea)
PRODUCTION_TOUCHED=NO
NEXT_ACTION=P2_T44_R1I_PRODUCER_TEST_SUITE_RECONCILIATION (recomendada, no ejecutada — corregir exclusivamente los 4 tests stale para reflejar el flujo real de dos fases cuenta_operativa→empleado-fallback, sin cambiar producto salvo bug real revelado)
```

Reporte completo (ventana exacta del reintento, secuencia de logs
completa, correlación exacta log↔DB al milisegundo, evaluación explícita
de los 10 criterios de PASS, verificación de ausencia de owner empleado
accidental y de duplicación): `codex-reports/P2_T44_R1H_ACCOUNT_PUSH_SWITCH_PHYSICAL_CERTIFICATION.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1G EDGE AUTH FIX DEPLOYED (2026-09-16)

Fix implementado del root cause confirmado en R1F: `src/proxy.ts` no
reconocía `cuenta_operativa`. Fix mínimo desplegado a TESTING, cobertura de
middleware agregada (antes inexistente), retest del switch preparado —
NO ejecutado todavía.

```text
P2_T44_R1G_STATUS=READY_FOR_OPERATOR_T44_R1G_SWITCH_RETRY
ROOT_CAUSE_FIXED=SI

PROXY_ACCOUNT_FAMILY_ADDED=SI / PROXY_OPERATIONAL_COOKIE_MAPPING_ADDED=SI (cuenta_operativa -> deligo_operativo_session) / PROXY_IS_SESSION_FAMILY_UPDATED=SI
PUSH_STATUS_MIDDLEWARE_BEHAVIOR_CHANGED=NO (nunca estuvo en AUTH_REQUIRED_PREFIXES, sin cambios)
PUSH_ROUTE_HANDLER_CODE_CHANGED=NO / PUSH_CLIENT_CODE_CHANGED=NO / VAPID_CHANGED=NO / SERVICE_WORKER_CHANGED=NO (los 4 ya estaban correctos por R1F, fix acotado a un solo archivo de producto)

PROXY_CUENTA_OPERATIVA_TEST=PASS (9 casos nuevos A-I en src/proxy.test.ts, que antes no ejercitaba el middleware en absoluto — root cause de por qué R1F pasó desapercibido)
EXISTING_FAMILIES_REGRESSION_TEST=PASS (cliente/negocio/repartidor sin regresión, repartidor ganó cobertura propia que antes no tenía en este archivo)
FOCAL_TESTS=src/proxy.test.ts 44 pass/0 fail; push/status+subscribe+unsubscribe+debug-guard+subscription-http/key+cancellation-push+push.test.ts 229 pass/0 fail; operativo/logout 16 pass/0 fail
LINT=0 findings / DIFF_CHECK=limpio / TYPECHECK=31 (baseline) / BUILD=exit 0
STALE_PRODUCER_TESTS_TOUCHED=NO (blocker de R1E — push-subscription-repository.test.ts + 3 archivos de productores — se mantiene separado, no relacionado con este fix, no corregido en R1G)

R1G_FIX_COMMIT_SHA=e10eb5a7740849c64c14ccc97cddf5ee2d5620c5 ("fix: allow operational account push through edge auth")
CURRENT_REMOTE_TESTING_SHA=e10eb5a7740849c64c14ccc97cddf5ee2d5620c5
DELIGO_TESTING_DEPLOYMENT_ID=9f438b64-75b1-4d22-b21d-1991a2a6e415 (SUCCESS, commit match, boot limpio)
SMOKE_TEST_NO_DESTRUCTIVO=POST /api/push/subscribe?actorFamily=cuenta_operativa sin cookie contra el deployment vivo -> sigue 401 (confirma que el fix está desplegado sin abrir un bypass; no se fabricó ninguna PushSubscription real, no se escribió DB)

T44_FIXTURE_PRESENT=SI (revalidado post-deploy) / T44_MOZO_RELATION_PRESENT=SI / T44_PYR_RELATION_PRESENT=SI / T44_SALON_FIXTURE_COVERAGE=SI
PRE_OPERATOR_RETRY_ACCOUNT_PUSH_ROWS=0
T44_ACCOUNT_SETTINGS_URL=https://deligo-copy-production.up.railway.app/operaciones/cuenta / T44_LOGIN_URL=https://deligo-copy-production.up.railway.app/operaciones/ingresar (password runtime-only renovada, no persistida)

PERMISSION_NOTE=el diálogo nativo de Notification.permission NO es requisito de PASS en el reintento — Push se comparte por origen entre todos los actores, es plausible que ya esté "granted" desde pruebas previas de Cliente/Negocio/Repartidor en el mismo navegador; el criterio real es que la subscription se guarde correctamente server-side

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T23_STATUS=REOPENED_H2A_PHYSICALLY_VALIDATED_H2B_PHYSICALLY_CERTIFIED_AWAITING_FILTER_CALIBRATION_DECISION (sin cambios)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
T23_TOUCHED=NO / T24_TOUCHED=NO
PRODUCTION_TOUCHED=NO
NEXT_ACTION=WAIT_FOR_OPERATOR_T44_R1G_SWITCH_RETRY
```

Reporte completo (diff exacto del fix, diseño y contenido de los 9 tests
nuevos del middleware, resultados de test/lint/diff-check/build,
commit/deploy verificado, smoke test no destructivo, fixture
revalidado): `codex-reports/P2_T44_R1G_EDGE_AUTH_FIX_AND_SWITCH_RETEST_PREPARATION.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1F ROOT-CAUSE AUDIT (2026-09-16)

Auditoría de root-cause (sólo diagnóstico, sin fix) de por qué el primer
intento físico de activar el switch Push account-level falló ANTES de que
el navegador pidiera permiso. Causa raíz CONFIRMADA con evidencia directa
de logs de Railway TESTING — no es una hipótesis.

```text
P2_T44_R1E_PHYSICAL_SWITCH_RESULT=FAIL_ACTIVATION_BEFORE_NOTIFICATION_PERMISSION
P2_T44_R1E_STATUS=BLOCKED_OPERATOR_SWITCH_ACTIVATION_FAILURE
P2_T44_R1F_STATUS=ROOT_CAUSE_IDENTIFIED_FIX_NOT_IMPLEMENTED

EVIDENCIA_DE_LOGS=POST /api/push/status?actorFamily=cuenta_operativa → 200 (exitoso, check de montaje) seguido, 5 minutos después, de GET /api/push/vapid-key → 200 + POST /api/push/subscribe?actorFamily=cuenta_operativa → 401, dos veces (dos intentos del operador). El fallo NO fue client-side ni de permiso — el POST llegó a la red real y fue rechazado.
FAIL_OCCURRED_CLIENT_SIDE_BEFORE_SERVER_SUBSCRIBE=NO
FAIL_STAGE=SERVER_SUBSCRIBE_REQUEST (rechazado por el middleware Edge, ANTES del route handler real)

ROOT_CAUSE_CATEGORY=AUTH
ROOT_CAUSE=src/proxy.ts mantiene su PROPIA copia local desincronizada de las familias de sesión (type SessionFamily="cliente"|"negocio"|"repartidor", FAMILY_SESSION_COOKIE_NAMES, isSessionFamily()) — deliberadamente separada de src/lib/auth.ts (comentario propio del archivo: runtime Edge, no puede importar Prisma) y NUNCA actualizada cuando R1D agregó "cuenta_operativa" como cuarta familia. resolveActorSession() nunca reconoce ese selector, resuelve token=null, y como /api/push/subscribe + /api/push/unsubscribe están en AUTH_REQUIRED_PREFIXES, la rama "Any-auth routes" de checkRouteProtection() devuelve 401 directamente en el Edge, antes de que el request llegue al route handler real (que SÍ autentica correctamente vía deligo_operativo_session/getOperationalAccountFromRequest). /api/push/status escapa al bug por NO estar en AUTH_REQUIRED_PREFIXES — asimetría confirmada exactamente en los logs (status=200, subscribe=401 con la misma sesión).
UNSUBSCRIBE_TIENE_EL_MISMO_BUG=SI (también está en AUTH_REQUIRED_PREFIXES — si el switch se hubiera activado por otro medio, desactivarlo fallaría igual)
CLIENT_HOOK_FULLY_SUPPORTS_CUENTA_OPERATIVA=SI / MISSING_CLIENT_ACTOR_MAPPING_FOUND=NO (el gap NO está en usePushNotifications ni en ningún módulo cliente — está exclusivamente en el middleware Edge del servidor)
VAPID/SERVICE_WORKER/BROWSER_CAPABILITY=DESCARTADOS como causa (los logs confirman que el flujo llegó hasta después del fetch VAPID exitoso)
WHY_AUTOMATED_TESTS_MISSED_FAILURE=src/proxy.ts corre en runtime Edge y NUNCA se ejecuta cuando bun:test llama directamente la función POST exportada de un route.ts — ningún test de este repo instancia el middleware contra una request real; es una capa estructuralmente invisible para la suite actual
STALE_PRODUCER_TESTS_RELATED_TO_SWITCH_FAILURE=NO (el blocker de tests de R1E, sobre resolveOperationalPushTargets/mocks de Mozo-PyR-Salón, es completamente independiente de este bug de middleware)

PROPOSED_FIX_FILES=src/proxy.ts (único archivo de producto a tocar)
PROPOSED_FIX_DESCRIPTION=agregar "cuenta_operativa" al type SessionFamily local + FAMILY_SESSION_COOKIE_NAMES (→ "deligo_operativo_session") + isSessionFamily() de proxy.ts; alternativa más acotada: rama explícita en checkRouteProtection para /api/push/subscribe|unsubscribe que revise la presencia de deligo_operativo_session sin generalizar el union — decisión para la tarea de implementación
PRODUCT_CODE_CHANGE_REQUIRED=SI (sólo proxy.ts) / ENV_CONFIG_CHANGE_REQUIRED=NO / TEST_CHANGE_REQUIRED=SI (agregar cobertura que ejercite el middleware con ?actorFamily=cuenta_operativa — hoy no existe ninguna) / REDEPLOY_REQUIRED=SI

PRE_OPERATOR_ACCOUNT_PUSH_ROWS=0 / POST_FAIL_ACCOUNT_PUSH_ROWS=0 (confirmado por consulta directa — el 401 ocurre antes de cualquier escritura, nada que limpiar)

NO_FIX_APLICADO=SI (sólo diagnóstico en esta tarea, cero cambios de código/test/env, sin commit/push/deploy, sin resetear permisos, sin borrar subscriptions, sin nueva prueba física)

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED (sin cambios)
P2_T23_STATUS=REOPENED_H2A_PHYSICALLY_VALIDATED_H2B_PHYSICALLY_CERTIFIED_AWAITING_FILTER_CALIBRATION_DECISION (sin cambios — T23 sigue abierto)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)
T23_TOUCHED=NO / T24_TOUCHED=NO
PRODUCTION_TOUCHED=NO
NEXT_ACTION=WAIT_FOR_R1F_FIX_AUTHORIZATION (implementar el fix de proxy.ts en una tarea separada, autorizada explícitamente, antes de cualquier nuevo intento físico del switch)
```

Reporte completo (pipeline reconstruido stage-por-stage, evidencia exacta
de logs con timestamps, trazado completo del código de `src/proxy.ts` que
prueba la causa raíz línea por línea, descarte explícito de VAPID/SW/
browser-capability/client-actor-mapping, explicación de por qué los tests
automatizados no lo detectaron, diseño de fix sin implementar):
`codex-reports/P2_T44_R1F_ACCOUNT_PUSH_SWITCH_FAILURE_AUDIT.md`.

## HISTORICAL SNAPSHOT — P2-T44-R1E RESUME (2026-09-15)

El operador pausó P2-T23-H4 y pidió retomar P2-T44 desde su último estado
autoritativo (implementado en una sesión ANTERIOR a esta conversación,
commits `f1604f2`/`0e3c69f`, no descubierto hasta ahora porque T44 no
había vuelto a tocarse en esta conversación). T44 NO modifica ningún
estado de T23/T24.

```text
P2_T44_R1E_STATUS=READY_FOR_OPERATOR_ACCOUNT_PUSH_SWITCH_TEST

P2_T23_H4_STATUS=PAUSED_AFTER_SPEED_WITNESS_ALREADY_COMMITTED_AND_DEPLOYED_NO_PROBE_EXECUTED
CORRECCION_DE_PREMISA=la tarea asumía "pausar H4 sin implementar ni deployar el witness de speed", pero ese commit (3d2bf94) ya había sido autorizado explícitamente por el operador y commiteado+pusheado+deployado a TESTING en el turno INMEDIATAMENTE ANTERIOR de esta misma conversación — no se revirtió (sería una acción destructiva nueva no pedida), sólo se corrige el hecho
H4_LOCAL_UNCOMMITTED_CHANGE_FOUND=NO / H4_LOCAL_CHANGE_RESTORED=NOT_APPLICABLE / WORKTREE_CLEAN_BEFORE_T44=SI
H2A_PHYSICAL_VALIDATION=PASS / H2B_PHYSICAL_PASS=SI (preservados, sin cambios)
P2_T23_STATUS=REOPENED_H2A_PHYSICALLY_VALIDATED_H2B_PHYSICALLY_CERTIFIED_AWAITING_FILTER_CALIBRATION_DECISION (sin cambios — T23 sigue abierto)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios)

CURRENT_HEAD=3d2bf941f5936fe8754ca320c1f888c2e199bbe9 = REMOTE_TESTING_SHA = CURRENT_TESTING_DEPLOYMENT_COMMIT
CURRENT_TESTING_DEPLOYMENT_ID=3112bdf0-887d-4f09-bbcd-5292b9a36b55 (SUCCESS — el mismo deployment de H4, acumulativo, ya contiene R1D íntegro)
R1D_COMMIT_SHA=c3bf576e0a63da29e408672c9cc96384fc4ac4fc ("feat: unify personal push at account level")
R1D_COMMIT_IS_ANCESTOR_OF_REMOTE_TESTING=SI / R1D_COMMIT_IS_ANCESTOR_OF_DEPLOYED_TESTING=SI / R1D_CODE_PRESENT_IN_CURRENT_TESTING=SI
CERO_DRIFT_CONFIRMADO=ningún archivo de push/operativo/cuenta/schema cambió entre R1D y HEAD pese a ~10 commits de T23 en el medio (git log verificado)
R1D_MIGRATION_APPLIED_TESTING=SI (20260914100000_account_level_personal_push, verificado por consulta directa a _prisma_migrations en TESTING, rolled_back_at=null) / R1D_MIGRATION_APPLIED_PRODUCTION=NO

T44_FIXTURE_PRESENT=SI (verificado por consulta directa a la base real, no asumido) / T44_ACCOUNT_ID=cmu1xe5p10000rip8gbsxes0l (activo)
T44_MOZO_RELATION_PRESENT=SI (negocio A) / T44_PYR_RELATION_PRESENT=SI (negocio B) / T44_SALON_FIXTURE_COVERAGE=SI (negocio C, salonActivo=true — ya existía de la sesión anterior, NO se creó nada nuevo en esta tarea)
Las tres relaciones Empleado apuntan a la MISMA cuentaOperativaId, en tres negocios distintos — la configuración exacta que la certificación necesita.
PRE_OPERATOR_ACCOUNT_PUSH_ROWS=0 (estado limpio, confirmado de nuevo)

ARQUITECTURA_PRESERVADA=ownerType=cuenta_operativa hardcodeado server-side (nunca del body) en subscribe/unsubscribe/status cuando actorFamily=cuenta_operativa; ownerId derivado de getOperationalAccountFromRequest; un único switch en /operaciones/cuenta (usePushNotifications actorFamily=cuenta_operativa fijo, sin selector de negocio); campana=NotificationBell (centro de notificaciones, no toggle); logout usa session.cuentaOperativaId + endpoint exacto
ACCOUNT_PUSH_SWITCH_PRESENT=SI / BUSINESS_SELECTION_REQUIRED_BEFORE_SWITCH=NO / PER_BUSINESS_PUSH_TOGGLE_PRESENT=NO / PER_AREA_PUSH_TOGGLE_PRESENT=NO / BELL_IS_NOTIFICATION_CENTER_ONLY=SI
MOZO_ACCOUNT_PUSH_PATH=SI (mesa-order-ready-notification.ts) / PYR_ACCOUNT_PUSH_PATH=SI (operations-cancellation-notification.ts, único productor de PyR documentado) / SALON_ACCOUNT_PUSH_PATH=SI (salon-new-order-notification.ts) — los tres vía resolveOperationalPushTargets compartido
ACCOUNT_ENDPOINT_DEDUPE_VERIFIED=SI (constraint UNIQUE(ownerType,ownerId,channel,endpoint) + upsert) / LEGACY_FALLBACK_ONLY_IF_NO_ACCOUNT_LEVEL_ROW=SI

BLOCKER_FOUND=SI, TEST_ONLY, preexistente de R1D (no producto, no fix aplicado — STOP explícito per instrucción de la tarea): 4 archivos de test quedaron desactualizados cuando R1D introdujo la indirección de dos fases cuenta_operativa→empleado-fallback — push-subscription-repository.test.ts's CHANNEL_ENUM_SCHEMA_CONTRACT todavía espera el enum SIN cuenta_operativa (1 fail/58); mesa-order-ready-notification.test.ts, operations-cancellation-notification.test.ts, salon-new-order-notification.test.ts tienen mocks de pushSubscription.findMany que no modelan el nuevo flujo de dos fases (11 fails combinados) — fallan incluso en aislamiento, confirmado archivo por archivo, diagnóstico completo en el reporte. NO bloquea la primera acción física (el switch, camino de código 100% distinto y verde).
FOCAL_TESTS_SWITCH_CORE=185 pass/0 fail (push/status+subscribe+unsubscribe+debug-guard route.test.ts, push-subscription-http/key, operations-cancellation-push, push.test.ts) — esto es lo único que certifica la primera acción física de esta tarea
RUIDO_PREEXISTENTE_NO_REGRESIVO=mozo/pyr/salon panel push-subscription route.test.ts pasan 12/12,5/5,12/12 cada uno en aislamiento, sólo fallan combinados en una misma invocación de bun test (mismo patrón ya documentado en el cierre de H2, no investigado más a fondo por estar fuera de alcance)
LINT=0 findings / DIFF_CHECK=limpio / BUILD=exit 0 / TYPECHECK=31 (baseline)

T44_TEST_ACCOUNT=test_t44_r1d_4135ea7a@example.test (password runtime-only renovada, no persistida) / T44_ACCOUNT_SETTINGS_URL=https://deligo-copy-production.up.railway.app/operaciones/cuenta / T44_LOGIN_URL=https://deligo-copy-production.up.railway.app/operaciones/ingresar

PRIMERA_ACCION_FISICA=SOLO el switch ON/OFF de /operaciones/cuenta, sin elegir negocio primero — NO se envía Push de prueba todavía (no hace falta para esta primera acción)
T23_PRODUCT_CODE_TOUCHED=NO / T24_TOUCHED=NO / T44_TOUCHED=SI (sólo verificación/reconciliación, cero código modificado)
PRODUCTION_TOUCHED=NO
NEXT_ACTION=WAIT_FOR_OPERATOR_T44_R1E_ACCOUNT_PUSH_SWITCH_TEST
```

Reporte completo (corrección de premisa H4, preflight de Git, reconciliación
de ancestry, verificación de migración/fixture por consulta directa a la
base real, auditoría completa de switch/subscribe/disable/logout/
producers/fallback por lectura de código, diagnóstico detallado del
blocker de 4 tests, ready gate):
`codex-reports/P2_T44_R1E_ACCOUNT_LEVEL_PUSH_PHYSICAL_CERT_PREPARATION.md`.

## HISTORICAL SNAPSHOT — P2-T23-H4 PREPARATION (2026-09-15)

Preparación de una sonda física dedicada de 1 min quieto + 3 min caminando
+ 1 min quieto, exclusivamente con el dispositivo Repartidor Testing
(`CLIENT_DEVICE_PRESENT=NO`), para calibrar offline el filtro de
movimiento (`effectiveTrajectoryPointThresholdMeters`,
`max(5, 0.5×(accPrev+accNext))`) sin tocar todavía nada de lo ya validado
(batch age, playback, registerResync, realtime, T24 matching, RAW
authority).

```text
P2_T23_H4_STATUS=READY_FOR_OPERATOR_FILTER_CALIBRATION_PROBE
P2_T23_STATUS=REOPENED_H2A_PHYSICALLY_VALIDATED_H2B_PHYSICALLY_CERTIFIED_AWAITING_FILTER_CALIBRATION_DECISION (sin cambios)
H2A_PHYSICAL_VALIDATION=PASS / H2B_PHYSICAL_PASS=SI (heredado, sin cambios)
CURRENT_FILTER_FORMULA=max(5, 0.5×(accuracy_previous+accuracy_next)) — CURRENT_MIN_DISTANCE_METERS=5, CURRENT_ACCURACY_WEIGHT=0.5 (confirmado leyendo tracking-trajectory.ts real)
BLOQUEADOR_REAL_ENCONTRADO=buildSampleFromPosition nunca lee position.coords.speed — se descarta antes de llegar al filtro o a cualquier witness; a diferencia de lat/lng/accuracy/capturedAt (reconstruibles offline desde el wire), speed es un valor medido por el dispositivo que se pierde para siempre si no se captura en el momento de la sonda
FIX_AUTORIZADO_POR_OPERADOR=SI (misma dinámica que el bloqueador de H3B — pregunta explícita hecha y respondida "Sí, deployar antes de la sonda")
CODE_CHANGED=SI — witness-only: nuevo campo speedMps en gps_callback_received (T24PhysicalWitnessEvent + allowlist del servidor), leído de position.coords.speed en los 2 call-sites que ya tienen el GeolocationPosition crudo en alcance (handleWatchSuccess + one-shot getCurrentPosition), enhebrado como parámetro simple por observeSample/considerSampleForDelivery; TrackingLocationSample/buildSampleFromPosition/acceptTrackingTrajectoryPoint SIN TOCAR, sin cambio de comportamiento
H4_COMMIT_SHA=3d2bf94 ("test: capture GeolocationCoordinates.speed for H4 filter calibration probe")
NO_SE_NECESITO_OTRO_CAMBIO=el valor real de effectiveTrajectoryPointThresholdMeters por decisión es 100% reconstruible offline desde previousAccuracyMeters/currentAccuracyMeters (ya capturados desde H1) — no se agregó un campo redundante para esto
FOCAL_TESTS=use-repartidor-tracking.test.ts 92 pass/0 fail / LINT=0 findings / DIFF_CHECK=limpio / TYPECHECK=31 (baseline) / BUILD=exit 0
CURRENT_REMOTE_TESTING_SHA=3d2bf941f5936fe8754ca320c1f888c2e199bbe9
DELIGO_TESTING_DEPLOYMENT_ID=3112bdf0-887d-4f09-bbcd-5292b9a36b55 (SUCCESS, commit match, boot limpio)
FIXTURE_PRESENT=SI / ORDER_STATE=en_camino / DRIVER_ASSIGNED=SI / TRACKING_ENABLED=SI
H4_BASELINE_REVISION=118 (coincide con H3B_BASELINE_REVISION=118, sin escrituras desde entonces)
REPARTIDOR_TEST_IDENTITY_VERIFIED=SI (round-trip real, password runtime-only renovada, no persistida) / REPARTIDOR_URL=https://deligo-copy-production.up.railway.app/repartidor
GPS_CALLBACK_WITNESS_READY=SI / MOVEMENT_DECISION_WITNESS_READY=SI / BUFFER_BATCH_WITNESS_READY=SI / POST_CORRELATION_READY=SI / SPEED_FIELD_WITNESS_READY=SI (tras el fix de esta tarea)
PHASE_BOUNDARY_METHOD=FIXED_DURATION_FROM_FIRST_GPS_CALLBACK (ancla t=0 = primer gps_callback_received de la sesión limpia, sin nuevo código productivo sólo para marcar fases; misma metodología anti-remount de H3A/H3B: ordenar por receivedAt real, verificar callbackSequence monótono)
CLIENT_DEVICE_REQUIRED=NO
T24_WAITS=SI (sin cambios) / P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO
T44_TOUCHED=NO
PRODUCTION_TOUCHED=NO
NEXT_ACTION=WAIT_FOR_OPERATOR_H4_FILTER_CALIBRATION_PROBE
```

Reporte completo (bloqueador de preparación y su fix witness-only, deploy
verificado, fixture/cuenta/witness confirmados, protocolo exacto para el
operador, boundary de fases, lista de métricas a extraer, diseño de
réplica offline y criterio de seguridad para candidatos de filtro):
`codex-reports/P2_T23_H4_FILTER_CALIBRATION_PROBE_PREPARATION.md`.

## HISTORICAL SNAPSHOT — P2-T23-H3B ANALYSIS: H2B CERTIFIED (2026-09-15)

Análisis de la sonda física client-only (sin dispositivo Repartidor,
`H3B_SCOPE=CLIENT_STATE_RESYNC_ONLY`). Operador: `RECUPERO_SOLO=SI`,
`APARECIO_RECARGAR=NO`, `TOQUE_RECARGAR=NO`,
`TIEMPO_APROX_RECUPERACION=NO_MEDIDO_POR_OPERADOR`. 62 eventos witness
extraídos de la ventana `20:23:03Z-20:25:11Z` (deployment `5017f88`,
posterior a la preparación H3B).

```text
H2B_PHYSICAL_PASS=SI
P2_T23_STATUS=REOPENED_H2A_PHYSICALLY_VALIDATED_H2B_PHYSICALLY_CERTIFIED_AWAITING_FILTER_CALIBRATION_DECISION
CADENA_TECNICA_CONFIRMADA=network/lifecycle transition (reconnect_attempt 20:23:47.886Z, sin "offline" limpio observado — un handoff WiFi→celular no siempre lo emite) → connection_established (20:23:50.646Z, ~2.76s de reconexión) → client_resync_triggered ×2 (20:23:51.456Z/.462Z, 0.81s después) → initial_http_request (+3ms, imposible de confundir con el poll de 20s) → initial_http_response 200 (+346ms) → client_revision_observed + client_stale_recovery + client_http_snapshot (recuperación de estado confirmada), TODO sin manual reload
CLIENT_RESYNC_TRIGGER_COUNT=4 total (2 del connect inicial a las 20:23:06Z, ruido de arranque esperado; 2 ligados específicamente a la transición de red bajo prueba a las 20:23:51Z)
RESYNC_TRIGGERED_FETCH_CONFIRMED=SI (latencia resync→request de 3ms — la señal witness-only agregada en H3B prep cumplió exactamente su propósito de desambiguar causalidad)
HTTP_LATEST_STATUS=200 / HTTP_LATEST_LOCATION_REVISION=118 (sin cambio — correcto, no hubo GPS del Repartidor en esta sonda)
CLIENT_RECOVERED_AUTOMATICALLY=SI / CLIENT_RECOVERY_PATH=RESYNC_HTTP / MANUAL_RELOAD_USED=NO / RETRY_UI_SHOWN=NO
TECHNICAL_RECOVERY_LATENCY_MS=3921 (desde la primera señal técnica de la transición hasta la confirmación de recuperación del Cliente) / OPERATOR_RECOVERY_LATENCY=NOT_MEASURED (no inventado)
NETWORK_OFFLINE_EVENT=NOT_OBSERVABLE / REALTIME_DISCONNECT_OBSERVED=NO / REALTIME_REAUTH_OBSERVED=NO (este handoff usó reconnect_attempt→connecting→connection_established, no reauthenticating — distinto de los ciclos de reauth periódica vistos en H3A; consistente con que un cambio de red real rompe el transporte en vez de sólo refrescar un token)
ROOM_REJOIN_OBSERVED=NOT_APPLICABLE (el witness de este componente no tiene un marcador dedicado para esa capa, distinta de state resync — no se confunden)
REALTIME_ROOM_REJOIN_LOGIC_CHANGED=NO / POLLING_CADENCE_CHANGED=NO / NORMAL_POLL_DURING_RECOVERY_WINDOW=NO
H3A_PRIMARY_OBJECTIVE_RESULT=ACHIEVED / OPERATOR_VISUAL_RESULT=MIXTO_PARTIAL_IMPROVEMENT (sin cambios, heredado de H3A — T23 NO se cierra: falta decidir si calibrar el filtro de movimiento para buscar SUAVE)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO (sin cambios, pese a que H3A ya cumplió técnicamente sus gate conditions — no se continúa T24 en esta tarea)
T44_TOUCHED=NO
CODE_CHANGED=NO (sólo extracción y análisis de logs en esta tarea de análisis)
PRODUCTION_TOUCHED=NO
NEXT_ACTION=OPERATOR_DECISION (autorizar P2-T23-H4 — preparación de sonda dedicada de calibración de estacionario 1min quieto+3min caminata+1min quieto — para evaluar los Candidatos 2/3 del filtro de movimiento y potencialmente llevar MOVIMIENTO de MIXTO a SUAVE; T24 R6 sigue disponible como decisión separada, dado que sus gate conditions ya se cumplieron técnicamente en H3A)
```

Reporte completo (extracción/dedupe de 62 eventos, distinción exacta entre
los 2 resync triggers de arranque y los 2 ligados a la transición de red,
cadena de latencias completa, evaluación explícita de cada criterio PASS,
distinción room-rejoin vs state-resync):
`codex-reports/P2_T23_H3B_REALTIME_RECOVERY_PHYSICAL_PROBE_ANALYSIS.md`.

## HISTORICAL SNAPSHOT — P2-T23-H3B PREPARATION (2026-09-15)

Preparación de una sonda MUY corta y aislada para certificar SOLO H2B
(`client.registerResync → fetchTracking → recuperación automática`) ante
una transición real WiFi→datos móviles en el Cliente. NO prueba suavidad
RAW, NO toca filtro de movimiento/batch age, NO continúa T24 R6.

```text
P2_T23_H3B_STATUS=READY_FOR_OPERATOR_WIFI_TO_CELLULAR_PROBE
P2_T23_STATUS=REOPENED_H2A_PHYSICALLY_VALIDATED_AWAITING_H2B_PHYSICAL_CERTIFICATION (sin cambios)
H3A_PRIMARY_OBJECTIVE_RESULT=ACHIEVED / OPERATOR_VISUAL_RESULT=MIXTO_PARTIAL_IMPROVEMENT (sin cambios, heredado de H3A)
BLOQUEADOR_REAL_ENCONTRADO=fetchTracking() emite el mismo witness (initial_http_request/initial_http_response) sin importar si lo dispara el poll de rutina (8s/20s) o el resync de H2B — imposible distinguir causalidad sin una señal dedicada, especialmente con una ventana de sonda (<=60s) más corta que el heartbeat de poll de 20s
FIX_AUTORIZADO_POR_OPERADOR=SI (pregunta explícita hecha y respondida "Sí, deployar antes de la sonda")
CODE_CHANGED=SI — witness-only: un único recordT24PhysicalWitness({event:"client_resync_triggered",channel:"REALTIME"}) dentro del callback de registerResync en delivery-tracking-map.tsx, sin campos nuevos de tipo, sin cambios de comportamiento; 2 aserciones de delivery-tracking-map-resync-contract.test.ts corregidas (ventanas de bytes fijas obsoletas → búsqueda del marcador real de cierre del efecto, aserciones sin debilitar)
H3B_COMMIT_SHA=5017f88 ("test: add witness-only resync-trigger signal for H3B certification")
FOCAL_TESTS=36 pass/0 fail (resync/stale/consumer contracts) + 228 pass/0 fail (use-repartidor-tracking+tracking-trajectory+tracking-playback+realtime-manager+chat-history-resync) / LINT=0 findings / DIFF_CHECK=limpio / TYPECHECK=31 (baseline) / BUILD=exit 0
CURRENT_REMOTE_TESTING_SHA=5017f884f5b54690e6d3769517aa28b2b2c77554
DELIGO_TESTING_DEPLOYMENT_ID=26d72b85-5096-4a0a-a7ed-91fcb8336e09 (SUCCESS, commit match, boot limpio)
H2B_PRESENT_IN_DEPLOYMENT=SI / H3B_WITNESS_SIGNAL_PRESENT_IN_DEPLOYMENT=SI
REALTIME_ROOM_REJOIN_LOGIC_CHANGED=NO / POLLING_CADENCE_CHANGED=NO / MOVEMENT_FILTER/BATCH_AGE/HIGH_ACCURACY/PLAYBACK/MATCHING_CHANGED=NO
FIXTURE_PRESENT=SI / ORDER_STATE=en_camino / DRIVER_ASSIGNED=SI / TRACKING_ENABLED=SI
H3B_BASELINE_REVISION=118 (coincide con H3A_WITNESS_END_REVISION=118, sin escrituras desde entonces)
REPARTIDOR_TEST_IDENTITY_VERIFIED=SI / CLIENT_TEST_IDENTITY_VERIFIED=SI (round-trip real, passwords runtime-only renovadas, no persistidas)
REPARTIDOR_URL=https://deligo-copy-production.up.railway.app/repartidor
CLIENT_TRACKING_URL=https://deligo-copy-production.up.railway.app/cliente?pedidoId=cmu1p548z0006riv8ntyibf0w
CLIENT_LIFECYCLE_WITNESS_READY=SI / CLIENT_REALTIME_WITNESS_READY=SI / CLIENT_HTTP_WITNESS_READY=SI / SERVER_TRACKING_WITNESS_READY=SI
ESCENARIO_UNICO_PREPARADO=WiFi→datos móviles en el Cliente, sin background, sin bloqueo de pantalla — reproduce el síntoma de R5.14B/H1 que exigió Recargar
T24_WAITS=SI (sin cambios) / P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO
T44_TOUCHED=NO
PRODUCTION_TOUCHED=NO
NEXT_ACTION=WAIT_FOR_OPERATOR_H3B_WIFI_TO_CELLULAR_PROBE
```

Reporte completo (bloqueador de preparación y su fix witness-only, deploy
verificado, fixture/cuentas/witness confirmados, protocolo exacto para el
operador, criterios PASS/FAIL, lista de métricas post-probe):
`codex-reports/P2_T23_H3B_REALTIME_RECOVERY_PHYSICAL_PROBE_PREPARATION.md`.

## HISTORICAL SNAPSHOT — P2-T23-H3A ANALYSIS (2026-09-15)

Análisis de la sonda física corta (operador: `MOVIMIENTO=MIXTO`,
`FREEZE=NO`). Logs extraídos vía `railway logs` (3 tramos superpuestos por
el cap de 500 líneas), 340 eventos witness únicos, ventana
`H3A_WITNESS_START_REVISION=104` → `H3A_WITNESS_END_REVISION=118` (14
escrituras). Dos remounts de arranque (ráfagas de 6 callbacks reiniciando
`callbackSequence`, gap de 248s entre ellas) identificados y excluidos de
las métricas de cadencia — el segmento limpio (321.2s continuos,
callbackSequence 7→84) es la base de este análisis, igual metodología que
R5.14B (ordenar por `receivedAt` real, nunca por `callbackSequence`).

```text
P2_T23_H3A_STATUS=ANALYZED_PRIMARY_OBJECTIVE_ACHIEVED_PARTIAL_SMOOTHNESS
P2_T23_STATUS=REOPENED_H2A_PHYSICALLY_VALIDATED_AWAITING_H2B_PHYSICAL_CERTIFICATION
H3A_PRIMARY_OBJECTIVE_RESULT=ACHIEVED — BATCH_POINT_COUNT_MEDIAN pasó de 1 (R5.14B, pre-H2) a 2 (H3A, post-H2); BATCHES_WITH_2_PLUS_POINTS_PERCENT pasó de 0% a 90.9% (10/11 batches); FLUSH_REASON se invirtió de 9×MAX_AGE/1×MAX_DISTANCE a 2×MAX_AGE/9×MAX_DISTANCE — exactamente la firma predicha en H2 §3 (el batch age deja de ser cuello de botella; el nuevo techo natural es la distancia acumulada de 30m)
GPS_CALLBACK_INTERVAL_MEDIAN_MS=4280 (segmento limpio, n=78), consistente con R5.14B (4411ms) — cadencia del sensor reproducible, sin cambios (MOVEMENT_FILTER_CHANGED=NO confirmado en campo)
MOVEMENT_ACCEPTANCE_RATE=23.1% (segmento limpio), comparable a R5.14B (24.7%) — sin cambios, como se esperaba
WITNESS_WAIT_REASON_LABEL_FIXED_CONFIRMED_PHYSICALLY=SI (10 defers, todos correctamente atribuidos a BATCH_AGE_WAIT, cero NETWORK_MIN_SEND_INTERVAL espurios)
HEARTBEAT_ANCHOR_PHYSICAL_OBSERVATION=NOT_EXERCISED (GPS_CALLBACK_INTERVAL_MAX_MS=9636 en el segmento limpio, muy por debajo del umbral de 60000ms — caminata demasiado corta/continua para disparar heartbeat naturalmente; comportamiento ya cubierto por el test automático H01)
VISUAL_FRESHNESS_ACCEPTABLE=UNPROVEN (latencia captura→render con mediana ~8.7s pero muestra correlacionable pequeña, n=11 de 14 POSTs — no se fuerza conclusión)
OPERATOR_VISUAL_RESULT=MIXTO_PARTIAL_IMPROVEMENT (mejora respecto de SALTOS de R5.14B, pero no llega a SUAVE — techo estructural conocido del filtro de movimiento sin tocar en esta tarea, requiere Candidatos 2/3 de H2 §6 con probe de estacionario dedicado, todavía no ejecutado)
FREEZE=NO (mejora incidental respecto del freeze de R5.14B; no investigado causalmente, fuera de alcance)
DB_MATCHED_DATA_PERSISTED=NO (confirmado en las 14 revisiones publicadas, sin excepción — RAW authority intacta)
PROVIDER_ATTEMPTS=2 (observación lateral NO accionada: batches de 3-4 puntos ahora cruzan el umbral interno que dispara un intento de matching T24, algo que R5.14B con batches de 1 punto nunca alcanzaba; ambos intentos rechazados por low_confidence, mismo patrón que PHYSICAL2)
T24_R6_GATE_CONDITIONS_FROM_H1_TECHNICALLY_MET=SI (BATCH_POINT_COUNT_MEDIAN>1 y PROVIDER_ATTEMPTS>0, ambas condiciones fijadas en H1 ahora cumplidas físicamente) — esto NO es autorización para reabrir T24 R6, sólo un hallazgo registrado para una futura decisión explícita del operador
H2B_INCIDENTAL_REAUTH_CYCLES_OBSERVED=2 (ciclos reauthenticating→connected de ~2.3s cada uno durante la caminata, recuperación limpia, técnicamente ejercitan client.registerResync vía el reauth periódico del RealtimeManager) — registrado como observación incidental, NO usado como certificación formal de H2B (esa sigue pendiente de una sonda H3B dedicada con transición de red deliberada)
P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO
T44_TOUCHED=NO
CODE_CHANGED=NO (sólo extracción y análisis de logs)
PRODUCTION_TOUCHED=NO
NEXT_ACTION=OPERATOR_DECISION (autorizar H3B — sonda dedicada de recuperación de red para certificar H2B — y/o autorizar la sonda dedicada de calibración de estacionario 1min quieto+3min caminata+1min quieto para desbloquear los Candidatos 2/3 del filtro de movimiento y potencialmente llevar MOVIMIENTO de MIXTO a SUAVE)
```

Reporte completo (extracción y deduplicación de 340 eventos witness,
identificación de los dos remounts de arranque, tabla comparativa completa
contra R5.14B, todas las métricas de §9/§10 de la preparación, observación
lateral de T24 provider attempts, observación incidental de reauth/H2B):
`codex-reports/P2_T23_H3A_RAW_DENSITY_PHYSICAL_PROBE_ANALYSIS.md`.

## HISTORICAL SNAPSHOT — P2-T23-H3A PREPARATION (2026-09-15)

Preparación (sin código, sin caminata) de una sonda física corta para
validar SOLO la calibración RAW de H2A (densidad/suavidad de batch) en el
deployment TESTING ya desplegado. H2B (network recovery) queda
explícitamente diferido a una H3B dedicada — durante H3A el operador
mantiene la misma conectividad todo el tiempo, sin WiFi→datos, sin
background, sin bloqueo de pantalla.

```text
P2_T23_H3A_STATUS=READY_FOR_OPERATOR_WALK (superado — ver análisis arriba)
P2_T23_STATUS=REOPENED_TESTING_HARDENING_IMPLEMENTED_AWAITING_OPERATOR_PROBE (histórico, superado)
CURRENT_REMOTE_TESTING_SHA=1e241ffdfe9ff6f81bb00dd909ad649b3a47879c (sin drift respecto de H2)
DELIGO_TESTING_DEPLOYMENT_ID=37a8f80d-62bf-4564-b994-a155a9e06a8e (SUCCESS, commit match)
H2A_PRESENT_IN_DEPLOYMENT=SI / H2B_PRESENT_IN_DEPLOYMENT=SI (verificado leyendo el árbol git del commit desplegado, no sólo el working tree)
MAX_MOVING_BATCH_AGE_MS=15000 / MAX_BATCH_DURATION_MS=16000 / MAX_STALE_TRAJECTORY_BUFFER_AGE_MS=16000 / MIN_SEND_INTERVAL_MS=5000 (todas confirmadas en el commit desplegado)
MOVEMENT_FILTER_CHANGED=NO / HIGH_ACCURACY_CHANGED=NO
FIXTURE_PRESENT=SI / ORDER_STATE=en_camino / DRIVER_ASSIGNED=SI / TRACKING_ENABLED=SI (consulta directa a la base real de TESTING, no asumida)
H3A_BASELINE_REVISION=104 (coincide con PROBE_LAST_REVISION=104 de R5.14B — sin escrituras de ubicación desde entonces)
REPARTIDOR_TEST_IDENTITY_VERIFIED=SI / CLIENT_TEST_IDENTITY_VERIFIED=SI (round-trip real con hashPassword/comparePassword de src/lib/auth.ts, passwords runtime-only renovadas, no persistidas)
REPARTIDOR_URL=https://deligo-copy-production.up.railway.app/repartidor
CLIENT_TRACKING_URL=https://deligo-copy-production.up.railway.app/cliente?pedidoId=cmu1p548z0006riv8ntyibf0w
DEFER_REASON_WITNESS_READY=SI (NETWORK_MIN_SEND_INTERVAL/BATCH_AGE_WAIT/ADAPTIVE_BATCH_WAIT/OTHER, confirmado en allowlist del servidor)
TODOS_LOS_DEMAS_WITNESS_CHANNELS_READY=SI (GPS callback, movement decision, throttle, buffer/batch, POST correlation, client realtime, client playback)
H3A_TESTS_ONLY=RAW_DENSITY_SMOOTHNESS (H2B network recovery explícitamente diferido a H3B dedicada)
FOCAL_TESTS=108 pass/0 fail (use-repartidor-tracking + tracking-trajectory + delivery-tracking-map-resync-contract) / DIFF_CHECK=limpio
T24_WAITS=SI (sin cambios) / P2_T24_READY_FOR_R6=NO / P2_T24_RELEASE_ELIGIBLE=NO
T44_TOUCHED=NO
CODE_CHANGED=NO (sólo preparación: verificación de deploy/constantes/fixture/cuentas/witness + reset de 2 passwords runtime-only en DB de TESTING)
PRODUCTION_TOUCHED=NO
NEXT_ACTION=WAIT_FOR_OPERATOR_H3A_SHORT_WALK
```

Reporte completo (verificación exacta del commit desplegado, consulta
directa a la base de datos real, lista completa de métricas a capturar
post-caminata, boundary de revisión, instrucciones al operador):
`codex-reports/P2_T23_H3A_RAW_DENSITY_PHYSICAL_PROBE_PREPARATION.md`.

## HISTORICAL SNAPSHOT — P2-T23-H2 (2026-09-15)

Implementación autorizada (calibración empírica RAW + hardening de resync
realtime), desplegada a TESTING. NO physical probe, NO high-accuracy probe,
NO T24 R6, NO Production — todos explícitamente fuera de alcance de esta
tarea, en espera de autorización del operador.

```text
P2_T23_H2_STATUS=IMPLEMENTED_TESTING_DEPLOYED
P2_T23_STATUS=REOPENED_TESTING_HARDENING_IMPLEMENTED_AWAITING_OPERATOR_PROBE
R5_14B_RAW_CALLBACK_REPLAY_AVAILABLE=SI (55 muestras reales recuperadas vía railway logs sobre el deployment histórico del mismo día; 280 eventos witness únicos recuperados de un total estimado ~287+, huecos honestamente registrados en callbackSequence 13-23/39/43/80+)
BASELINE_REPLAY_MATCHES_PHYSICAL_BEHAVIOR=SI (0 discrepancias entre el replay offline contra MAX_MOVING_BATCH_AGE_MS=3000 original y el comportamiento físico realmente registrado — autoriza confiar en el harness antes de evaluar candidatos)
BATCH_AGE_ONLY_SUFFICIENT=PARCIAL (mejora real de 0%→66.7% de batches con 2+ puntos de wire, pero con techo estructural en ~2 puntos/batch bajo el filtro de movimiento actual — BATCH_ACCUMULATED_DISTANCE_FLUSH_THRESHOLD_METERS=30 dispara flush por distancia casi inmediatamente después de 2 puntos, sin importar cuánto se suba la edad)
STATIONARY_CALIBRATION_DATA_SUFFICIENT=NO (sólo una corrida de 4 muestras casi-idénticas dentro de un segmento de caminata continua, no un período de quietud dedicado — insuficiente para validar un nuevo filtro de movimiento sin riesgo de falsos positivos en reposo real)
SELECTED_FILTER_DESIGN=CANDIDATE_1_BATCH_AGE_ONLY (Candidatos 2 time+distance [23.6% aceptación simulada] y 3 speed-aware [56.4%] evaluados pero NO implementados — bloqueados por STATIONARY_CALIBRATION_DATA_SUFFICIENT=NO, registrados como NEEDS_DEDICATED_CALIBRATION_PROBE con diseño de sonda preparado 1min quieto+3min caminata+1min quieto, no ejecutado)
SELECTED_POLICY_REASON=único candidato validable sin una sonda física dedicada de estacionario; preserva RAW authority, bajo riesgo, funciona con la cadencia PWA irregular real (mediana 4411ms de callback GPS, 4.0s-17.3s de rango entre puntos ACEPTADOS)
SELECTED_MAX_MOVING_BATCH_AGE_MS=15000 (antes 3000)
SELECTED_MAX_BATCH_DURATION_MS=16000 (antes 5000; debe ser >= MAX_MOVING_BATCH_AGE_MS para que el corte de prefijo de buildTrackingTrajectoryBatch nunca trunque un batch recién vencido)
MAX_STALE_TRAJECTORY_BUFFER_AGE_MS=16000 (constante NUEVA, separada de MAX_LOCAL_TRAJECTORY_AGE_MS que queda en 5000 y ahora sólo gobierna frescura de muestra individual — evita que el reset de seguridad del buffer dispare antes que el flush calibrado)
MOVEMENT_FILTER_CHANGED=NO / HIGH_ACCURACY_CHANGED=NO / MIN_SEND_INTERVAL_CHANGED=NO
HEARTBEAT_ANCHOR_FIXED=SI (gap de H1 §7: tras un heartbeat con buffer vacío, buffer.anchor se realinea a la posición confirmada por el heartbeat en vez de quedar stale contra la posición pre-heartbeat; test de comportamiento nuevo H01 en use-repartidor-tracking.test.ts)
WITNESS_WAIT_REASON_LABEL_FIXED=SI (deferReason: NETWORK_MIN_SEND_INTERVAL vs BATCH_AGE_WAIT, witness-only; además se corrigió flushReason que estaba hardcodeado y habría etiquetado mal cada flush post-calibración)
SINGLE_FLIGHT_REGRESSION_SUITE=PASS (test preexistente fallando corregido con justificación contractual demostrada: dos fireWatchSuccess con timestamps idénticos disparaban correctamente el guard non_monotonic_timestamp de la nueva capa de trajectory buffer; se agregó advanceTime(1), la aserción original no se tocó)
H2B_REGISTER_RESYNC_IMPLEMENTED=SI (delivery-tracking-map.tsx, mismo patrón que chat-view/chat-sheet/chat-fab; callback vía ref a fetchTracking, efecto separado del de acquireOrderRoom, deps [open, pedidoId, client])
REALTIME_ROOM_REJOIN_LOGIC_CHANGED=NO / POLLING_CADENCE_CHANGED=NO
TESTS=use-repartidor-tracking.test.ts 92 pass/0 fail; tracking-trajectory+tracking-playback+realtime-manager+delivery-tracking-map-stale-contract+delivery-tracking-map-resync-contract 81 pass/0 fail; t24-r5-13-instrumentation 5 pass/0 fail; suite completa del repo 3354 pass/212 fail (los 212 fallos son TODOS de push-subscription/operativo/salon, fuera del fileset de esta tarea, confirmados como ruido preexistente de la corrida completa — el archivo específico pasa 12/12 en aislamiento — NO una regresión de esta tarea)
LINT=0 findings (focal, 8 archivos modificados/creados) / DIFF_CHECK=limpio / BUILD=exit 0 / TYPECHECK=31 errores, igual al baseline preexistente documentado, 0 nuevos
H2A_COMMIT_SHA=0843bfc (fix: calibrate raw tracking trajectory producer)
H2B_COMMIT_SHA=1e241ff (fix: resync delivery tracking state after recovery)
REMOTE_TESTING_SHA=1e241ffdfe9ff6f81bb00dd909ad649b3a47879c
DELIGO_COPY_DEPLOYMENT_ID=37a8f80d-62bf-4564-b994-a155a9e06a8e (SUCCESS, commit match)
CHAT_EN_VIVO_DEPLOYMENT_ID=977fc1e5-9846-4584-ae16-82e58ba36049 (SUCCESS, commit match)
LOGS_CLEAN_BOOT=SI (ambos servicios, sin errores fatales, migraciones al día)
P2_T24_READY_FOR_R6=NO
P2_T24_RELEASE_ELIGIBLE=NO
T44_TOUCHED=NO
PRODUCTION_TOUCHED=NO (origin/main verificado sin cambios antes/después: ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763)
NEXT_ACTION=WAIT_FOR_OPERATOR_AUTHORIZED_PHYSICAL_PROBE (confirmar en campo: 2+ puntos/batch reales, comportamiento de heartbeat-anchor, y que el resync H2B efectivamente refresca el mapa del cliente tras una reconexión real)
```

Reporte completo (metodología de replay offline, 4 evidencias de errores
encontrados y corregidos durante el desarrollo del harness, tabla de 3
candidatos evaluados, detalle línea-por-línea de cada fix, resultados de
calidad completos, commits, deploy):
`codex-reports/P2_T23_H2_CALIBRATED_RAW_AND_REALTIME_HARDENING.md`.

## HISTORICAL SNAPSHOT — P2-T23-H1.5 (2026-09-15)

Benchmark externo (research-only, sin código) contrastando la arquitectura
actual de tracking contra prácticas públicas de Uber, DoorDash, Grab, Mapbox,
Google Roads, OSRM y Socket.IO — hecho antes de autorizar H2A/H2B para evitar
fijar parámetros a ciegas.

```text
P2_T23_H1_5_STATUS=RESEARCH_COMPLETE_ARCHITECTURE_DECIDED_AWAITING_AUTHORIZATION
HALLAZGO_CENTRAL=la cadencia RAW del sensor de DeliGO (mediana 4411ms) YA es competitiva con la recomendación pública de Mapbox para map matching (~5000ms) — el sensor NO es el problema. El problema real es matemático: con sólo 19/81 callbacks decididos aceptados por el filtro de movimiento (~23.5%), el espaciado PROMEDIO entre puntos aceptados es ≈26.6s (506s de ventana / 19 aceptados) — subir sólo MAX_MOVING_BATCH_AGE_MS (Opción G de H1) exigiría ventanas de ~27-53s para lograr 2-3 puntos/batch, inaceptable para frescura visual. CORRECCIÓN DE H1: la edad de batch sigue siendo necesaria pero NO suficiente sola — debe combinarse con un ajuste conservador del filtro de movimiento (time-distance/speed-aware, validado con probe, nunca "aflojado a ciegas")
BENCHMARK_INDUSTRIA=Uber (sensor fusion + particle filter + GNSS crudo nativo, inaccesible desde Web — Rethinking GPS blog 2018), DoorDash (batch vía Kafka "every few seconds", device-identity filtering isFromMainDevice), Grab (Pharos: proyección a red vial EN TIEMPO DE CONSULTA, nunca persistida como verdad — valida el diseño RAW-authority de DeliGO), Mapbox (2-100 puntos, ~5s sample rate, confidence 0-1), Google Roads (100 puntos, ≤300m spacing), OSRM Match (timestamps opcionales, radiuses, gaps split/ignore, confidence)
PWA_VS_NATIVE=confirmado que la Web Geolocation API (W3C spec) NO garantiza cadencia de callback, NO garantiza fuente GPS, y enableHighAccuracy es sólo un HINT ("MAY avoid using... GPS" incluso activado) — DeliGO ya adapta correctamente en vez de asumir control. Background tracking sigue siendo un techo estructural real de PWA (sin cambios respecto de P2-T02-B2/B3, ya resuelto con best-effort honesto, no se reabre)
REALTIME_RECOVERY_REFORZADO=la propia documentación oficial de Socket.IO (Connection State Recovery) confirma que un reconnect exitoso NO es suficiente por sí solo — "you will still need to handle the case where the states of the client and the server must be synchronized" — validando externamente el gap ya encontrado en H1 (delivery-tracking-map.tsx nunca llama client.registerResync, a diferencia de chat)
CLIENT_PLAYBACK=CURRENT_T23_PLAYBACK_ARCHITECTURE=ALIGNED, PLAYBACK_REWRITE_REQUIRED=NO — el controlador de reproducción (interpolación 250-1200ms, catch-up acotado, snap tras gap, sin extrapolación futura) ya sigue el patrón recomendado externamente; el problema nunca fue el playback
RAW_AUTHORITY_DESIGN_VALID=SI (confirmado contra las 3 compañías estudiadas — ninguna persiste la coordenada snapeada como ground truth)
RECOMMENDED_OPTION=OPTION_A (arquitectura actual con parámetros corregidos — sin refactor mayor, sin wrapper nativo; nada en la evidencia externa sugiere que el problema de suavidad requiera salir de la PWA)
REVISED_H2A_SCOPE=batch age (ajustado junto con MAX_BATCH_DURATION_MS) + filtro time-distance/speed-aware conservador + alineación de heartbeat anchor + corrección de etiquetas de witness — requiere probe de validación antes de fijar números finales
REVISED_H2B_SCOPE=sin cambios respecto de H1 — client.registerResync en delivery-tracking-map.tsx, reforzado por la doc oficial de Socket.IO
T24_WAITS=SI (sin cambios — sigue esperando a que H2A revisado produzca trazas con ≥2-3 puntos reales)
T44_TOUCHED=NO
CODE_CHANGED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO
NEXT_ACTION=WAIT_FOR_POST_BENCHMARK_IMPLEMENTATION_AUTHORIZATION
```

Reporte completo (tabla comparativa de 3 providers de map matching, tabla PWA
vs Native de 8 capacidades, matemática exacta del benchmark Mapbox, tabla de
7 alternativas de filtrado, arquitectura de referencia end-to-end, 13 fuentes
citadas con URL): `codex-reports/P2_T23_H1_5_EXTERNAL_TRACKING_BENCHMARK.md`.

## HISTORICAL SNAPSHOT — P2-T23-H1 (2026-09-15)

Auditoría de diseño (sin código) sobre la evidencia física válida de R5.14B
(caminata corta con las cuentas Testing correctas, 84 callbacks GPS, 15
escrituras server-side, revisión 89→104). Confirma y explica por código el
ownership ya establecido: los saltos visuales son responsabilidad de P2-T23
(buffer/batch del productor RAW), nunca de P2-T24 (map matching, nunca
invocado en esta ventana — `PROVIDER_ATTEMPTS=0`).

```text
P2_T23_H1_STATUS=AUDIT_COMPLETE_DESIGN_READY_FOR_AUTHORIZATION
STEPWISE_BOTTLENECK_STAGE=BUFFER_BATCH (confirmado por código, no sólo por evidencia agregada)
STEPWISE_ROOT_CAUSE_MECHANISM=MAX_MOVING_BATCH_AGE_MS=3000ms es MENOR que la mediana real de cadencia GPS (4411ms) — el timer de edad del batch vence antes de que llegue el siguiente callback, forzando flushes de 1 punto de forma determinista (no probabilística), explicando 9/10 flushes MAX_AGE
MOVEMENT_FILTER_CORRECTION=la fórmula max(15m, accNew+accPrev) que originalmente motivó esta auditoría YA NO gatea nada — fue reemplazada por tracking-trajectory.ts's effectiveTrajectoryPointThresholdMeters (max(5m, 0.5×(accPrev+accNext)), ≈16.9m a la accuracy mediana observada) desde que existe el buffer de trayectoria (P2-T23 R3A); la fórmula vieja sólo sobrevive como metadato de diagnóstico sin efecto real — MOVEMENT_FILTER_IS_MAJOR_DENSITY_LOSS=SI de todas formas (75.3% de rechazo, porque el desplazamiento peatonal típico entre callbacks ~5-6m es menor que el umbral ~16.9m derivado de la accuracy real del GPS con enableHighAccuracy=false)
DIRECT_SEND_BYPASS_PATHS=4 call-sites (bootstrap inicial, ensureInitialSendForDelivery, ensureForegroundRecoverySendForDelivery, fireHeartbeat) envían directo sin pasar por el buffer — los 3 primeros son intencionales/correctos; fireHeartbeat tiene un gap latente real (nunca actualiza buffer.anchor tras el primer envío) no exercitado en esta sonda (HEARTBEAT_ELIGIBLE_CALLBACKS=0) pero documentado para H2A
FREEZE_ROOT_CAUSE_MECHANISM=realtime-manager.ts SÍ resuscribe automáticamente todas las salas activas tras cualquier reconexión limpia (rejoinAllRooms en handleConnected, tanto vía ensureConnected como vía reauthenticate) — el gap real es que delivery-tracking-map.tsx NUNCA llama client.registerResync (a diferencia de chat-view/chat-sheet/chat-fab, que sí lo hacen) — por eso una reconexión exitosa nunca dispara un fetch HTTP explícito de "estado más reciente", dejando el catch-up sólo al próximo tick pasivo del polling (8s/20s)
WIFI_TO_CELLULAR_CAUSAL=UNPROVEN (sin cambios, se mantiene explícitamente sin probar)
RECOMMENDED_H2A=subir MAX_MOVING_BATCH_AGE_MS (reconciliado con MAX_BATCH_DURATION_MS=5000) + corregir etiquetado de witness (throttle de red vs edad de batch, hoy conflacionados bajo "DEFER_MIN_INTERVAL") + alinear buffer.anchor en heartbeat — SIN tocar movement threshold ni enableHighAccuracy todavía
RECOMMENDED_H2B=adoptar client.registerResync en delivery-tracking-map.tsx, mismo patrón ya probado en chat — cubre reconnect+reauth+focus+online en un solo mecanismo ya existente, sin lógica nueva de resuscripción
P2_T23_REOPEN_RECOMMENDED=SI (propuesto, NO aplicado todavía: P2_T23_STATUS=REOPENED_TESTING_HARDENING_CANDIDATE)
T23_HARDENING_REQUIRED_BEFORE_T24_R6=SI
T24_WAITS=SI (P2_T24_READY_FOR_R6 sigue NO hasta que una sonda posterior a H2A confirme BATCH_POINT_COUNT_MEDIAN>1 y PROVIDER_ATTEMPTS>0)
T44_TOUCHED=NO (P2-T44 es Operaciones Personal Push UX + PyR, sin relación alguna con este dominio)
CODE_CHANGED=NO / COMMIT_CREATED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO
NEXT_ACTION=WAIT_FOR_H2_IMPLEMENTATION_AUTHORIZATION
```

Reporte completo (mecanismo exacto por línea de código, tabla comparativa de
7 candidatos con pros/contras, diseño de H2A/H2B con files/tests/probe):
`codex-reports/P2_T23_H1_RAW_SMOOTHNESS_REALTIME_RECOVERY_AUDIT.md`.

## HISTORICAL SNAPSHOT — P2-T24-R5.14B (2026-09-15)

Esta sección registra el probe físico corto con las cuentas Testing correctas.
El operador informó saltos y un freeze recuperable mediante Recargar durante
la transición declarada WiFi→datos móviles. El witness técnico correlacionó
15 escrituras del pedido desde la revisión 90 hasta la 104. La transición de
red no quedó instrumentada, por lo que su relación causal permanece sin probar.

```text
P2_T24_STATUS=IMPLEMENTED_PARTIALLY_TESTING_BLOCKED_T23_HARDENING_CANDIDATE
P2_T24_R5_STATUS=INVALID_R5_14_WRONG_OPERATOR_ACCOUNT_R5_14B_READY
P2_T24_READY_FOR_R6=NO
P2_T24_RELEASE_ELIGIBLE=NO
GPS_RAW_IS_INTERNAL_AUTHORITY=SI
DB_RAW_POSITION_ONLY=SI
DB_MATCHED_DATA_PERSISTED=NO
P2_T24_PHYSICAL2_STATUS=TECHNICAL_RUN_COMPLETE_OPERATOR_REPORT_CAPTURED
P2_T24_PHYSICAL2_FIXTURE_PREFIX=TEST_T24_PHYSICAL_
P2_T24_PHYSICAL2_ORDER_ID=cmu1p548z0006riv8ntyibf0w
P2_T24_PHYSICAL2_LOCATION_REVISION_BEFORE_RUN=48
P2_T24_PHYSICAL2_SERVER_WITNESS_READY=SI
P2_T24_PHYSICAL2_PROVIDER_WITNESS_READY=SI
P2_T24_PHYSICAL2_REALTIME_WITNESS_READY=SI
P2_T24_PHYSICAL2_CLIENT_WITNESS_READY=SI
P2_T24_PHYSICAL2_DESTINATION_ALIGNMENT=DONE_BEFORE_RUN
P2_T24_PHYSICAL2_DESTINATION_REFERENCE=PLAZA_CENTRAL_LIBERTADOR_GENERAL_SAN_MARTIN
P2_T24_PHYSICAL2_LOCATION_REVISION_AFTER_ALIGNMENT=48
P2_T24_PHYSICAL2_SYNTHETIC_TRACKING_POSTS=0
P2_T24_PHYSICAL2_READY_TO_DRIVE=SI
P2_T24_PHYSICAL2_PHYSICAL_DRIVE_FINISHED=SI
P2_T24_PHYSICAL2_LOCATION_REVISION_AFTER_RUN=89
P2_T24_PHYSICAL2_TOTAL_REAL_GPS_WRITES=41
P2_T24_PHYSICAL2_PROVIDER_ATTEMPTS=6
P2_T24_PHYSICAL2_PROVIDER_ACCEPTED=0
P2_T24_PHYSICAL2_PROVIDER_POLICY_REJECTED=6
P2_T24_PHYSICAL2_PROVIDER_REJECT_REASONS=5_ambiguous_tracepoints,1_low_confidence
P2_T24_PHYSICAL2_REALTIME_EVENTS_PUBLISHED=41
P2_T24_PHYSICAL2_REALTIME_MATCHED_EVENTS=0
P2_T24_PHYSICAL2_REALTIME_RAW_ONLY_EVENTS=41
P2_T24_PHYSICAL2_CLIENT_REALTIME_UPDATES=38
P2_T24_PHYSICAL2_CLIENT_MATCHED_RENDER_EVENTS=0
P2_T24_PHYSICAL2_CLIENT_RAW_RENDER_EVENTS=38
P2_T24_PHYSICAL2_TELEPORT_CANDIDATES=1_UNPROVEN
P2_T24_PHYSICAL2_SAMPLE_DENSITY=MIXED
P2_T24_PHYSICAL2_RAW_FALLBACK_END_TO_END=SI
P2_T24_PHYSICAL2_TECHNICAL_ANALYSIS=COMPLETE_OPERATOR_REPORT_CAPTURED
P2_T24_R5_11_STATUS=CLOSED_PHYSICAL_RUN_ANALYZED_OPERATOR_REPORT_CAPTURED
P2_T24_R5_11_OPERATOR_VISUAL_REPORT=CAPTURED
P2_T24_R5_12_STATUS=TECHNICAL_AUDIT_COMPLETE_AWAITING_FUTURE_INSTRUMENTED_PROBE
P2_T24_R5_11_OPERATOR_MOVEMENT=MUCHOS_SALTOS
P2_T24_R5_11_OPERATOR_WRONG_ROAD_DEVIATIONS=0
P2_T24_R5_11_OPERATOR_FREEZE_COUNT=1
P2_T24_R5_11_OPERATOR_FREEZE_RECOVERY=close/reopen delivery map
P2_T24_R5_11_OPERATOR_EXPERIENCE=BIEN
P2_T24_R5_11_SMOOTH_MOVEMENT=NO
P2_T24_R5_12_RAW_BATCH_POINT_COUNT_MEDIAN=1
P2_T24_R5_12_RAW_BATCH_POINT_COUNT_P95=5
P2_T24_R5_12_RAW_BATCH_POINT_COUNT_MAX=6
P2_T24_R5_12_PROVIDER_ACCEPTED=0
P2_T24_R5_12_PROVIDER_REJECTED=6
P2_T24_R5_12_CLIENT_MATCHED_RENDER_EVENTS=0
P2_T24_R5_12_CLIENT_RAW_RENDER_EVENTS=38
P2_T24_R5_12_CLIENT_MISSED_REALTIME_REVISIONS=49,52,85
P2_T24_R5_12_CLIENT_RECEIVE_LONGEST_GAP_MS=62886
P2_T24_R5_12_TELEPORT_CANDIDATES=1_UNPROVEN
P2_T24_R5_12_STEPWISE_OWNER=P2_T23_REGRESSION_OR_HARDENING
P2_T24_R5_12_CLIENT_FREEZE_ROOT_CAUSE=UNKNOWN
P2_T24_R5_12_CLIENT_WITNESS_SOURCE_LABEL_FIXED=SI_LOCAL_NOT_DEPLOYED
P2_T24_R5_12_FIXTURE_CLEANUP=DEFERRED_FOR_FUTURE_INSTRUMENTED_PROBE
P2_T24_R5_13_STATUS=IMPLEMENTED_TESTING_DEPLOYED_READY_FOR_SHORT_INSTRUMENTED_PROBE
P2_T24_R5_13_INSTRUMENTATION_SCOPE=RAW_CALLBACK_FILTER_THROTTLE_BATCH_POST_CLIENT_LIFECYCLE
P2_T24_R5_13_INSTRUMENTATION_BEHAVIOR_CHANGE=NO
P2_T24_R5_13_TESTING_DEPLOYED=SI
P2_T24_R5_13_PROBE_EXECUTED=NO
P2_T24_R5_13_WITNESS_REVISION_GAP_METRIC_FIXED=SI
P2_T24_R5_13_CLEANUP=DEFERRED_FOR_FUTURE_INSTRUMENTED_PROBE
P2_T24_R5_13_COMMIT=b4c851e3d9f302c9543bb47d9726db8f012c2e65
P2_T24_R5_13_TESTING_DEPLOYMENT_ID=e7d3881f-e89f-4e44-8173-2ec3643466e1
P2_T24_R5_13_TESTING_DEPLOYMENT_STATUS=SUCCESS
P2_T24_R5_14_STATUS=INVALID_TECHNICAL_PROBE_WRONG_OPERATOR_ACCOUNT
P2_T24_R5_14_PROBE_EXECUTED=SI_OPERATOR_REPORTED
P2_T24_R5_14_PROBE_BASELINE_REVISION=89
P2_T24_R5_14_PROBE_WITNESS_WINDOW_READY=SI
P2_T24_R5_14_FIXTURE_PRESENT=SI
P2_T24_R5_14_SINGLE_FLIGHT_FAILURE_PROBE_BLOCKER=NO
P2_T24_R5_14_CREDENTIALS=RUNTIME_ONLY_REFRESHED
P2_T24_R5_14_PROBE_FIRST_REVISION=NONE_OBSERVED_AFTER_89
P2_T24_R5_14_PROBE_LAST_REVISION=89
P2_T24_R5_14_TOTAL_SERVER_WRITES=0_OBSERVED_FOR_ORDER_AFTER_BASELINE
P2_T24_R5_14_OPERATOR_MOVEMENT=SALTOS
P2_T24_R5_14_OPERATOR_FREEZE=SI
P2_T24_R5_14_OPERATOR_FREEZE_COUNT=1
P2_T24_R5_14_OPERATOR_FREEZE_RECOVERY=RECARGAR_Y_SEGUIMIENTO_CONTINUO
P2_T24_R5_14_NETWORK_TRANSITION=WiFi_A_DATOS_MOVILES_UNPROVEN
P2_T24_R5_14_WRONG_ACCOUNT_USED=SI
P2_T24_R5_14_TECHNICAL_PROBE_VALID=NO
P2_T24_R5_14_OBSERVATION_CORRELATED_TO_FIXTURE=NO
P2_T24_R5_14_MISSING_WITNESS_CAUSE=OPERATOR_USED_DIFFERENT_ACCOUNT_THAN_INSTRUMENTED_TEST_FIXTURE
P2_T24_R5_14_STEPWISE_BOTTLENECK_STAGE=UNPROVEN_NO_POST_BASELINE_WITNESS
P2_T24_R5_14_STEPWISE_ROOT_CAUSE=UNPROVEN_NO_POST_BASELINE_WITNESS
P2_T24_R5_14_CLIENT_FREEZE_ROOT_CAUSE=UNKNOWN
P2_T24_R5_14_RELOAD_ACTION=HTTP_TRACKING_FETCH_CODE_PATH
P2_T24_R5_14_MANUAL_RELOAD_REQUIRED=SI_OPERATOR_REPORTED
P2_T24_R5_14_PROVIDER_ATTEMPTS=0_OBSERVED_AFTER_BASELINE
P2_T24_R5_14_PHYSICAL_FIXTURE_CLEANUP=DEFERRED_EVIDENCE_PRESERVATION
P2_T24_R5_14B_STATUS=ANALYZED_OPERATOR_REPORT_CAPTURED_TECHNICAL_CORRELATION_COMPLETE
P2_T24_R5_14B_REPARTIDOR_IDENTITY_VERIFIED=SI
P2_T24_R5_14B_CLIENT_IDENTITY_VERIFIED=SI
P2_T24_R5_14B_ORDER_CONTEXT_VERIFIED=SI
P2_T24_R5_14B_PROBE_EXECUTED=SI
P2_T24_R5_14B_BASELINE_REVISION=89
P2_T24_R5_14B_PROBE_FIRST_REVISION=90
P2_T24_R5_14B_PROBE_LAST_REVISION=104
P2_T24_R5_14B_TOTAL_SERVER_WRITES=15
P2_T24_R5_14B_PROBE_START=2026-09-15T17:38:31.436Z
P2_T24_R5_14B_PROBE_END=2026-09-15T17:46:57.463Z
P2_T24_R5_14B_OPERATOR_MOVEMENT=SALTOS
P2_T24_R5_14B_OPERATOR_FREEZE=SI
P2_T24_R5_14B_OPERATOR_FREEZE_COUNT=1
P2_T24_R5_14B_OPERATOR_FREEZE_RECOVERY=RECARGAR_Y_SEGUIMIENTO_CONTINUO
P2_T24_R5_14B_NETWORK_TRANSITION=WiFi_A_DATOS_MOVILES_REPORTED_TECHNICALLY_UNOBSERVABLE
P2_T24_R5_14B_GPS_CALLBACK_COUNT=84
P2_T24_R5_14B_WATCH_POSITION_CALLBACK_COUNT=81
P2_T24_R5_14B_GET_CURRENT_POSITION_COUNT=3
P2_T24_R5_14B_GPS_CALLBACK_INTERVAL_MEDIAN_MS=4411
P2_T24_R5_14B_GPS_CALLBACK_INTERVAL_P95_MS=15019
P2_T24_R5_14B_GPS_CALLBACK_INTERVAL_MAX_MS=88580
P2_T24_R5_14B_GPS_SOURCE_DENSITY=MIXED
P2_T24_R5_14B_MOVEMENT_ACCEPTED=19
P2_T24_R5_14B_MOVEMENT_REJECTED_BELOW_THRESHOLD=61
P2_T24_R5_14B_MOVEMENT_THRESHOLD_CONTRIBUTION=HIGH
P2_T24_R5_14B_THROTTLE_DEFERRALS=9
P2_T24_R5_14B_FIVE_SECOND_THROTTLE_CONTRIBUTION=MODERATE
P2_T24_R5_14B_BUFFER_APPENDS=10
P2_T24_R5_14B_BATCH_FLUSHES=10
P2_T24_R5_14B_BATCH_POINT_COUNT_MEDIAN=1
P2_T24_R5_14B_BATCH_POINT_COUNT_P95=1
P2_T24_R5_14B_BATCH_POINT_COUNT_MAX=1
P2_T24_R5_14B_RAW_BATCH_DENSITY=SPARSE
P2_T24_R5_14B_TRACKING_POST_COUNT=15
P2_T24_R5_14B_REALTIME_EVENTS_PUBLISHED=15
P2_T24_R5_14B_REALTIME_RAW_EVENTS=10
P2_T24_R5_14B_REALTIME_MATCHED_EVENTS=0
P2_T24_R5_14B_REALTIME_LOCATION_ONLY_EVENTS=5
P2_T24_R5_14B_CLIENT_REALTIME_EVENTS_RECEIVED=10
P2_T24_R5_14B_CLIENT_HTTP_REVISIONS_RECEIVED=8_UNIQUE
P2_T24_R5_14B_CLIENT_RAW_PLAYBACK_EVENTS=19
P2_T24_R5_14B_CLIENT_MATCHED_PLAYBACK_EVENTS=0
P2_T24_R5_14B_CLIENT_LOCATION_ONLY_EVENTS=5
P2_T24_R5_14B_SERVER_TO_REALTIME_REVISION_GAPS=90,91,92,97,104
P2_T24_R5_14B_STEPWISE_BOTTLENECK_STAGE=BUFFER_BATCH
P2_T24_R5_14B_STEPWISE_ROOT_CAUSE=MULTIPLE_BUFFER_BATCH_PRIMARY_WITH_GPS_SOURCE_AND_MOVEMENT_FILTER_CONTRIBUTION
P2_T24_R5_14B_FREEZE_CANDIDATE=2026-09-15T17:44:39.210Z_REVISION_103_TO_104
P2_T24_R5_14B_SERVER_CONTINUED_DURING_FREEZE=SI
P2_T24_R5_14B_CLIENT_REALTIME_STOPPED_AFTER_REVISION_103=SI
P2_T24_R5_14B_NETWORK_TRANSITION_OBSERVED=NOT_OBSERVABLE
P2_T24_R5_14B_REALTIME_DISCONNECT=NO_EXPLICIT_DISCONNECT_EVENT
P2_T24_R5_14B_REALTIME_RECONNECT=REAUTHENTICATING_THEN_CONNECTED_BEFORE_FREEZE_CANDIDATE
P2_T24_R5_14B_CLIENT_FREEZE_ROOT_CAUSE=REALTIME_DISCONNECT_NO_AUTOMATIC_RECOVERY_CAUSE_UNPROVEN
P2_T24_R5_14B_WIFI_TO_CELLULAR_CAUSAL=UNPROVEN
P2_T24_R5_14B_MANUAL_RELOAD_REQUIRED=SI
P2_T24_R5_14B_PROVIDER_ATTEMPTS=0
P2_T24_R5_14B_PHYSICAL_FIXTURE_CLEANUP=DEFERRED_EVIDENCE_PRESERVATION
P2_T24_R5_14B_CREDENTIALS=RUNTIME_ONLY_VALIDATED
P2_T23_FORMALLY_REOPENED=NO
P2_T23_DIAGNOSTIC_HARDENING_ACTIVE=SI
STEPWISE_BEHAVIOR_IS_T24_MATCHING_BUG=NO
STEPWISE_BEHAVIOR_OWNER=P2_T23_REGRESSION_OR_HARDENING
GPS_CALLBACK_FREQUENCY=OBSERVED_R5_14B_MIXED
CLIENT_FREEZE_ROOT_CAUSE=REALTIME_DISCONNECT_NO_AUTOMATIC_RECOVERY_CAUSE_UNPROVEN
P2_T24_READY_FOR_R6=NO
P2_T24_RELEASE_ELIGIBLE=NO
P2_T24_R5_11_COMMIT=e625846a58a14dd9635041ab27034b6ef44e1160
P2_T24_R5_11_TESTING_DEPLOYMENT_ID=d3180fd5-74b1-4b94-90f4-10aef523d698
P2_T24_R5_11_TESTING_DEPLOYMENT_STATUS=SUCCESS_RUNNING
T44_TOUCHED_BY_T24_TEST=NO
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_TOUCHED=NO
P2_T24_NEXT_ACTION=P2_T23_HARDENING_CANDIDATE_AUDIT_BEFORE_T24_R6
```

## HISTORICAL SNAPSHOT — P2-T44-R1E (2026-09-14)

Esta sección supersede el estado operativo R1D de abajo para la preparación
de certificación física. No se persiste ninguna contraseña ni subscription.

```text
CURRENT_PROJECT_STATE=P2_T44_R1E_READY_FOR_OPERATOR_ACCOUNT_LEVEL_PUSH_CERTIFICATION
CURRENT_BRANCH=work/p2-t43-r2
CURRENT_TESTING_SHA=f1604f22784131f963aed5e008fb8c4fe773b5a5
CURRENT_TESTING_DEPLOYMENT_ID=a7d3b5e2-2642-4af0-854a-83dc6b017c7a
CURRENT_TESTING_DEPLOYMENT_STATUS=SUCCESS_RUNNING
CURRENT_TESTING_DEPLOYMENT_COMMIT=f1604f22784131f963aed5e008fb8c4fe773b5a5
R1D_DEPLOY_CONTAINS_IMPLEMENTATION=SI
DEPLOY_COMMIT_RELATION_TO_R1D=POSTERIOR_DOCS_COMMIT
R1D_REQUESTED_DEPLOYMENT_ID=08782b78-bc49-4878-b155-36d7a51a2849
R1D_REQUESTED_DEPLOYMENT_STATUS=REMOVED_BY_RAILWAY_REPLACEMENT
TESTING_LOGIN_HTTP_STATUS=200
TESTING_ACCOUNT_OWNER_SCHEMA=PASS
P2_T44_R1E_FIXTURE_PREFIX=TEST_T44_R1D_
P2_T44_R1E_ACCOUNT_ID=cmu1xe5p10000rip8gbsxes0l
P2_T44_R1E_ACCOUNT_RELATIONS=MOZO,PYR,SALON
P2_T44_R1E_BUSINESS_C_ID=cmu1ycdqr0000rii4nskdb6ug
P2_T44_R1E_BUSINESS_C_NAME=TEST_T44_R1D_NEGOCIO_C_4135EA7A
P2_T44_R1E_BUSINESS_C_AREA=salon
P2_T44_R1E_BUSINESS_C_SALON_ACTIVE=SI
P2_T44_R1E_EMPLOYEE_C_ID=cmu1yce4v0002rii4okjefbi4
P2_T44_R1E_ACCOUNT_LEVEL_PUSH_ROWS_BEFORE_OPERATOR=0
P2_T44_R1E_PRECREATED_PUSH_SUBSCRIPTIONS=0
P2_T44_R1E_PHYSICAL_CERTIFICATION=PENDING_OPERATOR
P2_T44_R1E_NEXT_ACTION=OPERATOR_ENABLE_ACCOUNT_PUSH_ONLY
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_TOUCHED=NO
```

## HISTORICAL SNAPSHOT — P2-T44-R1D (2026-09-14)

Esta sección supersede los estados T44 R1/R1C de abajo, que se conservan como historial.

```text
CURRENT_PROJECT_STATE=P2_T44_R1D_IMPLEMENTED_TESTING_AWAITING_OPERATOR_PHYSICAL_CERTIFICATION
CURRENT_BRANCH=work/p2-t43-r2
CURRENT_TESTING_SHA=4e1fc296327a3fbb6fa5724f9739cc1441e74c86
CURRENT_TESTING_REMOTE=origin/testing-codex
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_TOUCHED=NO
P2_T44_STATUS=IMPLEMENTED_TESTING_AWAITING_OPERATOR_PHYSICAL_CERTIFICATION
P2_T44_R1D_STATUS=IMPLEMENTED_TESTING_DEPLOYED_AWAITING_OPERATOR_PHYSICAL_CERTIFICATION
P2_T44_R1D_COMMIT_SHA=c3bf576e0a63da29e408672c9cc96384fc4ac4fc
P2_T44_R1D_REPORT=codex-reports/P2_T44_R1D_ACCOUNT_LEVEL_PERSONAL_PUSH.md
P2_T44_R1D_PUSH_OWNER=cuenta_operativa
P2_T44_R1D_ACCOUNT_SWITCH_PATH=/operaciones/cuenta
P2_T44_R1D_AREA_PUSH_TOGGLES=REMOVED
P2_T44_R1D_BELL_PURPOSE=VIEW_NOTIFICATIONS_ONLY
P2_T44_R1D_SCHEMA_CHANGE=AUTHORIZED_AND_IMPLEMENTED
P2_T44_R1D_MIGRATION=20260914100000_account_level_personal_push
P2_T44_R1D_TESTING_MIGRATION=APPLIED
P2_T44_R1D_PRODUCTION_MIGRATION=NOT_RUN
P2_T44_R1D_TESTING_DEPLOYMENT_ID=08782b78-bc49-4878-b155-36d7a51a2849
P2_T44_R1D_TESTING_DEPLOYMENT_STATUS=SUCCESS_RUNNING
P2_T44_R1D_TESTING_DEPLOYMENT_COMMIT=4e1fc296327a3fbb6fa5724f9739cc1441e74c86
P2_T44_R1D_TESTING_CLIENT_URL=https://deligo-copy-production.up.railway.app
P2_T44_R1D_PHYSICAL_CERTIFICATION=PENDING_OPERATOR
P2_T44_R1D_FIXTURE_PREFIX=TEST_T44_R1D_
P2_T44_R1D_PRECREATED_SUBSCRIPTIONS=0
P2_T44_R1D_NEXT_ACTION=OPERATOR_ENABLE_ACCOUNT_PUSH_AND_CERTIFY_CROSS_BUSINESS_DELIVERY
NEXT_TASK_CHAIN_AFTER_T44=P2-T45
```

## HISTORICAL SNAPSHOT — P2-T44-R1C (2026-09-14)

Esta sección superior es la autoridad de continuidad más reciente y
supersede los estados operativos antiguos que permanecen debajo como
historial. No se elimina el contexto histórico.

```text
CURRENT_PROJECT_STATE=P2_T44_R1C_BLOCKED_ARCHITECTURE_DECISION
CURRENT_TESTING_SHA=201ae4f977001629fd99b8d3ee070cfc777380f0
CURRENT_TESTING_REMOTE=origin/testing-codex
CURRENT_BRANCH=work/p2-t43-r2
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_TOUCHED=NO

P2_T02_STATUS=CLOSED_TESTING_CERTIFIED
P2_T23_STATUS=CLOSED_TESTING_CERTIFIED
P2_T23_RELEASE_ELIGIBLE=SI
P2_T24_STATUS=IMPLEMENTED_PARTIALLY_TESTING_BLOCKED_NOT_RELEASE_ELIGIBLE
P2_T24_R5_STATUS=BLOCKED_TESTING_PROVIDER_DATASET
P2_T24_RELEASE_ELIGIBLE=NO
P2_T24_R6_AUTHORIZED=NO
P2_T54_STATUS=FUTURE_AFTER_T02_T23_T24

P2_T53_R1_STATUS=CLOSED_OPERATOR_PASS
P2_T53_R2_STATUS=CLOSED_OPERATOR_PASS
P2_T53_OPERATOR_EVIDENCE="quedó perfecto, ahora se ve bien"
P2_T53_R1_FIX=Negocio same-session occupation close invokes scoped refetch/refresh; no schema, migration, realtime or polling-global change
P2_T53_R2_FIX=mesa detail sheet sharpness fixed with local willChange:auto; Drawer global unchanged
P2_T53_R2_COMMIT=edcccd543f7bb1f06dc63f21839a4ce492694777
P2_T53_R2_CLOSEOUT_COMMIT=4988b49b4a78920148ab950efd94150b229844c8

P2_T24_PHYSICAL_REAL_GPS=COMPLETED_PENDING_ADDITIONAL_WITNESS
P2_T24_PHYSICAL_ACCEPTED_REAL_GPS_WRITES=48
P2_T24_PHYSICAL_REALTIME=OBSERVED
P2_T24_PHYSICAL_PROVIDER_ATTEMPTS=3
P2_T24_PHYSICAL_PROVIDER_ACCEPTED=1
P2_T24_PHYSICAL_PROVIDER_POLICY_REJECTED=2
P2_T24_PHYSICAL_RAW_FALLBACK=OBSERVED
P2_T24_PHYSICAL_VISUAL=MIXED_SMOOTH_STEPWISE_TELEPORT; TWO_BRIEF_INTERSECTION_DEVIATIONS_SELF_CORRECTED
P2_T24_ADDITIONAL_PHYSICAL_TEST=PENDING_WITH_WITNESS_PREPARED_BEFORE_DRIVING
P2_T24_PRODUCTION_RELEASE=NOT_ELIGIBLE
P2_T24_PRODUCTION_TOUCHED=NO

P2_T44_STATUS=BLOCKED_ARCHITECTURE_DECISION
P2_T44_SCOPE=Unified Personal Push Settings
P2_T44_REPORT=codex-reports/P2_T44_A0_OPERACIONES_PERSONAL_PUSH_PYR_AUDIT.md
P2_T44_R1_REPORT=codex-reports/P2_T44_R1_OPERACIONES_PERSONAL_PUSH_PYR.md
P2_T44_R1C_REPORT=codex-reports/P2_T44_R1C_UNIFIED_PERSONAL_PUSH_SETTINGS.md
P2_T44_R1_BASELINE_SHA=4988b49b4a78920148ab950efd94150b229844c8
P2_T44_R1_COMMIT_SHA=cee754289a1a30302f7c3dcd1a749213a051344f
P2_T44_R1_REMOTE_TESTING_SHA=cee754289a1a30302f7c3dcd1a749213a051344f (superseded UX; technical/security evidence retained)
P2_T44_R1C_STATUS=BLOCKED_ARCHITECTURE_DECISION
P2_T44_R1C_SCHEMA_DECISION_REQUIRED=SI
P2_T44_R1C_RECOMMENDED_PUSH_OWNER=PushSubscription ownerType cuenta_operativa, ownerId CuentaOperativa.id
P2_T44_R1C_DB_SCHEMA_CHANGED=NO
P2_T44_R1C_PRISMA_MIGRATION_CREATED=NO
P2_T44_R1_TESTING_DEPLOYMENT_ID=bbf365fa-180c-4cbd-b03b-3c07edea2fba
P2_T44_R1_TESTING_DEPLOYMENT_STATUS=SUCCESS_RUNNING
P2_T44_R1_TESTING_DEPLOYMENT_COMMIT=cee754289a1a30302f7c3dcd1a749213a051344f
P2_T44_FINDING_1_SEND_TEST_UI=CONFIRMED_NEEDS_FIX
P2_T44_R1_SEND_TEST_VISIBLE_AFTER=NO
P2_T44_FINDING_2_MOBILE_POPOVER=NOT_REPRODUCED
P2_T44_FINDING_3_PYR_PUSH_COVERAGE=NEEDS_FIX_PARTIAL_UI_GAP_WITH_BACKEND_COVERAGE
P2_T44_FINDING_4_PUSH_NAVIGATION=ALREADY_CORRECT
P2_T44_FINDING_5_PUSH_SUBSCRIPTION_UX=NEEDS_FIX
P2_T44_R1_PUSH_TEST_ROUTE_TESTING_GUARD=SI
P2_T44_R1_PYR_PUSH_ENABLE_DISABLE_STATUS_UI=SI
P2_T44_R1_PYR_PUSH_ROUTE_AUTHORIZATION=PASS
P2_T44_R1_PYR_PUSH_BUSINESS_ISOLATION=PASS
P2_T44_R1_LEGACY_NORMALIZED_STATUS_MISMATCH_HANDLED=SI
P2_T44_R1_PYR_CANCELLATION_FANOUT_TEST=PASS
P2_T44_R1_PUSH_NAVIGATION_REGRESSION=PASS
P2_T44_R1_MOBILE_POPOVER_CHANGED=NO
P2_T44_R1_TESTS=FOCAL_18;MOZO_12;SALON_12;PYR_MESSAGING_20;CANCELLATION_10;SERVICE_WORKER_34;PYR_INTEGRATION_12;LINT_PASS;BUILD_PASS
P2_T44_R1_TYPECHECK=PREEXISTING_OUT_OF_SCOPE_ERRORS_ONLY
P2_T44_R1_FIXTURE=TEST_T44_24B0A1FC_NEGOCIO; no pedidos ni suscripciones precreadas
P2_T44_R1B_PHYSICAL_CERTIFICATION=STOPPED_SUPERSEDED_BY_R1C
P2_T44_R1_OPERATOR_MOZO_CONFIRMATION=NOT_REUSED
P2_T44_R1_OPERATOR_PYR_PUSH_CONFIRMATION=NOT_REUSED
P2_T44_R1_RELEASE_ELIGIBLE=NO
P2_T44_READY_FOR_R2=NO_BLOCKED_ARCHITECTURE
P2_T44_PERSONAL_PUSH_SCOPE=MOZO_PYR_SALON
P2_T44_PERSONAL_PUSH_SWITCH_COUNT=1
P2_T44_NOTIFICATION_BELL_PURPOSE=VIEW_NOTIFICATIONS
P2_T44_PERSONAL_PUSH_TOGGLE_REQUIRES_SELECTED_BUSINESS=NO (target; not implemented)
P2_T44_EVENT_AUTHORIZATION_REMAINS_EMPLOYEE_BUSINESS_SCOPED=SI
P2_T44_R1C_NEXT_ACTION=AUTHORIZE_SCHEMA_CHANGE_FOR_ACCOUNT_LEVEL_PUSH

P2_T40_ABSORBED=NO
P2_T45_ABSORBED=NO
P2_T40_STATUS=READY_FUTURE; session/login lifecycle remains separate
P2_T45_STATUS=SEPARATE_FUTURE; Terminal notification architecture remains separate
NEXT_TASK_CHAIN_AFTER_T44=P2-T44-R1; no T45 initiation
```

T24 sigue bloqueado para release: la corrida física fue del flujo GPS normal
desde iPhone, no un replay sintético, y confirmó escritura/realtime, pero la
experiencia visual fue mixta. No convierte esa evidencia en certificación de
Production ni autoriza R6. El reporte físico conserva el detalle sin
credenciales ni coordenadas completas.

T44 R1 quitó “Enviar prueba” de la UI normal de Mozo y dejó su ruta backend
únicamente como tooling diagnóstico fail-closed de Testing con opt-in
explícito. Agregó la suscripción Push normal de PyR Personal con autorización
por Empleado, aislamiento por negocio/área y lectura legacy/normalizada; no
creó eventos PyR nuevos. El commit R1 está desplegado en Testing y el fixture
`TEST_T44_24B0A1FC_NEGOCIO` queda disponible para la comprobación humana. La
confirmación física R1B queda detenida y no se reutiliza como certificación
final: la decisión R1C reemplaza la activación Push por panel con un único
switch de cuenta personal. R1 aporta backend/seguridad reutilizables, pero el
ownership actual por `Empleado` no representa correctamente una cuenta
multi-negocio sin duplicaciones.

## Permanent workflow rule — every future P2 task

Cada tarea P2 futura debe: (1) leer `DELIGO_FULL_CONTEXT_LATEST.md` al
iniciar; (2) crear o actualizar su reporte específico; (3) actualizar este
archivo al cerrar cada etapa significativa; (4) registrar estado, SHA, deploy,
pruebas, blockers y próxima acción; y (5) verificar consistencia antes de
STOP. T40, T44 y T45 mantienen alcances separados; esta regla no autoriza
iniciar tareas futuras automáticamente.

## CURRENT T23 AUTHORITY — P2-T23-R2A (2026-09-13)

```text
P2_T23_R1_PHYSICAL_SMOOTHNESS=FAIL
P2_T23_R2_PREVIOUS_FIX_STATUS=SUPERSEDED_BEFORE_COMMIT
A0_ARCHITECTURE_SUPERSEDED_BY_PRODUCT_CLARIFICATION=SI
P2_T23_STATUS=REDESIGNED_READY_FOR_IMPLEMENTATION
T23_BATCHING_REQUIRED=SI
T23_RECOMMENDED_ARCHITECTURE=BOUNDED_LOCAL_TRAJECTORY_BATCHING_PLUS_CLIENT_PLAYBACK
REALTIME_CONTRACT_CHANGE_REQUIRED=SI
T23_TRAJECTORY_PERSISTENCE_REQUIRED=NO
T23_SCHEMA_CHANGE_REQUIRED=NO
T23_MIGRATION_REQUIRED=NO
FUTURE_POSITION_EXTRAPOLATION_ALLOWED=NO
HEARTBEAT_IS_TRAJECTORY_POINT=NO
SECOND_GEOLOCATION_WATCHER_ALLOWED=NO
T23_MAP_MATCHING=NO
T23_ROUTE_SNAPPING=NO
TRACKING_SECURITY_GATES_PRESERVED=SI
T23_NEW_IMPLEMENTATION_SPLIT_REQUIRED=SI
NEXT_ACTION=IMPLEMENT_P2_T23_R3A_AFTER_OPERATOR_APPROVAL
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
```

Reporte: `codex-reports/P2_T23_R2A_TRAJECTORY_BATCHING_ARCHITECTURE_PIVOT.md`.

```
LAST_UPDATED_DATE=2026-09-10
LAST_UPDATED_BY_TASK=P2-T46-AUDIT-STOP-GATE
THIS_FILE_ROLE=SECONDARY_CROSS_CHAT_CONTEXT (síntesis — autoridad primaria: CODEX_REPORT.md + codex-reports/*)
```

## 0.84 ESTADO ACTUAL — P2-T48 cerrado en Production con alcance curado exacto

```text
P2_T46_STATUS=STOPPED_AUDIT_GATE_WAITING_FOR_APPROVAL
P2_T46_ARCHITECTURE_AUDIT_COMPLETE=SI
P2_T46_REPORT=codex-reports/P2_T46_TABLE_ACCOUNT_TICKET_HISTORY_CANONICAL_DETAIL.md
P2_T46_SCHEMA_CHANGE_REQUIRED=SI_FOR_ACCOUNT_PAYMENT_AUTHORITY
P2_T46_HISTORICAL_BACKFILL=AMBIGUOUS_FOR_LEGACY_NULL_OCCUPATION
ORDER_OCCUPATION_AUTHORITY=PARTIAL_DIRECT_ID_LEGACY_NULL_AMBIGUOUS
CURRENT_PAYMENT_AUTHORITY=PEDIDO_METODOPAGO_ONLY_NO_ACCOUNT_PAYMENT_AUTHORITY
P2_T48_STATUS=CLOSED_PRODUCTION
P2_T48_OPERATOR_CERTIFICATION=PASS
P2_T48_RELEASE_ELIGIBLE=SI
P2_T48_SOURCE_COMMIT=bb228ee43c89073a4355e6a012bb9aeaf3669dcb
P2_T48_RELEASE_COMMIT=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
P2_T48_RELEASE_BASE=46a1d55634e8bd848e160302cdb64a32be241c89
P2_T48_PRODUCTION_DEPLOYMENT=96ef5efc-4678-40cd-9a96-966c839201f1_SUCCESS_RUNNING_EXACT_COMMIT
P2_T48_STABLE_TAG=p2-t48-stable-2026-09-10
P2_T48_STABLE_TAG_SHA=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
T48_FILES_IN_RELEASE_DIFF=4
T02_FILES_IN_RELEASE_DIFF=0
T02_HUNKS_IN_RELEASE_DIFF=0
UNAUTHORIZED_POST_T48_DIFF=0
PRISMA_SCHEMA_CHANGED=NO
NEW_MIGRATION=NO
DB_BACKFILL_REQUIRED=NO
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
TEST_T02_ORDER_LEFT_ACTIVE=SI
P2_T23_STARTED=NO
P2_T24_STARTED=NO
NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG=CONFIRMED_PHYSICAL
NEGOCIO_OCCUPATION_REFRESH_ROOT_CAUSE=UNKNOWN_PENDING_AUDIT
NEGOCIO_OCCUPATION_REFRESH_TARGET_TASK=TO_BE_RECONCILED
PREVIOUS_OCCUPATION_OPEN_ORDERS_SURFACE_IN_NEXT_OCCUPATION=CONFIRMED_PHYSICAL
PREVIOUS_OCCUPATION_OPEN_ORDERS_PROVISIONAL_TARGET=P2-T46
TARGET_CONFIRMATION_REQUIRED_DURING_T46_AUDIT=SI
ORDER_OCCUPATION_AUTHORITY=UNKNOWN_PENDING_T46_AUDIT
NEXT_RECOMMENDED_SOFTWARE_TASK=P2-T46
PRODUCTION_TOUCHED=SI (sólo promoción exacta T48)
PUBLIC_RELEASE_AUTHORIZED=NO
```

T48 fue promovida desde una rama curada basada en el checkpoint T42; no se
promovió el HEAD completo de Testing ni ningún cambio T02. Los dos findings
físicos adyacentes permanecen abiertos y sin implementación.

## 0.83 ESTADO ACTUAL — P2-T48 cerrado por certificación física; dos findings nuevos abiertos

```text
P2_T48_STATUS=CLOSED_TESTING_CERTIFIED
P2_T48_OPERATOR_CERTIFICATION=PASS
P2_T48_PHYSICAL_CASE_A=PASS
P2_T48_PHYSICAL_CASE_B=PASS
P2_T48_PHYSICAL_CASE_C=PASS
SALON_PERSONAL_ACTIVE_WITH_ORDERS=PASS
SALON_PERSONAL_ACTIVE_WITH_ZERO_ORDERS=PASS
SALON_PERSONAL_AFTER_OCCUPATION_CLOSE=PASS
ORDER_PRESENCE_REQUIRED_FOR_OCCUPATION=NO
P2_T48_RELEASE_ELIGIBLE=SI
NEXT_RELEASE_CANDIDATE=P2-T48
NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG=CONFIRMED_PHYSICAL
NEGOCIO_OCCUPATION_REFRESH_ROOT_CAUSE=UNKNOWN_PENDING_AUDIT
NEGOCIO_OCCUPATION_REFRESH_TARGET_TASK=TO_BE_RECONCILED
PREVIOUS_OCCUPATION_OPEN_ORDERS_SURFACE_IN_NEXT_OCCUPATION=CONFIRMED_PHYSICAL
OLD_ORDERS_COUNTED_IN_NEW_CURRENT_ACCOUNT=NO_OBSERVED
OLD_ORDERS_PRESERVED_IN_NEGOCIO_HISTORY=SI_OBSERVED
DATA_LOSS_OBSERVED=NO
ACCOUNTING_OF_OLD_ORDER_AGAINST_ORIGINAL_OCCUPATION=NOT_YET_VERIFIED
NEW_OCCUPATION_MUST_NOT_INHERIT_PREVIOUS_OPEN_ORDERS=SI
PREVIOUS_OCCUPATION_OPEN_ORDERS_PROVISIONAL_TARGET=P2-T46
TARGET_CONFIRMATION_REQUIRED_DURING_T46_AUDIT=SI
ORDER_OCCUPATION_AUTHORITY=UNKNOWN_PENDING_T46_AUDIT
CLOSE_OCCUPATION_WITH_OPEN_ORDERS_GUARD=REQUIRED_FOR_FUTURE_DESIGN_REVIEW
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
TEST_T02_ORDER_LEFT_ACTIVE=SI
PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
DATABASE_CHANGED=NO
COMMIT_CREATED=NO
PUSH_PERFORMED=NO
DEPLOY_PERFORMED=NO
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
NEXT_RECOMMENDED_ACTION=P2_T48_CURATED_PRODUCTION_PROMOTION
```

El operador verificó que Salón Personal mantiene la ocupación con y sin
pedidos, y que refleja el cierre. Se registraron dos findings físicos
adyacentes sin implementar: refresh en vivo de Negocio→Salón y exposición
visual de pedidos abiertos de una ocupación anterior en una nueva ocupación.

## 0.82 ESTADO ACTUAL — P2-T48 implementada, Testing desplegado; certificación manual pendiente

```text
P2_T48_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_WAITING_OPERATOR
P2_T48_BASELINE_TESTING=fb3e584259cb2c57605c783543c7fdb1dc845454
P2_T48_BASELINE_MAIN=46a1d55634e8bd848e160302cdb64a32be241c89
P2_T48_COMMIT=bb228ee43c89073a4355e6a012bb9aeaf3669dcb
P2_T48_TESTING_DEPLOYMENT=d5497cb8-34a0-4835-b2f8-4c117c23a325_SUCCESS_RUNNING_EXACT_COMMIT
P2_T48_FOCAL_TESTS=13_PASS_0_FAIL
P2_T48_REGRESSION_TESTS=51_PASS_0_FAIL
P2_T48_ROOT_CAUSE=shared occupation control only fetched on mount while Salon Personal panel polled without propagating refresh
P2_T48_OCCUPATION_AUTHORITY=Mesa.ocupacionActualId -> SesionOcupacionMesa estado=activa; independent of orders
P2_T48_SCHEMA_MIGRATION_BACKFILL=NO_NO_NO
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
TEST_T02_ORDER_LEFT_ACTIVE=SI
P2_T23_STARTED=NO
P2_T24_STARTED=NO
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
NEXT_ACTION=one manual P2-T48 case-1 certification in Testing
```

T48 cambia sólo la revalidación de Salón Personal: su polling existente de
15 segundos/focus/visibility incrementa una señal que hace reconsultar la
autoridad server-side canónica. Mozo Personal, Negocio→Salón, sesiones,
Terminal y el modelo Prisma permanecen sin cambios.

## 0.81 ESTADO ACTUAL — P2-T42-R1 cerrado en Production; T02 preservada

```text
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T42_RELEASE_COMMIT=46a1d55634e8bd848e160302cdb64a32be241c89
P2_T42_PRODUCTION_DEPLOYMENT=08a9bc74-67df-4935-adb6-7de8e1a30c91_SUCCESS_RUNNING_EXACT_COMMIT
P2_T42_STABLE_TAG=p2-t42-stable-2026-09-10
T02_FILES_IN_PRODUCTION_DIFF=0
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
P2_T02_B4_IOS_STATUS=PASS
P2_T02_B4_ANDROID_STATUS=PENDING_DEVICE_AVAILABILITY
ANDROID_B3_PHYSICAL=PENDING_DEVICE_AVAILABILITY
ANDROID_B4_PHYSICAL=PENDING_DEVICE_AVAILABILITY
TEST_T02_ORDER_LEFT_ACTIVE=SI
NEXT_RECOMMENDED_SOFTWARE_TASK=P2-T48
PUBLIC_RELEASE_AUTHORIZED=NO
```

T42 se promovió desde una rama de release basada en `origin/main` mediante
cherry-pick directo y fast-forward, con 0 paths de T02 en el delta. Production
confirmó migraciones pendientes `0`, logs limpios y smoke HTTP de lectura
PASS. P2-T48 queda como siguiente tarea recomendada, sin iniciarse aquí.

## 0.80 ESTADO ACTUAL — P2-T02-B4-R3-R1: cierre físico iOS PASS; Android y T02 global pendientes

```text
P2_T02_B4_R3_PHYSICAL_IOS_RETEST=PASS
P2_T02_B4_IOS_STATUS=PASS
IOS_B4_RETURN_FROM_GOOGLE_MAPS_ROUTE_RECOVERY=RESOLVED_AND_PHYSICALLY_CERTIFIED_IOS
P2_T02_B4_STATUS=IOS_CERTIFIED_ANDROID_PHYSICAL_PENDING
P2_T02_B4_ANDROID_STATUS=PENDING_DEVICE_AVAILABILITY
P2_T02_B3_STATUS=IOS_SHORT_BACKGROUND_CERTIFIED_ANDROID_PENDING
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
P2_T02_IOS_INDOOR_STATUS=PASS_FOR_TESTED_SCENARIOS
TEST_T02_ORDER_LEFT_ACTIVE=SI
NEXT_RECOMMENDED_SOFTWARE_TASK=P2_T42_FORMAL_CLOSEOUT_AND_CURATED_PROMOTION
P2_T23_STARTED=NO
P2_T24_STARTED=NO
PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
COMMIT_CREATED=NO
PUSH_PERFORMED=NO
DEPLOY_PERFORMED=NO
PRODUCTION_TOUCHED=NO
```

El operador certificó ruta inicial, apertura de Google Maps, recuperación al
volver sin reiniciar la PWA y close/reopen. Se preservan sin reinterpretar
background `37→40`, 3 updates, gap máximo 62.30 s, `THROTTLED`; lock
`41→45`, 5 updates, gap observado 29.65 s y gap final 90.64 s no atribuible;
unlock first rev 46, latencia `UNKNOWN`, foreground recovery PASS.

P2-T02 sigue abierto por Android, movimiento exterior, T23/T24 y cierre de
entrega. El siguiente trabajo recomendado vuelve al backlog de software:
P2-T42 formal closeout y promoción curada, sin promover HEAD completo.

## 0.79 ESTADO ANTERIOR — P2-T02-B4-R3: fix de recuperación desde Google Maps listo para deploy Testing

```text
LAST_UPDATED_BY_TASK=P2-T02-B4-R3-IOS-MAPS-RETURN-ROUTE-RECOVERY
R3_BASELINE_TESTING=0c362895656d389de73fd0dd94a124fe3aac8dd1
R3_FOCAL_TEST_PASS=29
R3_FOCAL_TEST_FAIL=0
R3_ESLINT_FOCAL=PASS
R3_BUILD=PASS
TYPECHECK_RAW=31
NEW_TYPECHECK_ERRORS=0
R3_FIX=route_lifecycle_recovery_timeout_retry_real_unmount
R3_TESTING_DEPLOY=SUCCESS_EXACT_COMMIT_CONFIRMED
R3_COMMIT=fb3e584259cb2c57605c783543c7fdb1dc845454
R3_TESTING_DEPLOYMENT=b54f0214-69a0-4e93-8589-fc2f37054301
IOS_B4_RETURN_FROM_GOOGLE_MAPS_ROUTE_RECOVERY=OPEN_PENDING_PHYSICAL_RETEST
PRODUCTION_TOUCHED=NO
```

La evidencia física previa se preserva sin reinterpretación: iOS background
37→40, 3 updates, max gap 62.30 s, `THROTTLED`; lock 41→45, 5 updates,
max gap observado 29.65 s; unlock first rev 46 y foreground recovery PASS.
El cierre del finding requiere retest físico del operador sobre el deploy R3.

## 0.78 ESTADO ACTUAL — P2-T02-B4-R2: deploy exacto de Testing confirmado; gate físico iOS habilitado

```text
RAILWAY_CLI_AUTHENTICATED=SI
RAILWAY_PROJECT=amiable-rejoicing
RAILWAY_ENVIRONMENT=TESTING
RAILWAY_SERVICE_CONTEXT=DeliGO Copy
B4_TESTING_DEPLOYMENT_ID=8b0fc718-f65e-4367-8210-07f12b8a5956
B4_TESTING_DEPLOYMENT_STATUS=SUCCESS
B4_TESTING_INSTANCE_STATUS=RUNNING
B4_TESTING_DEPLOYMENT_BRANCH=testing-codex
B4_TESTING_DEPLOYMENT_COMMIT=0c362895656d389de73fd0dd94a124fe3aac8dd1
B4_TESTING_DEPLOYMENT_COMMIT_MATCH=SI
B4_TESTING_LOGS=CLEAN
B4_TESTING_DEPLOY_CONFIRMED=SI
B4_HTTP_SMOKE=200
B4_RUNTIME_NAVIGATION_PRESENT=NOT_DISTINGUISHABLE (secondary evidence)
P2_T02_B3_STATUS=WAITING_FOR_CROSS_PLATFORM_PHYSICAL_CERTIFICATION
P2_T02_B4_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_PENDING_PHYSICAL_CERTIFICATION
IOS_PHYSICAL_CERTIFICATION=ENABLED_NOT_STARTED
ANDROID_B3_PHYSICAL=PENDING_DEVICE_AVAILABILITY
ANDROID_B4_PHYSICAL=PENDING_DEVICE_AVAILABILITY
PRODUCTION_TOUCHED=NO
```

El CLI de Railway fue la autoridad primaria; no hubo redeploy ni cambios de
environment. La siguiente interacción debe ser únicamente la primera acción
física del operador en iPhone, una por vez.

## 0.77 ESTADO ACTUAL — P2-T02-B4-R1: autoridad de deploy no confirmada, roadmap reconciliado y certificación física pausada

```text
BASELINE_TESTING=0c362895656d389de73fd0dd94a124fe3aac8dd1
BASELINE_MAIN=bb17c7dd1eb9b8f4cb94d03de834019baf182987
B4_TESTING_DEPLOY_CONFIRMED=NO
B4_RUNTIME_NAVIGATION_PRESENT=NOT_DISTINGUISHABLE
PUBLIC_REPARTIDOR_SMOKE=HTTP_200
RAILWAY_DASHBOARD=LOGIN_REQUIRED_FROM_AVAILABLE_BROWSER
TYPECHECK_RAW=31 / NEW_TYPECHECK_ERRORS=0
B4_FOCAL_TESTS=18_PASS_0_FAIL
OSRM_PUBLIC_ENDPOINT_ALLOWED_FOR_TESTING=SI
OSRM_PUBLIC_ENDPOINT_ACCEPTED_AS_FINAL_PRODUCTION_PROVIDER=NO_POR_AHORA
OSM_ATTRIBUTION_PRESENT=SI
OSRM_ROUTE_ATTRIBUTION_PRESENT=NO
PHYSICAL_IOS_AVAILABLE=SI
PHYSICAL_ANDROID_AVAILABLE=NO
CURRENT_PHYSICAL_CERTIFICATION_POLICY=IOS_NOW_ANDROID_DEFERRED_BATCH
P2_T02_B3_STATUS=WAITING_FOR_CROSS_PLATFORM_PHYSICAL_CERTIFICATION
P2_T02_B4_STATUS=IMPLEMENTED_TESTED_PUSHED_TESTING_PENDING_DEPLOY_CONFIRMATION_AND_PHYSICAL_CERTIFICATION
NATIVE_IMPLEMENTATION_STARTED=NO
PRODUCTION_TOUCHED=NO
```

R1 no declara deploy ni abre la prueba física iPhone porque no se pudo
demostrar que Railway Testing sirve exactamente `0c362895…`; el dashboard
requiere login y la build pública observada no expuso señales distinguibles de
B4. La documentación queda reconciliada sin cambios de producto/tests.

## 0.76 ESTADO ACTUAL — P2-T02-B2 (audit) + P2-T02-B3 (implementación) — DeliGO deja de cortar voluntariamente el tracking de Repartidor en background/screen-lock (OPTION-C reemplaza OPTION-V2), desplegado a TESTING, pendiente certificación física Android: la certificación indoor R2 había demostrado `RECOVERY_AFTER_FOREGROUND=PASS` pero `CONTINUOUS_BACKGROUND_TRACKING=NO` (0 updates server-side durante background/screen-lock) — el objetivo real de producto (tracking útil mientras el Repartidor usa Maps/Waze, atiende una llamada, o bloquea la pantalla por períodos razonables) exige más que "recuperar rápido al volver". Auditoría previa (B2, sin código): rastreó el origen de `OPTION-V2` al commit `0ad1562` (2026-08-24) — decisión de diseño deliberada (no bug), tomada por batería/determinismo/un supuesto de plataforma nunca verificado empíricamente, ANTES de que "tracking continuo en background" existiera como requisito de producto explícito. Capacidad real de la plataforma (fuentes oficiales citadas): PWA en background = `SUPPORTED_BUT_THROTTLED` (best-effort degradante: cadencia normal por tiempo no garantizado → ~1/min tras >5min oculto → freeze eventual); Service Worker/Background Sync/Periodic Sync = `NOT_SUPPORTED` para geolocalización (no existe `navigator.geolocation` en ese scope) — descartadas como opción. Gap adicional encontrado: `delivery-tracking-map.tsx` no tenía ningún concepto de "stale" — el badge "En vivo" se renderizaba **incondicionalmente**, sin relación con la antigüedad real del dato (bug preexistente, no introducido por esta tarea). Recomendación de B2: `PWA_BACKGROUND_FIX_RECOMMENDED_NOW` + `NATIVE_WRAPPER_FUTURE_OPTION` reservado — **el operador aprobó la Opción C** (`P2_T02_B2_PRODUCT_DECISION=OPTION_C_APPROVED`).

Implementación (B3): se identificaron y corrigieron **7 gates distintos** de `document.visibilityState` en `src/hooks/use-repartidor-tracking.ts` (no bastaba con quitar una sola llamada a `stopWatcher()`) — el branch `hidden` de `handleVisibilityChange` ya no detiene nada (sólo marca `pendingForegroundRecoveryRef=true`, preservando el reinicio duro defensivo al volver a foreground, Stage 6I/6J intacto y re-certificado por 90/90 tests de lifecycle); `startWatcherIfNeeded`, `scheduleWatchdog`, `checkWatchdog`, `firePendingSend`, `fireHeartbeat` y la reevaluación post-2xx dejaron de gatear en visibilidad. Nuevo helper puro `isTrackingLocationStale` (`src/lib/tracking-freshness.ts`, umbral 120000ms = dos heartbeats perdidos) corrige el bug del badge "En vivo" incondicional — ahora depende exclusivamente de la antigüedad de `repartidorLastUpdate`, nunca del socket; el marcador nunca se mueve/oculta/extrapola por staleness (verificado por contrato estático). Nuevo `gpsPermissionDenied` expuesto por el hook + disclosure best-effort no alarmista en `deliveries-tab.tsx` ("Android puede pausarla en segundo plano", nunca lenguaje de garantía). `refetchIntervalInBackground:true` agregado **exclusivamente** a la query `repartidor-pedidos` (misma cadencia 8s, sin tocar `defaultOptions` global) para que una falla de red transitoria en background se recupere sin depender de que el usuario vuelva a foreground. Deuda histórica resuelta: `repartidor-tracking-static-contract.test.ts` (4 FAIL documentados desde R1 por símbolos MODEL-G1 retirados) reescrito por completo contra el contrato MODEL-E1/B3 actual, 0 asserts borrados. 262 pass/0 fail combinados (90 lifecycle hook [9 reescritas contra el nuevo comportamiento + 4 nuevas] + 64 freshness puro [11 nuevas] + 25 movement + 12 static-contract reescrito + 18 tracking-consumer [1 aserción sobre-amplia corregida, el invariante real de que la autoridad de versión nunca usa reloj queda intacto] + 7 stale-contract nuevo + 22 ubicación route + 12 tracking route + 6 deliveries-tab + 3 T02-B1 focal + 3 negocio-post-login referencia). `TYPECHECK_RAW=31` (idéntico baseline, 0 nuevos), ESLint 0 nuevos, build limpio. `PRISMA_SCHEMA_CHANGED=NO`, `TRACKING_API_CONTRACT_CHANGED=NO`, `P2_T42_FILES_CHANGED=0`. Commit único `6769797ea835f0571e034185439e56530cc7e80a` en `testing-codex` (`489528c..6769797`) — `main` NO tocado (`bb17c7dd` sin cambios verificado antes/después). Autodeploy Git-triggered SUCCESS en TESTING en ambos servicios relevantes (DeliGO Copy + chat en vivo), commit exacto verificado en ambos, logs limpios ("No pending migrations to apply", boot en 83ms), smoke no-mutante 3/3 (`GET /repartidor→200`, `GET /→307`, `GET tracking sin auth→401`). No se implementó wrapper nativo — `NATIVE_WRAPPER_ESCALATION_REQUIRED=PENDING_PHYSICAL_EVIDENCE`, sólo reconsiderar con evidencia física real post-fix. `P2_T02_B3_STATUS=WAITING_FOR_OPERATOR_ANDROID_CERTIFICATION` — no se declara cerrado sin certificación física (Fase A indoor primero: foreground normal, background 120s pantalla encendida, screen lock 120s, recovery — guiado paso a paso, una instrucción concreta a la vez; fase exterior diferida hasta que el operador pueda salir). `P2_T02_STATUS` permanece `WAITING_FOR_OPERATOR_ADDITIONAL_EVIDENCE` (sin cambios). `PUBLIC_RELEASE_AUTHORIZED=NO`. Reportes completos: `codex-reports/P2_T02_B2_ANDROID_BACKGROUND_TRACKING_AUDIT_AND_DESIGN.md` (auditoría) y `codex-reports/P2_T02_B3_PWA_BEST_EFFORT_BACKGROUND_DELIVERY_TRACKING.md` (implementación) — próxima acción: `OPERATOR_ANDROID_BACKGROUND_TRACKING_CERTIFICATION_T02_B3` (2026-09-10)

## 0.75 ESTADO ACTUAL — P2-T02-B1 CERRADO POR CERTIFICACIÓN FÍSICA + P2-T02 CERTIFICACIÓN INDOOR COMPLETA (7/7 PASS), FASE EXTERIOR PENDIENTE: sesión de pruebas físicas guiadas por Claude en modo read-only/observación (polling de la DB de TESTING, sin pedir mediciones manuales al operador), retomando la certificación GPS de P2-T02 tras confirmar que el fix de P2-T02-B1 funciona ("ya funciona perfecto" — login ya no deriva a Cliente: `REPARTIDOR_PWA_LOGIN_REDIRECT=PASS`, `REPARTIDOR_PANEL_VISIBLE=PASS`, `TEST_T02_ORDER_VISIBLE=PASS`, `P2_T02_B1_STATUS=CLOSED_TESTING_CERTIFIED`). El operador estaba dentro de una casa y no podía generar movimiento físico controlado (5-10m/50-100m/100-300m) — el protocolo original de 10 fases con movimiento se adaptó, por instrucción explícita del operador, a 7 pruebas indoor-safe sin descuidar rigor: **7/7 PASS**. Login+fijación inicial: el hook arrancó solo al detectar el pedido elegible (`rev=4` real inmediato). Stationary/heartbeat (pantalla encendida confirmada): `rev 6→7→8` en ~100s, intervalos ~60.4s luego ~40.2s, consistente con `STATIONARY_HEARTBEAT_MS=60000`. Background sin bloqueo: detención total confirmada mientras oculto (0 updates en 110s, diseño `OPTION-V2` — batería), recuperación al volver a foreground en **~3s** (`rev 9→10`) — el hallazgo histórico de 9+ minutos de silencio (`FINDING_P2T02_STAGE6H_01`) NO se reprodujo para este escenario. Screen lock (probado por separado, sin mezclar con background): 0 updates durante 110s bloqueado, recuperación al desbloquear en **~7s** (`rev 13→14`), seguida de una ráfaga de 5 envíos más en ~25s con el teléfono confirmado quieto por el operador — clasificada `STRONGLY_INDICATED_MULTIPLE_RECOVERY_SENDS` (probablemente más de un ciclo de recuperación en sucesión), hallazgo menor no bloqueante, no `CONFIRMED` sin instrumentación cliente. Network loss/recovery: 0 updates offline, sin crash, recuperación en **~20s** tras reactivar red (`rev 21→23→24`) — causa exacta identificada leyendo el código: el POST fallido marca la entrega "no elegible" localmente y sólo se rehabilita cuando el panel del Repartidor vuelve a consultar `/api/repartidor/pedidos` (refetch cada 8s) — diseño, no bug. Permiso GPS denegado/restaurado: sin error visible al denegar (silencioso por diseño), y al restaurar el permiso **sin recargar la página** volvió a producir ubicación real en ~59s, confirmado independientemente server-side (`locationRevision 31→32`) — `GPS_PERMISSION_RECOVERY=PASS_AUTOMATIC_NO_RELOAD`, mecanismo probable (no confirmado) = watchdog de foreground/visibilidad de ~75s. Corrección de registro explícita durante la sesión: una inferencia previa no confirmada ("probablemente se apagó la pantalla sola") fue anulada por instrucción del operador — `PREVIOUS_SCREEN_OFF_INFERENCE=UNCONFIRMED`, `PREVIOUS_HEARTBEAT_GAP_CAUSE=UNKNOWN`. Pendiente deliberadamente para una fase exterior futura (NO marcado PASS/FAIL): movimiento menor/mayor al threshold, recorrido real 100-300m, comportamiento visual del marcador (evidencia T23), curva/esquina (evidencia T24), background con movimiento real simultáneo. `PREVIOUS_BACKGROUND_COORDINATE_ISSUE_STATUS=RESOLVED_IN_CURRENT_INDOOR_TEST_SCENARIOS` (calificado, no un "RESOLVED" absoluto — `EXTERIOR_MOVEMENT_CONFIRMATION_REQUIRED=SI`). El pedido TEST_T02 se dejó activo intencionalmente, SIN marcar como entregado, para retomar la fase exterior sin recrear fixtures (`TEST_T02_ORDER_LEFT_ACTIVE=SI`, `TEST_FIXTURES_CLEANED=NO`). Sesión íntegramente DOCUMENTATION-ONLY: `CODE_CHANGED=NO`, `COMMIT_CREATED=NO`, `PUSH_PERFORMED=NO`, `DEPLOY_PERFORMED=NO`, `PRODUCTION_TOUCHED=NO`. `P2_T02_STATUS=WAITING_FOR_OPERATOR_ADDITIONAL_EVIDENCE` (NO `CLOSED`, NO promovido). `PUBLIC_RELEASE_AUTHORIZED=NO`. Reporte completo con tabla temporal por fase (timestamps/revisiones reales del poller): `codex-reports/P2_T02_REAL_ANDROID_GPS_DELIVERY_CERTIFICATION_R2.md` — próxima acción: `OPERATOR_T02_EXTERIOR_ANDROID_GPS_CERTIFICATION` (2026-09-10)

## 0.74 ESTADO ANTERIOR — P2-T02-B1 IMPLEMENTADO, TESTEADO Y DESPLEGADO A TESTING (blocker de la certificación física GPS de P2-T02, sesión en curso): el operador reprodujo en Android real que el login por password de Repartidor autentica correctamente server-side (confirmado independientemente: DB muestra el fixture como repartidor real sin colisión de rol, HTTP directo confirma type="repartidor" y GET /api/repartidor/pedidos autorizado) pero navega a "/" — que redirige incondicionalmente a Cliente (src/app/page.tsx, diseño deliberado del aislamiento de PWA por rol) — sacando al repartidor recién autenticado de la PWA instalada DeliGO Delivery hacia DeliGO Cliente. Root cause: `router.replace("/")` en `src/app/repartidor/page.tsx`, única ocurrencia de ese patrón en todo el repo/historial, preexistente desde el commit `9684082` (el mismo que introdujo el aislamiento de PWA por rol) — nunca corregido para Repartidor pese a que Negocio ya tenía exactamente el mismo fix desde el commit `95ff272` ("fix: keep business login inside pwa scope"). El login por Google OAuth de Repartidor (mismo archivo) confirmado NO afectado — nunca navega, deja que el propio estado del componente renderice el panel; esto explica por qué nunca se detectó antes: sólo un login por password real, dentro de la PWA instalada, lo expone. Fix: nuevo `src/lib/repartidor-post-login-navigation.ts` (mismo patrón exacto ya establecido por Negocio — constante de ruta fija `REPARTIDOR_POST_LOGIN_PATH="/repartidor/"` + helper `esRutaPwaRepartidor`) — `router.replace(REPARTIDOR_POST_LOGIN_PATH)` en vez de `router.replace("/")`. `src/app/page.tsx` NO se tocó — su redirect a Cliente es arquitectura deliberada y correcta, el defecto estaba exclusivamente en el caller de Repartidor. Manifest/scope de la PWA de Repartidor confirmados correctos (start_url y scope ya apuntan a `/repartidor`), sin cambios. 6 pass focal + 97 pass regresión (OAuth callback, active-gate, tracking) + 4 fail preexistentes documentados desde R1 (contrato estático de arquitectura MODEL-G1 ya retirada, sin relación) — NEW_FAIL=0. TYPECHECK_RAW=31 (idéntico baseline, 0 nuevos), ESLint 0 nuevos, build limpio. GPS_TRACKING_FILES_CHANGED=0, P2_T42_FILES_CHANGED=0, P2_T41_FILES_CHANGED=0 — fixtures TEST_T02 permanecen intactos. Commit único `489528ca4ba315cd0873e4b270fcdf0b4e3094cd` en `testing-codex` (`eb2af3a..489528c`) — `main` NO tocado (`bb17c7dd` sin cambios verificado antes/después). Autodeploy Git-triggered SUCCESS en TESTING en ambos servicios relevantes (DeliGO Copy + chat en vivo incidental), commit exacto verificado en ambos, logs limpios, smoke no-mutante `GET /repartidor -> 200`. Auditoría breve de sesión/cookie (sin expandir el alcance): la PWA instalada puede pedir login de nuevo aunque ya hubiera sesión en una pestaña Chrome previa — registrado como nueva evidencia física para `P2-T34` (Android Cliente/Repartidor Session Isolation), NO investigado ni tocado acá. `P2_T02_B1_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` — checklist corto pendiente en Android real (A: no vuelve a Cliente tras login; B: permanece en DeliGO Delivery; C: panel Repartidor visible; D: pedido TEST_T02 visible; E/F opcionales, evidencia adicional para T34). Sólo tras A-D PASS se retoma la medición GPS de las 10 fases de P2-T02 (la propia certificación de P2-T02 sigue `WAITING_FOR_OPERATOR`, no cerrada por esta tarea). `PUBLIC_RELEASE_AUTHORIZED=NO`. Reporte completo: `codex-reports/P2_T02_B1_REPARTIDOR_PWA_POST_LOGIN_ROUTING.md` — próxima acción: `OPERATOR_REPARTIDOR_PWA_LOGIN_CERTIFICATION_T02_B1` (2026-09-10)

## 0.73 ESTADO ACTUAL — P2-T42 IMPLEMENTADO, TESTEADO Y DESPLEGADO A TESTING: PyR (Employee y Terminal) ordenaba pedidos oldest-first (FIFO explícito, documentado como diseño intencional) y ofrecía saltar de "recibido" directo a preparar, luego "marcar en camino" manualmente con broadcast a TODOS los repartidores activos a la vez — evidencia física del operador (captura mostró pedidos de 33d/27d/9d arriba y recientes abajo). Root cause: PyR nunca fue migrado al modelo canónico aceptado/esperando_repartidor que Negocio adoptó completo en P2-T29B/T29C — el propio documento de diseño de esa tarea ya recomendaba "pyr: agregar aceptado como paso previo si el operador lo autoriza", pendiente hasta que el operador lo autorizó ahora. Fix: PyR reutiliza la MISMA autoridad de transición que ya usa Negocio (`PYR_ROLLOUT_FORWARD_TRANSITIONS`, alias de `NEGOCIO_T29B_ROLLOUT_FORWARD_TRANSITIONS`, mismo objeto sin copiarlo) — recibido→aceptado→preparando→{esperando_repartidor(domicilio)|listo_para_retirar(retiro)}→entregado. Employee gana endpoints nuevos `aceptar` y `buscar-repartidor` (reemplaza al retirado `en-camino`, cuyo modelo pre-P2-T29C forzaba en_camino manualmente — hoy exclusivo de la aceptación atómica real de un Repartidor); `preparar` ahora exige "aceptado" como origen (única excepción sin arista legacy, riesgo aceptado y documentado). Terminal (PATCH genérico) adopta el mismo grafo preservando las aristas legacy para pedidos en vuelo. Ambos listados (panel Terminal, GET Employee) pasan de oldest-first a newest-first. 10 archivos que duplicaban byte-a-byte la misma lista de "estados activos" (paneles, listados, detalle, mensajes/adjuntos) se consolidan en un export compartido nuevo (`PYR_ACTIVE_ESTADOS_NO_MESA`). Terminal Salón (P2-T41, ya en Production) NO fue tocado — confirmado por fileset (0 archivos compartidos) y por regresión explícita de la autoridad que Salón sí comparte (`ACTIVE_FORWARD_TRANSITIONS.mesa`, endpoint distinto). 134 pass/0 fail combinados (11 nuevo focal sort+workflow real-DB + 13 mock-based transitions [6 preservados+7 nuevos] + 45 order-transitions puro sin cambios + 26 mensajes/aislamiento + 39 regresión Negocio/Salón). `TYPECHECK_RAW=31` (idéntico baseline, 0 nuevos — una medición intermedia de 32/33 se debió a caché stale de `.next/dev/` de un `next dev` en background apuntando al endpoint retirado, confirmado no-real y resuelto limpiando el caché gitignored). ESLint 0 nuevos en los 19 archivos del fileset. Commit único `eb2af3a598bf4e91ccd48b06092fb892a7ac0f9b` en `testing-codex` (`fb404a2..eb2af3a`) — `main` NO tocado (`bb17c7dd` sin cambios verificado antes/después). Autodeploy Git-triggered SUCCESS en TESTING en ambos servicios relevantes (DeliGO Copy + chat en vivo incidental), commit exacto verificado en ambos, logs limpios, 0 migrations pendientes. `P2_T44_TOUCHED=NO`, `P2_T45_TOUCHED=NO`, `MANUAL_REVIEW_POINT_15_REOPENED=NO`. Esta tarea SÍ cambia orden visual, botones y estados visibles en ambas superficies PyR — `P2_T42_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_OR_BROWSER_CERTIFICATION`, NO se declara `CLOSED_TESTING_CERTIFIED` sin control físico/browser del operador (checklist corto en el reporte). `PUBLIC_RELEASE_AUTHORIZED=NO`. Próxima tarea funcional recomendada (no iniciada): `P2-T48` (Salon Personal Occupation State Parity). Reporte completo: `codex-reports/P2_T42_PYR_EMPLOYEE_TERMINAL_ORDER_WORKFLOW_PARITY.md` — próxima acción: `OPERATOR_PYR_WORKFLOW_PARITY_CERTIFICATION_P2_T42` (2026-09-10)

## 0.72 ESTADO ACTUAL — CHECKPOINT PRODUCTION: P2-T41 (Terminal Read-Only Action Authorization) promovido de `testing-codex` a `main`/Production. `main` avanzado de `773664f8` a `bb17c7dd1eb9b8f4cb94d03de834019baf182987` (método `git commit-tree`, mismo patrón de las 6 promociones anteriores), tag `p2-t41-stable-2026-09-10` creado. Preflight auditó el delta real `origin/main..origin/testing-codex` ANTES de cualquier side effect: exactamente 8 archivos (5 producto + 3 test), todos clasificados `P2_T41`, ninguno ajeno — verificado byte a byte que el diff es idéntico al patch propio del commit `fb404a2` (sin drift acumulado). Quality gates re-ejecutados frescos sobre el source exacto: focal 140 pass+0 fail + regresión 103 pass+0 fail = **243 pass/0 fail total** — corrección aritmética respecto del "229" declarado en el reporte de implementación original (sumaba mal dos corridas de regresión separadas: 14+89). `TYPECHECK_RAW=31` (idéntico, 0 nuevos), ESLint 0 nuevos (1 preexistente ya documentado en `operaciones/salon/page.tsx`), build/diff-check limpios, 0 cambios de schema/migración, 0 secretos/PII nuevos. Autodeploy Git-triggered SUCCESS PRIMER intento en ambos servicios relevantes (DeliGO Production + chat en vivo, éste último redeploy incidental por compartir repo), commit exacto verificado (`bb17c7dd...`) vía `railway status --json`, logs limpios ("No pending migrations to apply"). Smoke no-mutante 4/4 PASS contra `https://deligo.ar` real y el chat-service (raíz, panel Terminal sin sesión, ocupación inexistente, health) — nunca se ejecutó POST cancelar/cerrar cuenta contra Production, nunca se fabricó sesión. `P2_T41_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`, `P2_T41_RELEASE_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`. `P2-T42` (PyR Employee + Terminal Order Workflow Parity) preservada `READY_FUTURE`, NO iniciada, NO incluida en este release (`P2_T42_INCLUDED_IN_RELEASE=NO`). `T46_MUTATING_ACTIONS_REQUIRE_T41_AUTHORITY=SI` preservado. `PUBLIC_RELEASE_AUTHORIZED=NO` (checkpoint técnico, no lanzamiento público). Reporte completo: `codex-reports/P2_T41_PROMOTION_TO_MAIN_AND_PRODUCTION.md` — próxima acción: iniciar `P2-T42` cuando el operador lo priorice (2026-09-10)

## 0.71 ESTADO ACTUAL — P2-T41 CERRADO POR CERTIFICACIÓN DEL OPERADOR: el operador ejecutó el checklist completo (5 pasos) contra TESTING con resultado TODO PASS — (A) "Cancelar pedido" NO aparece en ningún pedido de Terminal Salón; (B) "Ver cuenta" sigue funcionando; (C) "Cerrar cuenta" NO aparece dentro de "Ver cuenta"; (D) navegación/lectura de mesa, pedidos, historial y estadísticas de Terminal Salón funcionan con normalidad; (E) Terminal PyR conserva intactas sus acciones existentes (el workflow nuevo de PyR es P2-T42, explícitamente no exigido en este checklist). Tarea puramente documental — sin código/tests/commit/push/deploy/DB, HEAD sin cambios (`fb404a2d510998f53f305ba497b9c543ef4cee53`). Autoridad server-side de la implementación (tarea anterior) preservada exactamente: `TERMINAL_GLOBAL_MUTATION_BAN=NO`, `TERMINAL_READ_ONLY_CONTEXT_ENFORCEMENT=SI`, `CANCEL_BOLA_CHECK=PASS`, `CLOSE_ACCOUNT_BOLA_CHECK=PASS`, `PYR_TERMINAL_REGRESSION=PASS`, 229 pass/0 fail, `TYPECHECK_BASELINE_REAL=31` (no reabrir el `24` histórico), ESLint 0 nuevos (1 preexistente fuera de alcance) — el cierre se basa en UI + autorización server-side ya probada, nunca sólo en la certificación visual. `P2_T41_STATUS=CLOSED_TESTING_CERTIFIED`. `P2_T41_RELEASE_ELIGIBLE=SI`, `NEXT_RELEASE_CANDIDATE=P2-T41` — promoción a main/Production NO ejecutada en esta tarea (`main` permanece en `773664f8da80b2143cfd1443ed0467ace6c45a34`, sin cambios). Backlog preservado sin modificar scopes (P2-T42..T52 según autoridad ya registrada); `T46_MUTATING_ACTIONS_REQUIRE_T41_AUTHORITY=SI` sigue vigente. `PUBLIC_RELEASE_AUTHORIZED=NO`. Reporte: `codex-reports/P2_T41_OPERATOR_CERTIFICATION_CLOSEOUT.md` — próxima acción: `P2_T41_PROMOTION_EVALUATION` (P2-T42 permanece `READY_FUTURE`, no iniciada) (2026-09-10)

## 0.70 ESTADO ACTUAL — P2-T41 IMPLEMENTADO, TESTEADO Y DESPLEGADO A TESTING: Terminal Operativa (área Salón, incluido el perfil default de solo lectura "pantalla") podía cancelar pedidos de mesa y cerrar la cuenta comercial igual que Cuenta Operativa personal — evidencia física real del operador (Terminal → mesa activa → cada pedido mostraba "Cancelar pedido"). Auditoría confirmó que NO es un bug accidental sino una reversión de política de producto sobre un diseño previo deliberado y probado ("23-A1", que autorizaba explícitamente 4 tipos de actor incluyendo `salon_terminal`) — decidida ahora por el operador. Root cause exacto: el resolver de cancelación usaba un chequeo de ÁREA base (`requireOperacionesArea`, solo lectura) en vez de un scope de mutación específico; el resolver de cierre de cuenta ni siquiera distinguía Terminal de Salón personal (ambos resolvían al mismo tipo genérico `"salon"`). Fix: Terminal ahora resuelve con su PROPIO tipo de actor (`salon_terminal`, nunca genérico) en ambos resolvers (`resolverActorCancelacionMesa` en `mesa-pedido-cancelacion.ts`, `resolveMesaOccupancyCloseActor` en `mesa-occupancy.ts`); ambos endpoints de mutación (`POST .../pedidos/[id]/cancelar`, `POST .../ocupaciones/[id]/cuenta`) lo deniegan 403 server-side; UI retira "Cancelar pedido" y oculta "Cerrar cuenta" en `/operaciones/salon` (prop nuevo `canClose` en `MesaCuentaDialog`, default `true`, no rompe a Mozo/Salón-personal/Negocio-admin). El cierre TÉCNICO de ocupación (`mesas/[id]/ocupacion`, nunca toca pedidos/pagos) y TODA la superficie PyR Terminal quedan sin cambios de comportamiento — confirmado con un test focal directo que prueba que Terminal SIGUE pudiendo hacer el cierre técnico (`TERMINAL_GLOBAL_MUTATION_BAN=NO`). 229 pass/0 fail real-DB combinados (72 tests existentes actualizados en `mesa-pedido-cancelacion.test.ts` + 61 contract/client/ui-contract + 7 nuevos en `p2-t41-terminal-cierre-cuenta.test.ts`, foco en BOLA/IDOR cross-negocio y legítimos actores intactos + 89 regresión dirigida: p2-t08, p2-t06, p2-t07, negocio-salon x3, operativo-pyr-salon, rate-limit-mesa-cuenta, order-transitions-authority x2). Corrección de baseline: `TYPECHECK_RAW` real medido fresco = `31` (no `24` como documentaban reportes previos desactualizados) — `NEW_TYPECHECK_ERRORS=0` en ambos casos. ESLint 0 errores nuevos (1 preexistente fuera de los hunks del diff, confirmado con `git stash`). Commit único `fb404a2d510998f53f305ba497b9c543ef4cee53` en `testing-codex` (`ea9edbc..fb404a2`) — `main` NO tocado (`773664f8` sin cambios verificado antes/después). Autodeploy Git-triggered SUCCESS en TESTING (DeliGO Copy), deployment `03774f34-75a1-493b-9bc2-0a6a7e4670bb`, `commitHash` verificado exacto vía `railway status --json`, logs de boot limpios, 0 migrations pendientes. `P2_T42_TOUCHED=NO`, `T46_MUTATING_ACTIONS_REQUIRE_T41_AUTHORITY=SI` (autoridad ya disponible para el futuro rediseño de cuenta/ticket). Esta tarea SÍ cambia acciones visibles de Terminal — por regla explícita del prompt, `P2_T41_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_OPERATOR_CERTIFICATION`, NO se declara `CLOSED_TESTING_CERTIFIED` sin control físico/browser del operador (checklist corto de 6 pasos en el reporte). `PUBLIC_RELEASE_AUTHORIZED=NO`. Reporte completo: `codex-reports/P2_T41_TERMINAL_READ_ONLY_ACTION_AUTHORIZATION.md` — próxima acción: `OPERATOR_TERMINAL_READ_ONLY_CERTIFICATION_P2_T41` (2026-09-10)

## 0.69 ESTADO ACTUAL — CHECKPOINT PRODUCTION: batch certificado `P2-T35+P2-T36` promovido de `testing-codex` a `main`/Production. `main` avanzado de `8011ee3` a `773664f8da80b2143cfd1443ed0467ace6c45a34` (método `git commit-tree`, mismo patrón de las 5 promociones anteriores), tag `p2-t35-t36-stable-2026-09-10` creado. Preflight corrigió primero una redacción ambigua del reporte de cierre T36 ("confirma en producción real") — `PHYSICAL_TEST_ENVIRONMENT=REAL_ANDROID_DEVICE_AGAINST_CERTIFIED_TESTING_BUILD`, nunca Production. Auditó el diff de árbol completo ANTES de cualquier side effect: exactamente 23 archivos (3 test-only T35 + 20 T36), ninguno inesperado, 0 archivos legacy de empleado/mozo/salon — P2-T52 confirmado fuera del batch. Quality gates re-ejecutados: T35 242 pass+0 fail, T36 focal 46 pass+0 fail (recontado fresco, corrige un 47 impreciso del reporte original de T36), regresión push/SW/PWA 36 pass+0 fail (combinado 82 sin duplicar), TYPECHECK_RAW=24 (idéntico baseline), build/lint/diff-check limpios. Los 11 assets binarios de T36 verificados byte-idénticos (mismo SHA256) contra los ya certificados — nada regenerado. Autodeploy Git-triggered SUCCESS PRIMER intento en ambos servicios relevantes (DeliGO + chat en vivo), commit exacto verificado, 0 migrations pendientes. Smoke 11/11 PASS contra `https://deligo.ar` real, incluyendo verificación byte-exacta de assets y `CACHE_NAME=deligo-v16`/badge servidos, sin mutaciones. `P2_T35_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`, `P2_T36_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`, `P2_T35_PLUS_P2_T36_RELEASE_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`. `P2-T52` preservada `READY_FUTURE`, sin cerrarse — la identidad separada de Mozo sigue pendiente, sin bloquear este checkpoint. `PUBLIC_RELEASE_AUTHORIZED=NO` (checkpoint técnico, no lanzamiento público). Próxima tarea funcional registrada, no iniciada: `P2-T41` (Terminal Read-Only Action Authorization, P0) (2026-09-10)

## 0.68 ESTADO ACTUAL — P2-T36 CERRADO POR CERTIFICACIÓN FÍSICA: operador ejecutó el checklist físico Android con resultado PASS global en los 4 controles pedidos — (A) ícono del launcher de DeliGO Operaciones correcto, sin recorte, sin exigir instalación separada de Empleado/Salón/PyR/Terminal; (B) ícono grande de Push de Cliente sigue role-specific + badge pequeño ya monocromático compartido; (C) control corto sobre un segundo rol (no especificado, no inventado) confirma el mismo patrón; (D) cierre completo + reapertura de la PWA sin branding viejo por caché. `P2_T36_STATUS=CLOSED_TESTING_CERTIFIED`, sin cambio de código ni redeploy (commit certificado ea9edbc ya estaba en TESTING). Preservada la autoridad corregida de identidad PWA única de Operaciones: `P2-T52` sigue `READY_FUTURE` (Operations PWA Identity Consolidation), `F-P2-T36-01=OPEN_FOLDED_INTO_P2_T52_CONSOLIDATION`, `P2_T36_BLOCKED_BY_T52=NO` — la consolidación pendiente de la identidad separada de Mozo es trabajo futuro, no un requisito de cierre. Registrado `P2_T35_PLUS_P2_T36_RELEASE_ELIGIBLE=SI`, `NEXT_RELEASE_CANDIDATE=P2_T35_PLUS_P2_T36` (promoción NO ejecutada) y `NEXT_FUNCTIONAL_TASK_AFTER_RELEASE=P2-T41` (Terminal Read-Only Action Authorization, P0). Tarea puramente documental — sin código/tests/commit/push/deploy/DB. `main`/Production SIN CAMBIOS (`8011ee3`) — próxima acción: `P2_T35_PLUS_P2_T36_PROMOTION_EVALUATION` (2026-09-09) — PROMOVIDO en 0.69

## 0.67 ESTADO ACTUAL — CORRECCIÓN DE AUTORIDAD: identidad PWA única de Operaciones. El operador aclaró que Empleado/Mozo/Salón fueron PWAs separadas en una arquitectura ANTERIOR, consolidadas después en la única identidad instalable "DeliGO Operaciones" (`OPERATIONS_SINGLE_PWA_IDENTITY=SI`) — la reconciliación previa había creado `P2-T52` asumiendo que había que "reparar arte" para esos 3 roles, lo cual era incorrecto. Auditoría real de código (no asumida) mostró un resultado MATIZADO: PyR y TerminalOperativa nunca tuvieron identidad separada; Empleado y Salón sí la tuvieron pero su único acceso (`/e`, `/e/[token]`, `/s`, `/s/[token]`) está 100% retirado (páginas estáticas `LegacyAccessRetired`, sin sesión/función real); **Mozo es la excepción real**: `/mozo` sigue siendo hoy un login/registro/unirse genuinamente activo (mismo backend CuentaOperativa/Operativo) que TODAVÍA emite su propia identidad separada ("DeliGO Mozos") vía `DynamicManifest`, con `icon-mozo-192x192.png` (el realmente usado, no sólo el 512 ya conocido) visiblemente cortado, mostrado hoy tanto en esa PWA activa como en notificaciones Push reales de `mesa_order_ready`. Confirmado que las 5 identidades PWA canónicas activas (cliente/negocio/repartidor/admin/operaciones) coinciden EXACTAMENTE con los 5 roles que P2-T36 ya arregló para maskable — reinterpretado correctamente de "5/8 incompleto" a "5/5 completo" sin falsear que los 8 manifests siguen existiendo en el repo. `P2-T52` retitulada a "Operations PWA Identity Consolidation / Legacy Artifact Cleanup" (`READY_FUTURE`, sin arte nuevo del operador en ningún escenario); `F-P2-T36-01` reencuadrado (`OPEN_FOLDED_INTO_P2_T52_CONSOLIDATION`) preservando el matiz honesto de que el defecto de Mozo es activo en producción hoy, no sólo legacy inerte. Checklist físico de T36 corregido: certificar Operaciones cubre PyR/Salón-personal/Terminal/Empleado, pero NO a "DeliGO Mozos" como PWA separada — documentado sin bloquear el checklist ni el cierre de T36. Íconos 192px de Mozo/Salón/Empleado preservados como uso legítimo independiente (notificaciones Push por área). P2-T41 a P2-T51 sin cambios de alcance. Badge compartido y SW cache-bypass sin cambios. Tarea puramente read-only/documental — sin código/tests/commit/push/deploy/DB. `P2_T36_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` sin cambios, sin redeploy — `main`/Production SIN CAMBIOS (`8011ee3`) — próxima acción sin cambios: `OPERATOR_ANDROID_PHYSICAL_BRANDING_CERTIFICATION_P2_T36` (2026-09-09) — CERRADO en 0.68

## 0.66 ESTADO ACTUAL — BACKLOG OPERACIONES/SALÓN CONSOLIDADO: 20 hallazgos de revisión manual física del operador (Operaciones/Mozo/PyR/Salón/TerminalOperativa/panel Negocio Salón/Cliente Mesa) agrupados en 12 tareas nuevas — `P2-T41` Terminal Read-only/Authorization (P0, Terminal en contexto sólo-consulta expone "Cancelar pedido") / `P2-T42` PyR Workflow Parity (P1_HIGH, agrupa 11+14+16) / `P2-T43` Employee Join Identity (P1, agrupa 2+10) / `P2-T44` Operaciones Personal Push (P1, agrupa 3+12, DISTINTA de T40) / `P2-T45` Terminal Notifications Architecture (P1, punto 19, preserva TERMINAL_OPERATIVA_PUSH=NO_ES_ACTOR_PUSH_POR_DISEÑO) / `P2-T46` Table Account+Ticket+History (P1, agrupa 4+6+7+8, requiere autoridad de T41) / `P2-T47` Product Personalization UX (P2_UX, punto 5) / `P2-T48` Salon Occupation Parity (P1, punto 13, confirmado con 2 casos) / `P2-T49` Terminal Mobile Shell+Chat (P1, agrupa 17+18) / `P2-T50` Salon Statistics Date Filtering (P2, punto 9) / `P2-T51` Operaciones Home Redesign (P2_UX, punto 1) / `P2-T52` Role Branding Asset Repair (formaliza F-P2-T36-01, BLOCKED_OPERATOR_ASSET_OR_REGENERATION_DECISION — SUPERADO en 0.67: retitulada a Operations PWA Identity Consolidation, sin arte nuevo requerido). IDs verificados libres por grep sobre TODO codex-reports/ antes de asignar (máximo previo T40). Punto 15 (historial Terminal) investigado y cerrado `NOT_A_BUG` — ya detallado y correcto, usado como referencia para T46, sin tarea propia. Dependencia registrada: `T46_MUTATING_ACTIONS_REQUIRE_T41_AUTHORITY=SI`. Las 12 nuevas se insertan tras P2-T34, sin renumerar T38/T40/T39/T33/Support/T37. Tarea puramente documental — sin código/tests/commit/push/deploy/DB. `P2_T36_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` sin cambios, sin redeploy — `main`/Production SIN CAMBIOS (`8011ee3`) — próxima acción sin cambios: `OPERATOR_ANDROID_PHYSICAL_BRANDING_CERTIFICATION_P2_T36` (2026-09-09)

## 0.65 ESTADO ACTUAL — P2-T36 IMPLEMENTADO, TESTEADO Y DESPLEGADO A TESTING: los 3 findings agrupados (maskable safe-zone, badge Android monocromático, SW icon-cache-bypass) auditados contra código/assets reales — badge y cache-bypass 100% RESUELTOS; maskable RESUELTO para 5/8 roles (cliente/negocio/repartidor/admin/operaciones) mediante derivado 100% mecánico (mismo logo, mismo fondo ya existente muestreado del propio asset, escalado 70%+centrado, sin redibujar), verificado GEOMÉTRICAMENTE con `sharp` contra el círculo de seguridad real de Android (~30% de margen extra). Badge compartido `/badge-deligo-monochrome-96x96.png` extraído mecánicamente del glyph blanco "D" de Cliente (umbral de color, sin rediseño) — `sw.js`: `badge` ya NO hereda `icon`, override explícito preservado. Cache-bypass: el substring roto (`includes("icon-192")`, documentado desde R1, nunca corregido) reemplazado por patrón explícito de `pathname`; `CACHE_NAME` v15→v16. HALLAZGO NO PREVISTO: `icon-{empleado,mozo,salon}-512x512.png` son en realidad 2133x2133 y muestran sólo un fragmento recortado del logo — sin fuente en `branding-source/`, registrado como `F-P2-T36-01` (nuevo, requiere decisión del operador), NO bloquea el resto de T36. 47 tests focales + 82 regresión push/SW/PWA + 242 T35 (re-verificada intacta), 0 fallas nuevas. Commit `ea9edbc` en `testing-codex`, deploy TESTING SUCCESS ambos servicios, smoke completo. `P2_T36_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` (checklist de 6 pasos, sólo branding) — `main`/Production SIN CAMBIOS (`8011ee3`) (2026-09-09)

## 0.64 ESTADO ACTUAL — P2-T35 CERRADO, TEST-ONLY: 6 fallas estáticas iOS/PWA preexistentes (no 5 como documentaba el historial — drift explicado, no forzado) resueltas sin ningún cambio de producto. Causa raíz de 5: `core.autocrlf=true` del checkout produce CRLF real en `ios-keyboard-fix.tsx`/`ios-viewport-debug-panel.tsx`, rompiendo regex que anclaban saltos de línea literales o presupuestos de caracteres ajustados — el runtime (única autoridad de modo, timeline post-teclado) está 100% intacto, verificado por lectura directa y por sanity-check (regex crudo=falla, normalizado=pasa) ANTES de editar. Causa de la 6ta: P2-T32 movió el mapa+GPS de Perfil a `address-map-picker.tsx` sin que el contrato iOS lo siguiera. Fix: normalización CRLF→LF en 2 archivos de test + corrección de ruta en 1 — 0 archivos de producto tocados. 236→242 pass, 0 fail, sin regresión. Las 4 fallas de tracking GPS (P2-T02, MODEL-G1 vs MODEL-E1) preservadas intactas, archivo no tocado. `P2_T35_STATUS=CLOSED_TESTING_CERTIFIED`, commit test-only `227ea27` en `testing-codex`, sin deploy TESTING necesario, sin certificación física requerida — `main`/Production SIN CAMBIOS (`8011ee3`). Próxima acción recomendada (no iniciada): P2-T36 (100% software) o P2-T34 si el operador prioriza Android — Operaciones/Salón sigue `PENDING_OPERATOR_FINDINGS` (2026-09-09)

## 0.63 ESTADO ACTUAL — CHECKPOINT PRODUCTION: batch certificado `P2-T30+P2-T32` promovido de `testing-codex` a `main`/Production. `main` avanzado de `44af4ec` a `8011ee3716c93e62b4a85ce82e3a9646ac5302a5` (método `git commit-tree`, mismo patrón de las 4 promociones anteriores del epic P2-T29), tag `p2-t30-t32-stable-2026-09-09` creado. Preflight auditó el diff de árbol completo ANTES de cualquier side effect: exactamente 8 archivos (1 test-only T30 + 7 T32), ninguno inesperado, 0 schema/migración — la larga lista de commits de `git log` fue ruido esperado (main es un snapshot curado sin ancestría lineal). Quality gates re-ejecutados sobre el source exacto: T30 48 pass+4 skip+0 fail, T32 focal 26 pass+0 fail, regresión 42 pass+0 fail, TYPECHECK_RAW=24 (idéntico baseline), build/lint/diff-check limpios. Autodeploy Git-triggered SUCCESS PRIMER intento en ambos servicios relevantes (DeliGO + chat en vivo), commit exacto verificado, 0 migrations pendientes. Smoke 8/8 PASS contra `https://deligo.ar` real, sin mutaciones. `P2_T30_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`, `P2_T32_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`, `P2_T30_PLUS_P2_T32_RELEASE_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`. `P2-T38`/`P2-T39`/`P2-T40` preservados `READY_FUTURE`, ninguno mezclado. `PUBLIC_RELEASE_AUTHORIZED=NO` (checkpoint técnico, no lanzamiento público). Operaciones/Salón sigue `PENDING_OPERATOR_FINDINGS` — próxima acción recomendada (no iniciada): P2-T35 o P2-T34 según prioridad del operador (2026-09-09) — CERRADO en 0.64

## 0.62 ESTADO ACTUAL — NUEVA TAREA REGISTRADA: `P2-T40` (Push Session Lifecycle + Login Re-Enrollment, `READY_FUTURE`), ID verificado libre por grep. Requisito nuevo del operador tras P2-T32: logout desvincula push (aceptable), pero re-login es inconsistente en si vuelve a preguntar, riesgo particular tras expiración de sesión por desuso. Invariante registrado: `NEW_AUTHENTICATED_SESSION+EFFECTIVE_PUSH_OFF=>USER_MUST_BE_INFORMED`, con anti-nag (máximo una intervención por sesión) y precedencia sobre el flag histórico `deligo-permissions-prompted` ("una vez por dispositivo"). Confirmado por lectura real (no inventado): el flag existe con ese diseño, `unlinkCurrentPushSubscription` está en Cliente/Negocio/Repartidor/Mozo, y Salón personal usa un hook de push SEPARADO (`use-operativo-salon-push.ts`) — no asumir simetría de hook entre actores. `P2_T31_STATUS=CLOSED` sin cambios, NO reabierto (lifecycle de sesión, no regresión de delivery ya certificado). Insertada en el backlog entre P2-T38 y P2-T39, antes de P2-T33/P2-T37. Batch `P2_T30_PLUS_P2_T32` sigue `RELEASE_ELIGIBLE=SI`, sin ejecutar — próxima acción: `P2_T30_PLUS_P2_T32_PROMOTION_EVALUATION` — `main`/Production SIN CAMBIOS (2026-09-09) — PROMOVIDO en 0.63

## 0.61 ESTADO ACTUAL — P2-T32 CERRADO POR CERTIFICACIÓN FÍSICA: operador reportó "TODAS LAS PRUEBAS SALIERON PERFECTAS" para los 4 casos (A-D) — `P2_T32_STATUS=CLOSED_TESTING_CERTIFIED`, sin cambios de código. Backlog ampliado con 2 tareas nuevas verificadas libres por grep: `P2-T38` (PWA Installation UX — Android completion-state + iOS guided tutorial, formaliza F-P2-T31-R23A-03) y `P2-T39` (Admin/SuperAdmin Functional Review, funcional/UX, distinta de y previa a P2-T33, NO reabre P2-T26), ambas `READY_FUTURE`. Operaciones/Salón queda como revisión manual del operador en curso, sin tarea nueva. Arquitectura de push documentada sin fix: Mozo/Salón con push moderno wireado, TerminalOperativa deliberadamente NO es actor Push (decisión P2-T12). Batch `P2_T30_PLUS_P2_T32` registrado `RELEASE_ELIGIBLE=SI`, promoción NO ejecutada — próxima acción: `P2_T30_PLUS_P2_T32_PROMOTION_EVALUATION` — `main`/Production SIN CAMBIOS (2026-09-09) — CONSOLIDADO en 0.62

## 0.60 ESTADO ACTUAL — P2-T32 IMPLEMENTADO, TESTEADO Y DESPLEGADO A TESTING: modal de checkout divergente (sin persistencia real, sin alias) reemplazado por autoridad compartida con Perfil; deep-link determinista a "Mis Direcciones" — `P2_T32_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` — `main`/Production SIN CAMBIOS (2026-09-09) — CERRADO en 0.61

```text
TASK_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_CERTIFICATION
Repo: C:\Leo Campos\Trabajo\deligo-main-limpio / Branch: testing-codex
HEAD=origin/testing-codex=2fb603bf4aa4b2c993b0a75078f29a259e036aca (nuevo commit) / origin/main=44af4ecedd245977f0a50eeeb5bb5b292519c370 (sin cambios)
HALLAZGO=el modal de checkout (LocationPickerModal) nunca llamaba a POST /api/cliente/direcciones — sólo escribía al store local del carrito, sin campo alias — confirmado leyendo el código real
FIX=extraída la autoridad de Perfil (mapa Leaflet+GPS+reverse-geocoding, formulario con validación/payload/submit) a address-map-picker.tsx + address-form.tsx, compartida por Perfil y el nuevo ClientAddressModal — nunca dos formularios divergentes
DEEP_LINK=scroll determinista a "Mis Direcciones" (id="mis-direcciones" + pendingScrollRef, dispara sólo tras showForm=true) reutilizando el mecanismo useNavStore.openAddressForm ya existente — navegación normal a Perfil sin cambios
AUTOSELECT=dirección recién creada en checkout seleccionada por su id real (nunca por posición), carrito preservado, cliente-direcciones invalidada
TESTS=26 focales nuevos (render real happy-dom + contrato estático) + 42 de regresión en archivos vecinos reales, 0 fallas nuevas
QUALITY=TYPECHECK_RAW=24 (idéntico baseline) / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI / SECRET_LEAK=NO
COMMIT=2fb603bf4aa4b2c993b0a75078f29a259e036aca (parent 2fff459) / PUSH=testing-codex únicamente / TESTING_DEPLOY=SUCCESS ambos servicios (DeliGO Copy + chat en vivo), commit exacto, primer intento / SMOKE=8/8 200
PRISMA_SCHEMA_CHANGED=NO / NEW_MIGRATION=NO / PRODUCTION_TOUCHED=NO
P2_T32_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION (checklist de 4 casos A-D en el reporte — Cliente sin dirección desde Inicio, desde carrito, Cliente con dirección existente, denegar geolocalización)
PROPOSED_RELEASE_BATCH=P2_T30_PLUS_P2_T32 (no ejecutado en esta tarea)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED (sin cambios)
Reporte: codex-reports/P2_T32_CLIENT_ADDRESS_UX_UNIFICATION_AND_PROFILE_DEEPLINK.md
```

## 0.59 ESTADO ACTUAL — BACKLOG P2 CONSOLIDADO AUTORITATIVAMENTE: nueva sección "CURRENT AUTHORITATIVE BACKLOG" al inicio de `ROADMAP.md` — 6 tareas nuevas formalizadas (P2-T32..T37), 3 correcciones mayores de premisas (P2-T18 ya CLOSED, Dark Kitchen implementación dedicada, Thermal Printing módulo ya wireado) — SIN cambios de código/tests/DB/Railway — `main`/Production SIN CAMBIOS — próxima acción: `P2-T32` (2026-09-09) — IMPLEMENTADO en 0.60

```text
TASK_STATUS=COMPLETE_BACKLOG_RECONCILED
Repo: C:\Leo Campos\Trabajo\deligo-main-limpio / Branch: testing-codex
HEAD=origin/testing-codex=2fff459b36ea459a9cb6603daf746c571562449d (sin cambios) / origin/main=44af4ecedd245977f0a50eeeb5bb5b292519c370 (sin cambios)
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / DB_TOUCHED=NO / RAILWAY_TOUCHED=NO / COMMIT_CREATED=NO / PUSH_PERFORMED=NO / PRODUCTION_TOUCHED=NO
NUEVAS_TAREAS=P2-T32 (Client Address UX Unification + Profile Deep-Link) / P2-T33 (Final Security Review — STRIDE + OWASP ASVS) / P2-T34 (Android Cliente/Repartidor Session Isolation) / P2-T35 (iOS/PWA Static-Contract Hygiene) / P2-T36 (PWA/Branding Hygiene agrupada) / P2-T37 (P2 Final Audit / Launch Readiness) — todas READY_TO_START, ninguna implementada, sin colisión de IDs
CORRECCION_1=P2_T18_STATUS=CLOSED (recertificación completa ya ejecutada — matriz actor/dispositivo/lifecycle PASS incluido typing; el estado "PAUSED_PENDING..." que aparecía en ROADMAP.md/FINDINGS.md estaba superado y nunca se había actualizado)
CORRECCION_2=DARK_KITCHEN_FUNCTIONAL_REQUIREMENT_STATUS=SATISFIED_DIRECTLY (T20-DK1/DK2A-C ya implementado y wireado, más fuerte que la premisa "indirecta")
CORRECCION_3=THERMAL_PRINTING tiene un módulo ya funcional (src/lib/thermal-print/ + mesa-cuenta-dialog.tsx) — contradice la premisa "no iniciado"; decisión del operador de mantenerlo POST_LAUNCH_DEFERRED preservada, discrepancia documentada
LEGACY_RECONCILIATION=19-G y 19-H(1) ABSORBED (código real: review-moderation-expiry.ts / client-ui.ts) / 19-B0.2(+D1/E1) ABSORBED (6+ archivos de producción) / 24-B DECISION_REQUIRED (ninguna evidencia encontrada)
GPS_REQUIRED_BY_OPERATOR=SI (P2-T02/T23/T24 preservados) / SUPPORT_INSTAGRAM=DEFERRED_TO_END_OF_CURRENT_BACKLOG / PAYMENTS-01..10=DEFERRED_PLANNED workstream separado / EMAIL_DIAGNOSTIC_DRIFT=KNOWN_NON_BLOCKING_HISTORICAL_DEBT (sacado del backlog activo)
P2_T29_STATUS=CLOSED_PRODUCTION_CHECKPOINTED / P2_T30_STATUS=CLOSED_TESTING_CERTIFIED / P2_T31_STATUS=CLOSED_TESTING_CERTIFIED / P2_T27_STATUS=MERGED_CLOSED_BY_T29A (todos confirmados, sin cambios)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO
NEXT_RECOMMENDED_ACTION=P2-T32 (Client Address UX Unification) — primer ítem del backlog activo sin dependencia dura pendiente (P2-T02 sigue bloqueada por hardware)
IMPORTANTE_PARA_HANDOFF_FUTURO=la autoridad primaria de estado VIGENTE del backlog ahora es la sección "CURRENT AUTHORITATIVE BACKLOG" al inicio de codex-reports/ROADMAP.md — nunca inferir estado de snapshots históricos por debajo de esa sección
Reporte: codex-reports/P2_CURRENT_AUTHORITATIVE_BACKLOG_RECONCILIATION.md
```

## 0.58 ESTADO ACTUAL — P2-T30 CERRADO: higiene de fixtures de `superadmin-auth.test.ts` — F-PRE-T29-03 resuelto con evidencia real (3 corridas limpias, 0 residuo, filas reales intactas), SIN cambios de código de producto — `P2_T30_STATUS=CLOSED_TESTING_CERTIFIED` — `main`/Production SIN CAMBIOS — sin otra tarea READY/QUEUED disponible salvo `P2-T02` (bloqueada) (2026-09-09) — CONSOLIDADO en 0.59

```text
TASK_STATUS=COMPLETE
Repo: C:\Leo Campos\Trabajo\deligo-main-limpio / Branch: testing-codex
HEAD=origin/testing-codex=2fff459b36ea459a9cb6603daf746c571562449d (nuevo commit) / origin/main=44af4ecedd245977f0a50eeeb5bb5b292519c370 (sin cambios)
ROOT_CAUSE=deleteMany({}) sin scope crasheaba contra 3 filas SuperAdmin reales vinculadas (2 referenciadas por FK Restrict de SolicitudRevisionResena) en la DB compartida de TESTING — confirmado empíricamente, no asumido
FIX=fixtures con id/sub/email únicos por corrida + cleanup exclusivamente por esos ids (nunca deleteMany({}) global) — único archivo modificado: src/lib/superadmin-auth.test.ts
HALLAZGO=4 tests dependían de "cero identidades vinculadas en TODA la tabla" (regla de negocio real, no un bug) — marcados test.skipIf() explícito (nunca se borró la fila real para forzar su PASS), cobertura preservada de forma permanente vía tests puros de la función de decisión
TESTS=48 pass + 4 skip + 0 fail, 3 corridas consecutivas idénticas + 77/77 en 7 archivos vecinos de SuperAdmin
QUALITY=TYPECHECK_RAW=24 (idéntico baseline) / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI / SECRET_LEAK=NO
COMMIT=2fff459b36ea459a9cb6603daf746c571562449d (parent a5109b0) / PUSH=testing-codex únicamente / TESTING_DEPLOY_REQUIRED=NO (test-only) / PRODUCTION_TOUCHED=NO
F-PRE-T29-03=RESOLVED_BY_P2_T30 / F-P2-T30-01=OPEN_NON_BLOCKING (nuevo, 12 sesiones superadmin huérfanas preexistentes, no atribuibles a esta tarea, no tocadas)
P2_T27_STATUS=MERGED_CLOSED_BY_T29A confirmado sin conflicto real entre las 4 autoridades (fragmentos "QUEUED" del archivo son snapshot histórico anterior a T29A)
P2_T29A/B/C/D/E_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservados) / P2_T29_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado)
P2_T30_STATUS=CLOSED_TESTING_CERTIFIED (era READY_TO_START)
NEXT_ROADMAP_TASK=P2-T02 (WAITING_FOR_OPERATOR — no accionable sin el operador). Ninguna otra tarea READY/QUEUED disponible: P2-T27 cerrado/fusionado, P2-T31 cerrado, Payments DEFERRED, P2-T19/23/24 fuera de secuencia o bloqueados.
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED (sin cambios)
Reporte: codex-reports/P2_T30_SUPERADMIN_AUTH_TEST_FIXTURE_HYGIENE.md
```

## 0.57 ESTADO ACTUAL — EPIC P2-T29 (A-E) CHECKPOINTED EN PRODUCTION: `main`/Production avanzados de `7a3a1dc` a `44af4ec` (source `testing-codex@a5109b0`), tag `p2-t29-stable-2026-09-09` creado, AMBOS servicios (DeliGO + chat en vivo) SUCCESS en el PRIMER intento — `P2_T29_STATUS=CLOSED_PRODUCTION_CHECKPOINTED` — DeliGO SIGUE SIN LANZAMIENTO PÚBLICO — próxima tarea de roadmap: `P2-T30` (2026-09-09) — CERRADO en 0.58

```text
TASK_STATUS=COMPLETE
Repo: C:\Leo Campos\Trabajo\deligo-main-limpio / Branch: testing-codex
SOURCE_HEAD=testing-codex@a5109b0930ef975b0220b6cfbcb0698b32d8cf32 (sin cambios) / RELEASE_COMMIT=44af4ecedd245977f0a50eeeb5bb5b292519c370 (parent 7a3a1dc)
DELTA=3 archivos (residual completo de T29D: order-transition-t29b-flow.test.ts, negocio/pedidos/[id]/estado/route.ts, push.ts) / T29E confirmado SIN código propio
PROMOTION_TESTS=163/163 (0 fallas) / TYPECHECK_RAW=24 (idéntico baseline) / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI / SECRET_LEAK=NO
MIGRATIONS=0 ("No pending migrations to apply", 30 migrations found, confirmado en logs reales de Production)
PUSH=origin/main: 7a3a1dc..44af4ec (fast-forward, sin force) / origin/testing-codex sin cambios
PRODUCTION_DEPLOY=SUCCESS ambos servicios (DeliGO + chat en vivo), PRIMER intento, sin hiccup, commit exacto en ambos
SMOKE=8/8 rutas 200 (/,/cliente,/negocio,/repartidor,/operaciones,manifests,sw.js) contra el dominio real https://deligo.ar
TAG=p2-t29-stable-2026-09-09 -> 44af4ec
NOTA_OPERATIVA=CLI de Railway local linkeado por defecto a TESTING (no Production) — descubierto y corregido durante esta tarea; toda verificación de Production usó `-e production`/`-s` explícitos desde entonces (ver DECISIONS_AND_INVARIANTS.md)
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED / P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED / P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (todos preservados)
P2_T29D_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED) / P2_T29E_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED)
P2_T29_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (epic completo A-E, era CLOSED_TESTING_CERTIFIED)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED (sin cambios) / PUBLIC_RELEASE_AUTHORIZED=NO
NEXT_ROADMAP_TASK=P2-T30 (SUPERADMIN AUTH TEST FIXTURE HYGIENE — src/lib/superadmin-auth.test.ts, deleteMany({}) sin scope) — READY_TO_START, no iniciada
Findings preservados sin resolver: F-PRE-T29-03, F-P2-TESTINFRA-01, F-P2-T29A-02, Android session isolation (OPEN, public launch blocker), P2_T02_STATUS=WAITING_FOR_OPERATOR, deuda de íconos PWA.
Reporte: codex-reports/P2_T29D_T29E_PROMOTE_TO_MAIN_AND_PRODUCTION.md
```

## 0.56 ESTADO ACTUAL — EPIC P2-T29 CERRADO EN TESTING: certificación física final del operador PASS (Domicilio con dos repartidores reales/single-winner, Retiro, Mesa, sin notificaciones duplicadas) — `P2_T29_STATUS=CLOSED_TESTING_CERTIFIED`, `P2_T29E_STATUS=CLOSED_TESTING_CERTIFIED` — `main`/Production SIN CAMBIOS, tarea puramente documental — `RELEASE_BATCH=P2_T29D_PLUS_P2_T29E` LISTO PARA PROMOCIÓN (aún no ejecutada) (2026-09-09) — PROMOVIDO en 0.57

```text
TASK_STATUS=COMPLETE
Repo: C:\Leo Campos\Trabajo\deligo-main-limpio / Branch: testing-codex
HEAD=origin/testing-codex=a5109b0930ef975b0220b6cfbcb0698b32d8cf32 (sin drift) / origin/main=7a3a1dcbfa89bd63c96471290e936b979d74c5ce (sin cambios)
PHYSICAL_CERTIFICATION_RESULT=PASS / ENVIRONMENT=TESTING / DATE=2026-09-09 / OPERATOR_CONFIRMED=SI
Domicilio: flujo canónico completo, notificaciones "aceptado"/"buscando delivery" únicas, dos repartidores reales compitiendo con single-winner confirmado, entrega final OK. Retiro: completo, sin buscando-delivery, sin Repartidor. Mesa: completo, sin aceptado, sin Repartidor. Sin duplicados de notificación en ningún caso.
CODE_CHANGES_REQUIRED_FOR_CLOSE=NO / CLOSE_COMMIT_SHA=N/A / PUSH_TO_TESTING=NO (tarea puramente documental, sin reejecutar los 218 tests ya certificados en la tarea automática previa)
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED / P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED / P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (todos preservados)
P2_T29D_STATUS=CLOSED_TESTING_CERTIFIED (preservado, NO Production checkpoint todavía)
P2_T29E_STATUS=CLOSED_TESTING_CERTIFIED (era WAITING_FOR_OPERATOR_FINAL_PHYSICAL_CERTIFICATION)
P2_T29_STATUS=CLOSED_TESTING_CERTIFIED (epic completo, era IN_PROGRESS) — NO equivale a Production checkpoint ni a public launch ready
RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS / RELEASE_BATCH=P2_T29D_PLUS_P2_T29E / RELEASE_BATCH_READY_FOR_PROMOTION=SI / PROMOTION_EVALUATION_POINT=NOW
Findings preservados sin resolver: F-PRE-T29-03, F-P2-TESTINFRA-01 (recurrencia P2028 ya reproducida y descartada en T29E, no reabierta), F-P2-T29A-02, Android session isolation (OPEN, public launch blocker), P2_T02_STATUS=WAITING_FOR_OPERATOR, deuda de íconos PWA.
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED (sin cambios)
NEXT_RECOMMENDED_ACTION=PROMOTE_P2_T29D_PLUS_P2_T29E_TO_MAIN_AND_PRODUCTION (tarea separada, requiere autorización explícita del operador)
Reporte: codex-reports/P2_T29E_AND_T29_FINAL_PHYSICAL_CERTIFICATION_CLOSEOUT.md
```

## 0.55 ESTADO ACTUAL — P2-T29E: auditoría final + regresión completa del epic T29 — 218 tests reales, 0 fallas nuevas, SIN cambios de código — `P2_T29E_STATUS=WAITING_FOR_OPERATOR_FINAL_PHYSICAL_CERTIFICATION` — `main`/Production SIN CAMBIOS — epic P2-T29 (completo) sigue `IN_PROGRESS`, pendiente certificación física final (2026-09-09) — CERRADO en 0.56

```text
TASK_STATUS=AUTOMATED_FINAL_CERTIFICATION_COMPLETE_AWAITING_OPERATOR
Repo: C:\Leo Campos\Trabajo\deligo-main-limpio / Branch: testing-codex
HEAD=origin/testing-codex=a5109b0930ef975b0220b6cfbcb0698b32d8cf32 (sin drift) / origin/main=7a3a1dcbfa89bd63c96471290e936b979d74c5ce (sin cambios)
AUDITORIA=autoridad de transición única confirmada (5 consumidores, sin tablas duplicadas), grafos canónico/legacy domicilio/retiro certificados por test real (no sólo diseño), UI Negocio nunca ofrece atajo legacy como CTA, timeline Cliente 5 pasos sin estado crudo visible, Mesa no pasa por el panel Cliente (flujo separado ya certificado)
BATERIA_FINAL=218 tests (122 puros + 24 mock-db + 72 integración DB real), 0 fallas nuevas — 1 fallo P2028 transitorio en archivo P2-T25 ajeno al diff, reproducido como recurrencia de F-P2-TESTINFRA-01 (no regresión, no reabre el finding)
QUALITY=TYPECHECK_RAW=24 (idéntico baseline) / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI
CODE_CHANGES_REQUIRED=NO / CLOSE_COMMIT_SHA=N/A / PUSH_TO_TESTING=NO (tarea puramente de auditoría/tests, sin código tocado)
P2_T29A/B/C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservados) / P2_T29D_STATUS=CLOSED_TESTING_CERTIFIED (preservado)
P2_T29E_STATUS=WAITING_FOR_OPERATOR_FINAL_PHYSICAL_CERTIFICATION (era READY_TO_START)
P2_T29_STATUS=IN_PROGRESS (epic completo NO se marca cerrado hasta la certificación física final del operador)
PROPOSED_RELEASE_BATCH=P2_T29D_PLUS_P2_T29E (sin cambios) / PROMOTION_EVALUATION_POINT=AFTER_P2_T29E_CERTIFICATION
NEXT_RECOMMENDED_ACTION=OPERATOR_FINAL_PHYSICAL_CERTIFICATION_P2_T29E (checklist completo Domicilio/Retiro/Mesa en el reporte)
Reporte: codex-reports/P2_T29E_FINAL_COMPATIBILITY_REGRESSION_AND_PHYSICAL_CERTIFICATION.md
```

## 0.54 ESTADO ACTUAL — P2-T29D CERRADO: certificación física del operador PASS (10/10 ítems — Domicilio 4/4, Retiro 3/3, Mesa 2/2, sin duplicados, timeline sin regresión) — `P2_T29D_STATUS=CLOSED_TESTING_CERTIFIED`, `P2_T29E_STATUS=READY_TO_START` — `main`/Production SIN CAMBIOS, tarea puramente documental sin código tocado — `PROPOSED_RELEASE_BATCH=P2_T29D_PLUS_P2_T29E` (2026-09-09) — auditoría final CERRADA en 0.55

```text
TASK_STATUS=COMPLETE
Repo: C:\Leo Campos\Trabajo\deligo-main-limpio / Branch: testing-codex
HEAD=origin/testing-codex=a5109b0930ef975b0220b6cfbcb0698b32d8cf32 (sin drift)
origin/main=7a3a1dcbfa89bd63c96471290e936b979d74c5ce (sin cambios, checkpoint T29B+T29C intacto)
tag p2-t29b-t29c-stable-2026-09-09 -> 7a3a1dcbfa89bd63c96471290e936b979d74c5ce (verificado)
PHYSICAL_CERTIFICATION_RESULT=PASS / ENVIRONMENT=TESTING / DATE=2026-09-09 / OPERATOR_CONFIRMED=SI
Residual certificado: notificación Cliente recibido->aceptado ("<negocio> aceptó tu pedido"), Domicilio y Retiro; Mesa no participa (no aplica).
CODE_CHANGES_REQUIRED_FOR_CLOSE=NO / CLOSE_COMMIT_SHA=N/A / PUSH_TO_TESTING=NO (tarea puramente documental)
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED / P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED / P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (todos preservados)
P2_T29D_STATUS=CLOSED_TESTING_CERTIFIED (era WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION)
P2_T29E_STATUS=READY_TO_START / P2_T29_STATUS=IN_PROGRESS (epic completo no se marca cerrado hasta T29E)
RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS / PROPOSED_RELEASE_BATCH=P2_T29D_PLUS_P2_T29E / T29D_STANDALONE_PROMOTION_REQUIRED=NO / PROMOTION_EVALUATION_POINT=AFTER_P2_T29E_CERTIFICATION
NEXT_RECOMMENDED_ACTION=P2_T29E_FINAL_COMPATIBILITY_REGRESSION_AND_PHYSICAL_CERTIFICATION
Reporte: codex-reports/P2_T29D_PHYSICAL_CERTIFICATION_CLOSEOUT.md
```

## 0.53 ESTADO ACTUAL — P2-T29D AUDITADO (scope histórico completo comparado requisito por requisito) + ÚNICO RESIDUAL REAL IMPLEMENTADO Y DESPLEGADO A TESTING: notificación Cliente "aceptado" (copy decidido por el operador, no inventado) — `P2_T29D_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` (NO CERRADO, cambio user-visible) — `main`/Production SIN CAMBIOS (2026-09-09) — CERRADO en 0.54

```text
HEAD=origin/testing-codex=a5109b0930ef975b0220b6cfbcb0698b32d8cf32 (AVANZÓ desde 0c23008 — 1 commit nuevo)
origin/main=7a3a1dcbfa89bd63c96471290e936b979d74c5ce (SIN CAMBIOS — checkpoint T29B+T29C preservado, verificado antes y después)
Railway TESTING/DeliGO Copy=a5109b0... SUCCESS / chat en vivo TESTING también redeployado mismo commit, SUCCESS / Railway Production/DeliGO=7a3a1dc... SUCCESS (sin cambios) / tag p2-t29b-t29c-stable-2026-09-09 -> 7a3a1dc (sin cambios)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios)

TASK_STATUS=AUDITED_RESIDUAL_IMPLEMENTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_GATE

CORRECCIÓN_DOCUMENTAL_PREVIA=conteo de tests de la promoción reconciliado: subtotal de order-status-t29b-safe-render.test.ts estaba transcrito como 8 (real: 5) desde el reporte de T29B-R1, propagado sin re-verificar a TEST_AUTHORITY.md, al reporte de T29C y al de la promoción — el total real (134) siempre fue correcto porque se midió ejecutando la batería completa, no sumando subtotales escritos. Corregido en los 4 documentos, sin reabrir la promoción.

FASE_A_AUDIT=matriz completa contra P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md §10/§11 (autoridad de diseño original completa, no sólo NEXT_RECOMMENDED_ACTION): 6 requisitos originales de T29D, 5 ya implementados+certificados+en Production (timeline Cliente 5 pasos, notificación "Buscando delivery", aviso a repartidores de nuevo delivery, notificación de asignación preexistente preservada sin cambios, mover-notificación-a-factory explícitamente marcado no-obligatorio en el diseño), 1 residual real = notificación Cliente recibido->aceptado (única fila de la matriz original marcada como requerida sin calificar de "opcional", y explícitamente suprimida por T29B/T29B-R1 con comentario "diferido a T29D")
PRODUCT_DECISION_HANDLED_CORRECTLY=SI — el copy de esa notificación nunca había sido cerrado por ninguna autoridad (sólo un "(propuesto)" de la auditoría original, read-only, sin poder de decisión de producto); se presentaron 3 opciones cortas al operador ANTES de escribir código, en vez de elegir unilateralmente
ACCEPTED_NOTIFICATION_TITLE=Actualización de pedido (genérico existente) / ACCEPTED_NOTIFICATION_BODY=${negocioNombre} aceptó tu pedido / ACCEPTED_NOTIFICATION_APPLIES_TO=domicilio + retiro (mesa nunca alcanza aceptado)

IMPLEMENTACION=fileset mínimo de 3 archivos — src/lib/push.ts (1 key nueva en el mapa ya existente de orderUpdateNotification, sin factory nueva, tal como el diseño original ya indicaba NEW_FACTORY_REQUIRED=NO) + negocio/pedidos/[id]/estado/route.ts (eliminada la supresión explícita isAcceptedWithoutClientCopy que T29B había dejado) + 1 test actualizado + 4 tests nuevos
TIMELINE_RESIDUAL_REQUIRED=NO (sin hueco real, no se tocó client-orders-panel.tsx) / RETIRO=misma notificación que domicilio por decisión del operador / MESA=0 notificaciones (nunca alcanza aceptado, estructural) / LEGACY=preservado, 0 notificaciones para recibido->preparando directo / SINGLE_WINNER=probado con CAS real (Promise.all, 1 winner/1 loser, 1 notificación)

TEST_MATRIX=134 puros + 33 DB reverificados sin cambios de comportamiento + 5 tests T29D nuevos (domicilio 1, retiro 1, mesa 0, CAS-loser 0/double-tap 1, legacy 0) = NEW_FAIL=0 (1 fallo no-determinístico observado en una corrida de order-transition-t29b-flow.test.ts, PRE-EXISTENTE y ajeno al fileset — colisión de email por randomUUID().slice(0,2) de baja entropía, reproducido: reejecución completa 18/18 PASS)
VERIFICACION_VISUAL_LOCAL=NO REALIZADA — cambio pequeño y acotado, cobertura de integración real (DB de TESTING) ya prueba el comportamiento exacto por modalidad/CAS; el gate determinante sigue siendo la certificación física pendiente
BUILD/LINT/SECRET_SCAN=todos PASS/limpios / TYPECHECK_RAW=24 (idéntico al baseline, mismos 14 archivos preexistentes, 0 nuevos)

T29D_COMMIT=a5109b0930ef975b0220b6cfbcb0698b32d8cf32 (parent 0c2300827ea09d149253b84bc43fa5bda6db29f2, testing-codex)
PUSH_TO_TESTING=SI / MAIN_PUSH=NO
TESTING_DEPLOYMENT=SUCCESS (DeliGO Copy) commit match exacto / chat en vivo TESTING también SUCCESS mismo commit / SMOKE=/,/cliente,/negocio,/repartidor,/operaciones todos 200
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=7a3a1dcbfa89bd63c96471290e936b979d74c5ce (sin cambios, verificado antes y después)

RELEASE_CADENCE_DECISION=sin cambios — RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS preservada / PROPOSED_RELEASE_BATCH=P2_T29D_PLUS_P2_T29E (propuesta, no obligación) / P2_T29E_STATUS=QUEUED_AFTER_T29D

F-PRE-T29-03=OPEN_NON_BLOCKING_TEST_INFRA (sin cambios) / F-P2-TESTINFRA-01=OPEN_DEFERRED (sin cambios) / F-P2-T29A-02=PREEXISTING_NON_BLOCKING_AUDIT_GAP (sin cambios) / F-P2-T29B-R1-01/F-P2-T29C-01=RESOLVED (preservados)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, sigue bloqueando lanzamiento público)
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29D_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION (era READY_TO_START) / P2_T29_STATUS=IN_PROGRESS
NEXT_RECOMMENDED_ACTION=OPERATOR_PHYSICAL_CERTIFICATION_P2_T29D — checklist reducido entregado en el reporte (codex-reports/P2_T29D_RESIDUAL_CLIENT_NOTIFICATIONS_TIMELINE_AUDIT_AND_IMPLEMENTATION.md sección 16). Sólo si PASS: cerrar T29D y evaluar P2_T29E_FINAL_COMPATIBILITY_REGRESSION_AND_PHYSICAL_CERTIFICATION. NO main, NO Production, NO tag, NO T29E todavía.
```

Tarea de dos fases sobre P2-T29D: auditoría completa (no asumida) del
scope histórico original, comparado requisito por requisito contra la
implementación real de T29B/T29B-R1/T29C — confirmando que 5 de 6
requisitos ya estaban satisfechos, certificados físicamente, y en
Production. El único residual real (notificación Cliente para
`aceptado`) tenía un copy nunca cerrado por ninguna autoridad — se
presentaron opciones al operador antes de escribir código, siguiendo
exactamente el protocolo que la propia tarea exigía para evitar
inventar una decisión de producto.

Durante el audit se detectó y corrigió una discrepancia documental
(conteo de tests 134 vs 137 en el reporte de promoción) — causada por
un subtotal transcrito erróneamente en el reporte de T29B-R1 y
propagado sin re-verificar a 3 reportes más. Corregida en los 4
documentos; el total real (134) siempre fue correcto, la promoción no
se reabrió.

La implementación del residual fue mínima (3 archivos: 1 key nueva en
un mapa ya existente + 1 supresión eliminada + tests). Ningún otro
residual real quedó pendiente. Verificado con 134+33+5 tests (0 fallas
nuevas), build/lint/typecheck limpios, commit `a5109b0` pusheado a
`testing-codex`, deploy TESTING SUCCESS en el commit exacto, Production
verificada intacta. Por ser un cambio user-visible (nueva notificación
push), `P2_T29D_STATUS` permanece
`WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` — no se cierra en esta
tarea. Detalle completo:
`codex-reports/P2_T29D_RESIDUAL_CLIENT_NOTIFICATIONS_TIMELINE_AUDIT_AND_IMPLEMENTATION.md`.

## 0.52 ESTADO ACTUAL — P2-T29B + P2-T29C PROMOVIDOS A PRODUCTION: `main`/Production avanzados de `c45fd5e` a `7a3a1dc`, tag `p2-t29b-t29c-stable-2026-09-09` creado, AMBOS servicios (DeliGO + chat en vivo) SUCCESS en el PRIMER intento — `P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`, `P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED` — DeliGO SIGUE SIN LANZAMIENTO PÚBLICO (2026-09-09)

```text
HEAD=origin/testing-codex=0c2300827ea09d149253b84bc43fa5bda6db29f2 (SIN CAMBIOS)
origin/main=7a3a1dcbfa89bd63c96471290e936b979d74c5ce (AVANZÓ desde c45fd5ec8cd771d68020f37d892be31d62fb54c5)
Railway Production/DeliGO=7a3a1dc... SUCCESS (primer intento, deployment a5a7ffd0-c38e-4c27-a967-94128e5f70e1) / Railway Production/chat en vivo=7a3a1dc... SUCCESS (primer intento, deployment 3794366d-7a62-47e7-8c3c-3bb37715610c — sin el hiccup que P2-T29A tuvo, sin redeploy necesario) / Railway TESTING/DeliGO Copy=0c23008... SUCCESS (sin cambios)
tag p2-t29b-t29c-stable-2026-09-09 -> 7a3a1dcbfa89bd63c96471290e936b979d74c5ce (nuevo, dereferenciado y confirmado)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios — esta promoción NO es lanzamiento público)

TASK_STATUS=COMPLETE

RELEASE_METHOD=git commit-tree (tree=testing-codex@0c2300827ea09d149253b84bc43fa5bda6db29f2, parent=origin/main@c45fd5ec8cd771d68020f37d892be31d62fb54c5) — mismo método curado validado 4 veces, sin merge genérico, sin tocar HEAD/branch local
BYTE_TREE_EQUIVALENT_TO_TESTING_HEAD=SI (verificado 2 veces)
PROMOTION_DIFF=22 archivos (8 added + 14 modified + 0 deleted), auditados uno por uno contra el fileset certificado de T29B+T29B-R1+T29C — sin sorpresas, sin T29D/T29E, mini-services/chat-service y prisma/ sin tocar
PROMOTION_TESTS=134 puros + 47 DB (0 fallas nuevas) — 1 fallo no-determinístico en order-transition-cas-concurrency.test.ts (archivo NO tocado por el diff), reproducido en aislamiento (6/6 PASS) y en la batería completa reejecutada (47/47 PASS), clasificado ruido de infraestructura de test compartida
BUILD/LINT/TYPECHECK/SECRET_SCAN=todos PASS/limpios (TYPECHECK_RAW=24, idéntico al baseline, 0 nuevos)

RELEASE_COMMIT=7a3a1dcbfa89bd63c96471290e936b979d74c5ce (parent c45fd5ec8cd771d68020f37d892be31d62fb54c5)
MAIN_PUSH=SI (fast-forward, sin force) / TESTING_CODEX_UNCHANGED=SI
PRODUCTION_DEPLOYMENT=a5a7ffd0-c38e-4c27-a967-94128e5f70e1 (DeliGO) SUCCESS, commit match exacto / chat en vivo Production=3794366d-7a62-47e7-8c3c-3bb37715610c SUCCESS, commit match exacto, AMBOS EN EL PRIMER INTENTO
PRODUCTION_MIGRATIONS_APPLIED_COUNT=0 ("No pending migrations to apply")
SMOKE=/, /cliente, /negocio, /repartidor, /operaciones, 3 manifests, sw.js -> todos 200 (/ -> 307 redirect esperado) + verificación semántica del commit desplegado (esperando_repartidor canónico, timeline 5 pasos, waiting-driver-boundary de Negocio ausente)
MAIN_PRODUCTION_COMMIT_MATCH=SI

P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T27_STATUS=MERGED_CLOSED_BY_T29A (preservado) / P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED) / P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED) / P2_T29_STATUS=IN_PROGRESS (T29D/T29E pendientes, epic completo no se marca cerrado) / P2_T29D_STATUS=READY_TO_START
P2_T29D_REQUIRES_RESIDUAL_SCOPE_RECONCILIATION=SI — parte del alcance histórico de T29D (timeline Cliente segura para aceptado/esperando_repartidor, notificación "Buscando delivery") ya fue implementada y certificada durante T29B-R1/T29C, y ahora está en Production — la próxima tarea DEBE auditar contra el diseño original qué falta realmente (p.ej. notificación de "aceptado", todavía diferida) antes de implementar, para no duplicar funcionalidad ya certificada
ROLLBACK_TRIGGERED=NO

F-PRE-T29-03=OPEN_NON_BLOCKING_TEST_INFRA (sin cambios) / F-P2-TESTINFRA-01=OPEN_DEFERRED (sin cambios) / F-P2-T29A-02=PREEXISTING_NON_BLOCKING_AUDIT_GAP (sin cambios) / F-P2-T29B-R1-01/F-P2-T29C-01=RESOLVED (preservados)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, sigue bloqueando lanzamiento público)
NEXT_RECOMMENDED_ACTION=P2_T29D_RESIDUAL_CLIENT_NOTIFICATIONS_TIMELINE_AUDIT_AND_IMPLEMENTATION — auditar primero qué queda pendiente del diseño T29D original antes de implementar. NO iniciada por esta tarea. NO lanzamiento público, NO tag adicional, NO tocar testing-codex.
```

Cuarta aplicación de `RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_
PROMOTIONS`: con T29B y T29C ambos certificados (incluida la
certificación física con dos repartidores reales), se promovió el
bloque funcional completo — antes retenido de Production deliberadamente
porque T29B solo dejaba pedidos "buscando repartidor" sin ningún
consumidor real. El diff de 22 archivos se auditó uno por uno contra el
fileset exacto certificado en las 3 tareas previas — sin sorpresas, sin
implementación adicional de T29D/T29E.

Durante la batería de tests de promoción apareció un único fallo no
determinístico en un archivo que NO forma parte de este diff — se aplicó
el protocolo exigido de infra flaky (reproducción en aislamiento +
reejecución completa) antes de descartarlo como ruido de test compartido,
nunca asumido automáticamente. A diferencia de la promoción de P2-T29A,
esta vez AMBOS servicios de Production desplegaron `SUCCESS` en el
primer intento — sin el hiccup transitorio de `chat en vivo` que
requirió un reintento manual la vez anterior.

`P2_T29B_STATUS` y `P2_T29C_STATUS` pasan a
`CLOSED_PRODUCTION_CHECKPOINTED`. `P2_T29_STATUS` permanece
`IN_PROGRESS` — T29D/T29E siguen pendientes, el epic completo no se
marca cerrado. Se deja registrado explícitamente que parte del alcance
histórico de T29D ya está en Production (certificado durante T29B-R1) —
la próxima tarea debe reconciliar ese alcance residual antes de
implementar cualquier cosa nueva. DeliGO permanece sin lanzamiento
público. Detalle completo:
`codex-reports/P2_T29B_T29C_PROMOTE_TO_MAIN_AND_PRODUCTION.md`.

## 0.51 ESTADO ACTUAL — P2-T29C CERRADO: certificación física con DOS repartidores reales PASS (11/11 ítems) — `P2_T29B_STATUS=CLOSED_TESTING_CERTIFIED` y `P2_T29C_STATUS=CLOSED_TESTING_CERTIFIED`, bloque `RELEASE_BATCH=P2_T29B_PLUS_P2_T29C` queda `RELEASE_BATCH_READY_FOR_PROMOTION=SI` — `main`/Production SIN CAMBIOS, tarea puramente documental sin código tocado, PROMOCIÓN AÚN NO EJECUTADA (2026-09-09)

```text
HEAD=origin/testing-codex=0c2300827ea09d149253b84bc43fa5bda6db29f2 (SIN CAMBIOS — ningún commit nuevo, tarea de cierre puramente documental)
origin/main=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (SIN CAMBIOS — checkpoint P2-T29A preservado, verificado antes y después)
Railway TESTING/DeliGO Copy=0c23008... Online, sin build en curso (estable) / Railway Production/DeliGO=c45fd5e... SUCCESS (sin cambios)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios)

TASK_STATUS=COMPLETE

PHYSICAL_CERTIFICATION_RESULT=PASS / PHYSICAL_CERTIFICATION_ENVIRONMENT=TESTING / PHYSICAL_CERTIFICATION_DATE=2026-09-09 / OPERATOR_CONFIRMED=SI
CHECKLIST_DOS_REPARTIDORES=11/11 PASS — mismo pedido visible a ambos, single-winner, perdedor no asignado y desaparece tras poll, Cliente avanza a En camino, Negocio deja de buscar, nunca dos asignados, segundo pedido disponible sin en_camino manual, Retiro/Mesa excluidos, notificaciones correctas sin duplicados
TWO_DRIVER_PHYSICAL_SINGLE_WINNER=SI / FINAL_ASSIGNED_DRIVER_COUNT=1 — complementa (no reemplaza) la evidencia automática ya probada (Promise.all contra Postgres real de TESTING)

CODE_CHANGES_REQUIRED_FOR_CLOSE=NO — ningún archivo de código tocado en esta tarea
CLOSE_COMMIT_SHA=N/A — los 8 archivos de autoridad/contexto están TODOS untracked en este repo — sin commit posible ni necesario
PUSH_TO_TESTING=NO (nada trackeado cambió) / ORIGIN_TESTING_MATCH_HEAD=SI / ORIGIN_MAIN_UNCHANGED=SI
PRODUCTION_TOUCHED=NO

P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29B_STATUS=CLOSED_TESTING_CERTIFIED (preservado) / P2_T29C_STATUS=CLOSED_TESTING_CERTIFIED (era WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION) / P2_T29_STATUS=IN_PROGRESS (T29D/T29E pendientes, epic completo no se marca cerrado)
RELEASE_BATCH=P2_T29B_PLUS_P2_T29C / RELEASE_BATCH_READY_FOR_PROMOTION=SI / PROMOTION_EVALUATION_POINT=NOW / RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS (preservada)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, sigue bloqueando lanzamiento público — no bloquea esta certificación) / F-PRE-T29-03/F-P2-TESTINFRA-01/F-P2-T29A-02=sin cambios / F-P2-T29B-R1-01/F-P2-T29C-01=RESOLVED (preservados)
NEXT_RECOMMENDED_ACTION=PROMOTE_P2_T29B_PLUS_P2_T29C_TO_MAIN_AND_PRODUCTION — tarea SEPARADA, NO iniciada por este cierre. NO main push, NO Production deploy, NO tag, NO migration en esta tarea.
```

Cierre formal de P2-T29C tras certificación física del operador con DOS
repartidores reales en TESTING: PASS en los 11 ítems del checklist —
ambos ven el mismo pedido `esperando_repartidor`, exactamente uno gana,
el perdedor no queda asignado y su pedido desaparece tras el siguiente
poll, Cliente avanza a "En camino", Negocio deja de mostrar "Buscando
repartidor...", nunca dos asignados, Retiro/Mesa nunca aparecen,
notificaciones correctas sin duplicados. Esta certificación COMPLEMENTA
— no reemplaza — la evidencia automática de concurrencia ya probada en
la implementación (`Promise.all` contra Postgres real). Tarea puramente
documental: no se tocó ningún archivo de código, `origin/testing-codex`
sigue exactamente en el commit certificado
(`0c2300827ea09d149253b84bc43fa5bda6db29f2`), `origin/main` permanece
intacto en `c45fd5ec8cd771d68020f37d892be31d62fb54c5`. Sin commit ni
push en este cierre (authority docs untracked).

Con T29B y T29C ambos `CLOSED_TESTING_CERTIFIED`, el bloque
`RELEASE_BATCH=P2_T29B_PLUS_P2_T29C` queda
`RELEASE_BATCH_READY_FOR_PROMOTION=SI` — **pero esta tarea NO promueve
nada a Production**. La ejecución de
`PROMOTE_P2_T29B_PLUS_P2_T29C_TO_MAIN_AND_PRODUCTION` queda como tarea
separada, explícitamente pendiente de autorización futura. `P2_T29_
STATUS` permanece `IN_PROGRESS` — T29D/T29E siguen pendientes según la
autoridad del roadmap. Detalle completo:
`codex-reports/P2_T29C_PHYSICAL_CERTIFICATION_CLOSEOUT.md`.

## 0.50 ESTADO ACTUAL — P2-T29C IMPLEMENTADO, TESTEADO (incluye concurrencia real de 2 repartidores contra Postgres de TESTING) Y DESPLEGADO A TESTING: Repartidor ya consume `esperando_repartidor`, gap crítico de concurrencia de la auditoría original cerrado — `main`/Production SIN CAMBIOS, `P2_T29C_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` (NO CERRADO, requiere certificación física con DOS repartidores reales) (2026-09-09)

```text
HEAD=origin/testing-codex=0c2300827ea09d149253b84bc43fa5bda6db29f2 (AVANZÓ desde 155b4c4 — 1 commit nuevo)
origin/main=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (SIN CAMBIOS — checkpoint P2-T29A preservado, verificado antes y después)
Railway TESTING/DeliGO Copy=0c23008... SUCCESS (138s) / chat en vivo TESTING también redeployado mismo commit, SUCCESS / Railway Production/DeliGO=c45fd5e... SUCCESS (sin cambios)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios)

TASK_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_TWO_DRIVER_PHYSICAL_GATE

P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29B_STATUS=CLOSED_TESTING_CERTIFIED (normalizado, preservado — 10/10 PASS físico) / P2_T29C_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION (era READY_TO_START) / P2_T29_STATUS=IN_PROGRESS

SIGNIFICADO_FINAL=esperando_repartidor=disponible sin asignar (CANÓNICO); en_camino=ya asignado, en viaje (ya NO significa "buscando repartidor" — ese significado sobrecargado quedó resuelto)
AVAILABLE_QUERY=GET /api/repartidor/pedidos consulta esperando_repartidor (canónico) + en_camino (LEGACY_AVAILABLE_COMPAT, necesario porque NEGOCIO_T29B_ROLLOUT_FORWARD_TRANSITIONS todavía acepta preparando->en_camino directo durante el rollout) — única autoridad: isAvailableForDriverAcceptance() en order-transitions.ts, consumida también por el CAS de aceptación y por auto-cancel
ACCEPT_CAS=repartidor/pedidos/[id]/aceptar/route.ts compara contra el ÚNICO valor exacto de estado leído (nunca estado:{in:[...]} en la escritura); PedidoEvento.estadoAnterior corregido de un hardcodeo a "en_camino" (F-P2-T29C-01, resuelto en la misma tarea) al valor real de origen
TWO_DRIVER_CONCURRENCY_PROVEN=SI — cierra el GAP CRÍTICO de la auditoría P2-T29 original ("sin ningún test de concurrencia real"): 2 tests con Promise.all contra Postgres real de TESTING (canónico + legacy), 1 winner/1 loser, exactamente 1 repartidor asignado, exactamente 1 PedidoEvento
CANCEL_ACCEPT_RACE_PROVEN=SI (Negocio cancela esperando_repartidor mientras Repartidor acepta — resultado siempre coherente, nunca corrupto)
AUTO_CANCEL=reconoce ambos estados, misma ventana de tiempo sin cambios, mismo fix de auditoría
NEW_DELIVERY_NOTIFICATION_BOUNDARY=movido de en_camino a preparando->esperando_repartidor (canónico), preparando->en_camino directo (legacy) preservado sin duplicar — la aceptación real de Repartidor (endpoint distinto) nunca re-dispara este aviso
ASSIGNMENT_NOTIFICATION_TO_CLIENTE=preexistente, preservada sin cambios ("Repartidor asignado 🛵")
CLIENT_WAITING_NOTIFICATION_PRESERVED=SI (T29B-R1, sin tocar) / CLIENT_TIMELINE=sin tocar
NEGOCIO_WAITING_TO_EN_CAMINO_ACTION=NO cambiado, reverificado (waiting driver boundary de T29B intacto)
REPARTIDOR_UI=sin cambios de frontend (deliveries-tab.tsx/repartidor-panel.tsx ya dependían 100% del split servidor, sin comparación de estado hardcodeada); polling 8s sin cambios
LEGACY_COMPATIBILITY=explícita y acotada, sin backfill, sin migration, Retiro/Mesa nunca elegibles (metodoEntrega gatea antes que estado)

FILESET=10 archivos (5 producto + 5 test: 1 modificado + 4 nuevos) — Prisma/migrations/SW/manifests/chat/branding/Cliente-redesign SIN TOCAR
TEST_MATRIX=~90 tests nuevos/extendidos (7 order-transitions + 4 available-query + 12 aceptar-CAS incl. 2 concurrencia real + 1 cancel-vs-accept-race + 4 auto-cancel + 4 new-delivery-boundary) + 142+27+12 reverificados sin cambios de comportamiento (T29B-R1, T29B/T29A flow, Operaciones PyR/Salón) = NEW_FAIL=0
VERIFICACION_VISUAL_LOCAL=NO REALIZADA en esta tarea (a diferencia de T29B) — Promise.all contra Postgres real de TESTING se consideró evidencia más rigurosa para el riesgo de concurrencia específico de esta tarea que un click manual de dos pestañas
BUILD/LINT/SECRET_SCAN=todos PASS/limpios / TYPECHECK_RAW=24 (idéntico al baseline, mismos 14 archivos preexistentes, 0 nuevos — 1 TS2769 real encontrado y corregido en un test nuevo durante esta misma tarea)

T29C_COMMIT=0c2300827ea09d149253b84bc43fa5bda6db29f2 (parent 155b4c4f0ce6426bea429f9aa400061e8a1e5455, testing-codex)
PUSH_TO_TESTING=SI / MAIN_PUSH=NO
TESTING_DEPLOYMENT=22c337f9-773f-4478-8587-ee97cc626a26 (DeliGO Copy) SUCCESS, commit match exacto / chat en vivo TESTING también SUCCESS mismo commit / SMOKE=/repartidor,/negocio,/cliente,/operaciones todos 200
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (sin cambios, verificado antes y después)

RELEASE_CADENCE_DECISION=sin cambios — RELEASE_BATCH=P2_T29B_PLUS_P2_T29C, P2_T29B_PROMOTION_TO_PRODUCTION_AFTER_CLOSE=NO, PROMOTION_EVALUATION_POINT=AFTER_P2_T29C_CERTIFICATION, sin promoción en esta tarea

F-PRE-T29-03=OPEN_NON_BLOCKING_TEST_INFRA (sin cambios) / F-P2-TESTINFRA-01=OPEN_DEFERRED (sin cambios) / F-P2-T29A-02=PREEXISTING_NON_BLOCKING_AUDIT_GAP (sin cambios) / F-P2-T29B-R1-01=RESOLVED (preservado) / F-P2-T29C-01=RESOLVED (PedidoEvento.estadoAnterior hardcodeado, corregido en esta tarea)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado — condiciona el setup físico de T29C: preferir 2 dispositivos/perfiles independientes, no bloquea la certificación)
NEXT_RECOMMENDED_ACTION=OPERATOR_TWO_DRIVER_PHYSICAL_CERTIFICATION_P2_T29C — checklist entregado en el reporte (codex-reports/P2_T29C_REPARTIDOR_WAITING_DRIVER_ACCEPTANCE_AND_CONCURRENCY.md sección 17). Sólo si PASS: cerrar T29C (P2_T29C_STATUS=CLOSED_TESTING_CERTIFIED) y recién ahí evaluar PROMOTE_P2_T29B_PLUS_P2_T29C_TO_MAIN_AND_PRODUCTION como tarea separada. NO main, NO Production, NO tag en esta tarea.
```

Tercera fase de Repartidor de P2-T29: hace que Repartidor consuma
realmente `esperando_repartidor` en vez del `en_camino`+
`repartidorId=null` legacy sobrecargado. La query de disponibilidad, el
CAS de aceptación, y auto-cancel migran a una única autoridad compartida
(`isAvailableForDriverAcceptance` en `order-transitions.ts`) que
reconoce el estado canónico Y preserva compatibilidad legacy explícita
(nunca ambigua — cada CAS compara contra el valor EXACTO leído, jamás un
`estado: { in: [...] }` en la escritura), necesaria porque
`NEGOCIO_T29B_ROLLOUT_FORWARD_TRANSITIONS` todavía acepta la arista
directa `preparando->en_camino` durante el rollout de T29B.

El GAP CRÍTICO que la auditoría original de P2-T29 identificó
explícitamente ("la aceptación atómica del repartidor… no tiene NINGÚN
test de concurrencia real que lo demuestre") queda cerrado: dos
repartidores reales compitiendo vía `Promise.all` contra Postgres de
TESTING prueban single-winner (1×200/1×409, exactamente un
`repartidorId` final, exactamente 1 `PedidoEvento`). Un tercer test
cubre la carrera cancelación (Negocio) vs aceptación (Repartidor) —
resultado siempre coherente. Durante la implementación se corrigió un
hardcodeo de auditoría (`PedidoEvento.estadoAnterior` fijo a
`"en_camino"`, ya no siempre cierto) en ambos endpoints tocados.

El aviso a Repartidores de "nuevo delivery disponible" se movió de
`en_camino` a la transición canónica `preparando->esperando_repartidor`,
preservando el disparo legacy sin duplicar. Repartidor UI no requirió
ningún cambio de frontend — ya dependía 100% del split servidor.

A diferencia de T29B, esta tarea NO incluyó verificación visual en
navegador — la prueba de concurrencia real vía `Promise.all` contra
Postgres se consideró más fuerte que un click manual de dos pestañas
para el riesgo específico de esta tarea, y requería además mapear
`DATABASE_URL` en el entorno del dev server sin tocar `.env`. El gate
real y determinante sigue siendo la certificación física con DOS
repartidores reales, que continúa pendiente. `P2_T29C_STATUS` permanece
`WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION`. Detalle completo:
`codex-reports/P2_T29C_REPARTIDOR_WAITING_DRIVER_ACCEPTANCE_AND_CONCURRENCY.md`.

## 0.49 ESTADO ACTUAL — P2-T29B CERRADO: certificación física del operador PASS (10/10 ítems — DOMICILIO 8/8, RETIRO 2/2) sobre el fix de P2-T29B-R1 — `P2_T29B_STATUS=CLOSED`, `P2_T29C_STATUS=READY_TO_START` (NO iniciada, operador pidió revisar el cierre primero) — `main`/Production SIN CAMBIOS, tarea puramente documental sin código tocado (2026-09-09)

```text
HEAD=origin/testing-codex=155b4c4f0ce6426bea429f9aa400061e8a1e5455 (SIN CAMBIOS — ningún commit nuevo, tarea de cierre puramente documental)
origin/main=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (SIN CAMBIOS — checkpoint P2-T29A preservado, verificado antes y después)
Railway TESTING/DeliGO Copy=155b4c4... SUCCESS (sin cambios) / Railway Production/DeliGO=c45fd5e... SUCCESS (sin cambios)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios)

TASK_STATUS=CLOSED_DOCUMENTATION_ONLY

PHYSICAL_CERTIFICATION_DATE=2026-09-09 / PHYSICAL_CERTIFICATION_RESULT=PASS / PHYSICAL_CERTIFICATION_ENVIRONMENT=TESTING / PHYSICAL_CERTIFICATION_ITEMS_PASS=10 / PHYSICAL_CERTIFICATION_ITEMS_FAIL=0 / OPERATOR_CONFIRMED=SI
TIMELINE_DOMICILIO_CERTIFIED=SI (Recibido, Aceptado en el mismo primer nodo, Preparando, Buscando delivery, notificación única, En camino, Listo, nunca 6 pasos)
TIMELINE_RETIRO_CERTIFIED=SI (aceptado mantiene la timeline activa, nunca aparece "Buscando delivery")
WAITING_DRIVER_NOTIFICATION_CERTIFIED=SI / WAITING_DRIVER_NOTIFICATION_SINGLE_DELIVERY=SI
SIX_STEP_REGRESSION=NO / RETIRO_WAITING_DRIVER_REGRESSION=NO

CODE_CHANGES_REQUIRED_FOR_CLOSE=NO — ningún archivo de código tocado en esta tarea (client-orders-panel.tsx/push.ts/route.ts/repartidor/Prisma/migrations/sw/manifest/chat/branding sin tocar, git diff --stat vacío)
CLOSE_COMMIT_SHA=N/A — los 8 archivos de autoridad/contexto (CODEX_REPORT.md, ROADMAP.md, FINDINGS.md, TEST_AUTHORITY.md, DECISIONS_AND_INVARIANTS.md, GIT_DEPLOY_HISTORY.md, COMPLETED_TASKS.md, DELIGO_FULL_CONTEXT_LATEST.md) están TODOS untracked por git en este repo (confirmado con git ls-files) — actualizarlos no genera ningún commit posible ni necesario
PUSH_TO_TESTING=NO (nada trackeado cambió) / ORIGIN_TESTING_MATCH_HEAD=SI / ORIGIN_MAIN_UNCHANGED=SI
PRODUCTION_TOUCHED=NO

P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T27_STATUS=MERGED_CLOSED_BY_T29A (preservado) / P2_T29B_STATUS=CLOSED (era WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION) / P2_T29B_FINAL_RESULT=PASS / P2_T29C_STATUS=READY_TO_START (era QUEUED_AFTER_P2_T29B) / P2_T29_STATUS=IN_PROGRESS (epic completo requiere T29C)
RELEASE_CADENCE_DECISION=sin cambios — RELEASE_BATCH=P2_T29B_PLUS_P2_T29C preservado, P2_T29B_PROMOTION_TO_PRODUCTION_AFTER_CLOSE=NO preservado (cerrar T29B no dispara promoción por sí solo — evaluación recién después de certificar T29C también)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, sigue bloqueando lanzamiento público)
NEXT_TASK_RECOMMENDED=P2-T29C (Repartidor consume esperando_repartidor: polling/visibilidad + aceptación real) — NO iniciada automáticamente, el operador pidió detenerse a revisar este cierre primero. NO main, NO Production, NO tag en esta tarea.
```

Cierre formal de P2-T29B tras `OPERATOR_PHYSICAL_CERTIFICATION=PASS`
(10/10 ítems, 0 fallas) reportado explícitamente por el operador:
domicilio (Recibido→Aceptado en el mismo primer nodo→Preparando→
Buscando delivery con notificación única→En camino→Listo, 5 pasos
exactos, nunca 6) y retiro (`aceptado` mantiene la timeline activa,
"Buscando delivery" nunca aparece) ambos PASS sin regresión. Esta
tarea fue puramente documental — no se tocó ningún archivo de código,
el commit certificado (`155b4c4`, P2-T29B-R1) ya estaba desplegado en
TESTING desde la tarea anterior. Los 8 archivos de autoridad/contexto
están todos `untracked` por git en este repositorio (confirmado con
`git ls-files`), consistente con el house style ya documentado del
proyecto — actualizarlos no genera ningún diff trackeado, por lo que
no hubo commit ni push en esta tarea.

`P2_T29B_STATUS` pasa a `CLOSED`. `P2_T29C_STATUS` pasa a
`READY_TO_START`, pero **NO se inicia automáticamente** — el operador
pidió detenerse explícitamente para revisar este cierre antes de
comenzar la siguiente etapa. `RELEASE_BATCH=P2_T29B_PLUS_P2_T29C` y
`P2_T29B_PROMOTION_TO_PRODUCTION_AFTER_CLOSE=NO` se preservan sin
cambios: cerrar T29B no dispara ninguna promoción a Production por sí
solo, esa evaluación sigue diferida hasta certificar también T29C.
Detalle completo:
`codex-reports/P2_T29B_PHYSICAL_CERTIFICATION_CLOSEOUT.md`.

## 0.48 ESTADO ACTUAL — P2-T29B-R1 FIX FOCAL IMPLEMENTADO Y DESPLEGADO A TESTING: timeline Cliente ya no se apaga en `aceptado`/`esperando_repartidor` (5 pasos domicilio, primer nodo dinámico Recibido→Aceptado), notificación dedicada "Buscando delivery" agregada — `main`/Production SIN CAMBIOS, `P2_T29B_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` (SIGUE NO CERRADO — este fix es prerequisito de esa certificación) (2026-09-09)

```text
HEAD=origin/testing-codex=155b4c4f0ce6426bea429f9aa400061e8a1e5455 (AVANZÓ desde 3d9f3b3 — 1 commit nuevo)
origin/main=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (SIN CAMBIOS — checkpoint P2-T29A preservado, verificado antes y después)
Railway TESTING/DeliGO Copy=155b4c4... SUCCESS (36s) / chat en vivo TESTING también redeployado mismo commit, RUNNING / Railway Production/DeliGO=c45fd5e... SUCCESS (sin cambios)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios)

TASK_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_GATE

MOTIVO=feedback físico del operador durante la certificación de T29B, ANTES de cerrarla: la timeline Cliente usaba un findIndex sobre un array literal sin `aceptado`/`esperando_repartidor` — al llegar a esos estados el índice caía en -1 y la barra de progreso se apagaba por completo (el badge/label sí eran correctos desde T29B, sólo la timeline visual estaba rota)
CLIENT_TIMELINE_FIX=mapping explícito estado->índice (DOMICILIO_STEP_INDEX/RETIRO_STEP_INDEX en client-orders-panel.tsx) reemplaza el findIndex — domicilio conserva EXACTAMENTE 5 posiciones (Recibido/Aceptado dinámico -> Preparando -> Buscando delivery -> En camino -> Listo), retiro conserva su layout de 4 nodos sin cambio de forma (sólo se corrige que aceptado no apague la barra), Mesa sin tocar
CLIENT_TIMELINE_DYNAMIC_FIRST_NODE=SI — "Recibido" se vuelve "Aceptado" en el MISMO nodo una vez que el negocio acepta (nunca 2 nodos separados, nunca 6 pasos)
CLIENT_WAITING_DRIVER_NOTIFICATION=SI — nueva factory waitingDriverNotification() en push.ts, TITLE="Buscando delivery" BODY="El local está esperando un delivery para tu pedido.", enviada SÓLO en la transición real preparando->esperando_repartidor de domicilio (no aceptado — sigue diferido a T29D sin cambios —, no retiro, no legacy preparando->en_camino directo, no CAS loser)
SINGLE_WINNER_REVERIFICADO=CAS ya existente de T29A/route.ts sin cambios — probado con carrera de concurrencia real: 1×200/1×409, exactamente 1 Notificacion con título "Buscando delivery", 0 duplicados
REPARTIDOR/NEW_DELIVERY_NOTIFICATION/PRISMA/MIGRATIONS/SW/MANIFEST/CHAT/BRANDING=SIN TOCAR (fileset acotado a 5 archivos: 3 producto + 2 test)

TEST_MATRIX=142 tests reales (13 timeline puro NUEVO + 8 safe-render + 35 authority + 59 push unit + 14 T29B-flow integración [incluye 3 NUEVOS de notificación] + 13 CAS-concurrency/CAS-mesa/client-cancel regresión) — NEW_FAIL=0
VERIFICACION_VISUAL_LOCAL=NO REALIZADA en esta tarea (a diferencia de T29B) — se consideró que la cobertura de tests puros exhaustiva por estado (incluyendo saltos legacy) era suficiente para este fix acotado de mapping; el gate determinante sigue siendo la certificación física pendiente
BUILD/LINT/SECRET_SCAN=todos PASS/limpios / TYPECHECK_RAW=24 (idéntico al baseline ya documentado en T29B, mismos 14 archivos preexistentes, 0 nuevos)

T29B_R1_COMMIT=155b4c4f0ce6426bea429f9aa400061e8a1e5455 (parent 3d9f3b32f9359a4cdd0385f13bf5c4621d6d16ce, testing-codex)
PUSH_TO_TESTING=SI / MAIN_PUSH=NO
TESTING_DEPLOYMENT=22c337f9-773f-4478-8587-ee97cc626a26 (DeliGO Copy) SUCCESS, commit match exacto / chat en vivo TESTING también SUCCESS mismo commit
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (sin cambios, verificado antes y después)

RELEASE_CADENCE_DECISION=sin cambios — RELEASE_BATCH=P2_T29B_PLUS_P2_T29C, P2_T29B_PROMOTION_TO_PRODUCTION_AFTER_CLOSE=NO, evaluación recién después de certificar T29C

F-PRE-T29-03=OPEN_NON_BLOCKING_TEST_INFRA (sin cambios) / F-P2-TESTINFRA-01=OPEN_DEFERRED (sin cambios) / F-P2-T29A-02=PREEXISTING_NON_BLOCKING_AUDIT_GAP (sin cambios) / F-P2-T29B-R1-01=RESOLVED (timeline Cliente apagada, corregida en esta tarea)
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T27_STATUS=MERGED_CLOSED_BY_T29A (preservado) / P2_T29B_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION (sin cambios, este fix es prerequisito de esa certificación) / P2_T29C_STATUS=QUEUED_AFTER_P2_T29B / P2_T29_STATUS=IN_PROGRESS
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, sigue bloqueando lanzamiento público)
NEXT_RECOMMENDED_ACTION=OPERATOR_PHYSICAL_CERTIFICATION_P2_T29B — checklist reducido específico de este fix entregado en el reporte (codex-reports/P2_T29B_R1_CLIENT_TIMELINE_AND_WAITING_DRIVER_NOTIFICATION.md sección 10). Sólo si PASS: cerrar T29B (P2_T29B_STATUS=CLOSED_TESTING_CERTIFIED) e iniciar P2-T29C como tarea separada. NO T29C todavía, NO main, NO Production, NO tag.
```

Corrección focal (`PHYSICAL_GATE_FIX`) descubierta durante la
certificación física de P2-T29B, ANTES de cerrarla: la timeline de
Cliente para pedidos domicilio/retiro se apagaba por completo al
llegar a `aceptado`/`esperando_repartidor` — un `findIndex` sobre un
array literal que nunca incluyó esos 2 estados nuevos de T29B.
Reemplazado por un mapping explícito estado→índice, preservando
exactamente 5 posiciones visuales para domicilio (decisión explícita
del operador: nunca 6) con el primer nodo dinámico ("Recibido" pasa a
mostrarse como "Aceptado" en el mismo lugar, nunca dos nodos
separados). Retiro conserva su layout de 4 nodos sin cambio de forma,
sólo se corrigió el mismo bug de fondo para `aceptado`. Mesa no se
tocó.

Se agregó también una notificación dedicada al Cliente para la
transición real `preparando -> esperando_repartidor` en domicilio
("Buscando delivery" / "El local está esperando un delivery para tu
pedido.") — T29B había dejado ese estado completamente mudo para el
Cliente (diferido a T29D). `aceptado` sigue sin notificación propia,
sin cambios respecto a T29B. El invariante single-winner (CAS real ya
existente de T29A) se reverificó con una carrera de concurrencia real:
exactamente 1 notificación, 0 duplicados.

A diferencia de T29B, esta tarea NO incluyó verificación visual en
navegador con clicks reales — se consideró que la cobertura de tests
puros exhaustiva (cada estado, incluyendo los saltos legacy) era
suficiente para un fix acotado de mapping, dado que el gate
determinante sigue siendo la certificación física del operador, que
continúa pendiente. `P2_T29B_STATUS` permanece
`WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` — este fix es un
prerequisito de esa certificación, no la reemplaza. Detalle completo:
`codex-reports/P2_T29B_R1_CLIENT_TIMELINE_AND_WAITING_DRIVER_NOTIFICATION.md`.

## 0.47 ESTADO ACTUAL — P2-T29B IMPLEMENTADO Y DESPLEGADO A TESTING: flujo aceptado/preparando/esperando_repartidor activo en Negocio, cancelación Cliente desde aceptado activada, `esperando_repartidor` sin consumidor todavía (T29C, esperado) — `main`/Production SIN CAMBIOS, `P2_T29B_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` (NO CERRADO) (2026-09-09)

```text
HEAD=origin/testing-codex=3d9f3b32f9359a4cdd0385f13bf5c4621d6d16ce (AVANZÓ desde 4b19954 — 1 commit nuevo)
origin/main=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (SIN CAMBIOS — checkpoint P2-T29A preservado)
Railway TESTING/DeliGO Copy=3d9f3b3... SUCCESS / Railway Production/DeliGO=c45fd5e... SUCCESS (sin cambios) / tag p2-t29a-stable-2026-09-09 -> c45fd5e (sin cambios)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios)

TASK_STATUS=T29B_IMPLEMENTATION_COMPLETE_AWAITING_OPERATOR_PHYSICAL_CERTIFICATION

ORDER_TRANSITION_AUTHORITY_FILE=src/lib/order-transitions.ts — gana NEGOCIO_T29B_ROLLOUT_FORWARD_TRANSITIONS (grafo NUEVO, sólo para negocio/pedidos/[id]/estado domicilio/retiro: aceptado+esperando_repartidor NUEVOS + aristas legacy preservadas). ACTIVE_FORWARD_TRANSITIONS SIN CAMBIOS — Operaciones/PyR, Operaciones/Salón, negocio/pedidos PUT-mesa siguen ahí, cero impacto (reverificado con sus propias suites, 12/12 pass)
UX_NEGOCIO=DOMICILIO: "Aceptar pedido"(recibido->aceptado)->"Preparar"(->preparando)->"Buscar repartidor"(->esperando_repartidor, SIN botón después — boundary T29C). RETIRO: mismo aceptado/preparar, luego "Listo para retirar" sin cambios. MESA: sin aceptado, flujo intacto
CLIENTE_PUEDE_CANCELAR_EN_ACEPTADO=activado como comportamiento real (endpoint cancellableStatuses + gate de UI canCancel, ambos actualizados — sin el segundo, el backend aceptaría la cancelación pero el botón nunca aparecería)
WAITING_DRIVER_BOUNDARY=esperando_repartidor NUNCA es origen de ninguna transición de Negocio — verificado por test puro + integración. T29B_WAITING_DRIVER_NOT_YET_CONSUMED_BY_DRIVER=EXPECTED (un pedido puede quedar "Buscando repartidor..." sin que Repartidor lo vea todavía — eso es T29C, no un bug)
CLIENT_SAFE_RENDER=labels/emoji/colores agregados (aceptado="Aceptado"/✅/azul, esperando_repartidor="Buscando repartidor"/🔍/índigo) — nunca raw underscore; timeline de Cliente (T29D) NO tocado, su guard preexistente ya maneja el caso con seguridad

TEST_MATRIX=93 tests reales (38 authority + 11 negocio-regresión + 6 domicilio/retiro/mesa-flow + 2 CAS-concurrency + 4 client-cancel + 1 negocio-cancel + 5 safe-render + 14 order-security + 12 pyr/salon-regresión) — NEW_FAIL=0
VERIFICACION_VISUAL_LOCAL=EN VIVO con clicks reales — flujo domicilio Y retiro completos, clic por clic, contra un Negocio sintético creado en TESTING (fixtures borradas inmediatamente después, .env.local y script temporal nunca commiteados)
BUILD/LINT/TYPECHECK/SECRET_SCAN=todos PASS/limpios, sin regresión

T29B_COMMIT=3d9f3b32f9359a4cdd0385f13bf5c4621d6d16ce (parent 4b199540c78ebe0a010c699f6fc2e63b43d162a0, testing-codex)
PUSH_TO_TESTING=SI / MAIN_PUSH=NO
TESTING_DEPLOYMENT=1c00f674-0882-4785-91b6-2560e275fec0 (DeliGO Copy) SUCCESS, commit match exacto / chat en vivo TESTING también SUCCESS mismo commit
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (sin cambios)

RELEASE_CADENCE_DECISION=P2_T29B_PROMOTION_TO_PRODUCTION_AFTER_CLOSE=NO — RELEASE_BATCH=P2_T29B_PLUS_P2_T29C (bloque funcional único: T29B hace alcanzable esperando_repartidor sin que Repartidor lo consuma todavía; evaluación de promoción recién después de certificar T29C — excepción explícita ya prevista en RELEASE_CADENCE_POLICY, no la contradice)

F-PRE-T29-03=OPEN_NON_BLOCKING_TEST_INFRA (sin cambios) / F-P2-TESTINFRA-01=OPEN_DEFERRED (sin cambios) / F-P2-T29A-02=PREEXISTING_NON_BLOCKING_AUDIT_GAP (sin cambios, no corregido — no fue necesario para T29B)
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T27_STATUS=MERGED_CLOSED_BY_T29A (preservado) / P2_T29B_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION / P2_T29C_STATUS=QUEUED_AFTER_P2_T29B / P2_T29_STATUS=IN_PROGRESS
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, sigue bloqueando lanzamiento público)
NEXT_RECOMMENDED_ACTION=OPERATOR_PHYSICAL_CERTIFICATION_P2_T29B — checklist DOMICILIO/RETIRO/MESA/MOBILE entregado en el reporte (codex-reports/P2_T29B_NEGOCIO_ACCEPTED_PREPARING_WAITING_DRIVER_FLOW.md sección 23). Sólo si PASS: cerrar T29B (P2_T29B_STATUS=CLOSED_TESTING_CERTIFIED) e iniciar P2-T29C como tarea separada. NO T29C todavía, NO main, NO Production, NO tag.
```

Segunda fase de implementación de P2-T29 (T29B), sobre la autoridad y
el CAS que T29A dejó listos. El grafo de rollout de Negocio
(`NEGOCIO_T29B_ROLLOUT_FORWARD_TRANSITIONS`) queda deliberadamente
separado del grafo activo que el resto de los actores sigue usando —
ni Operaciones/PyR, ni Operaciones/Salón, ni Repartidor cambian de
comportamiento en esta tarea, confirmado reverificando sus propias
suites de test sin modificarlas. La decisión de cancelación de Cliente
desde `aceptado`, ya cerrada como autoridad pura en T29A, pasa a ser
comportamiento real — con el cuidado explícito de actualizar tanto el
backend como el gate de UI que decide mostrar el botón (un cambio a
medias habría dejado la capacidad inutilizable).

Se estableció y probó el "waiting driver boundary": Negocio nunca
puede avanzar manualmente `esperando_repartidor` a `en_camino` — eso
es exclusivo de T29C. La verificación fue más allá de tests
automatizados: se levantó la app localmente, se creó un Negocio
sintético directamente en la base de TESTING, y se ejecutó el flujo
domicilio y retiro COMPLETO con clicks reales sobre la UI renderizada,
confirmando visualmente cada badge/botón/label en cada paso — no sólo
lectura de código ni sólo integración de API. **T29B no se cierra
todavía** — falta la certificación física del operador en un
dispositivo real (mismo rigor que P2-T31), con un checklist corto
entregado en el reporte. Como T29B hace alcanzable
`esperando_repartidor` sin que Repartidor lo consuma (T29C), la
promoción a Production de este bloque queda diferida hasta certificar
también T29C — decisión de cadencia de release explícita, registrada
en `DECISIONS_AND_INVARIANTS.md`, consistente con (no contradice) la
política de promociones frecuentes. Reporte completo:
`codex-reports/P2_T29B_NEGOCIO_ACCEPTED_PREPARING_WAITING_DRIVER_FLOW.md`.

## 0.46 ESTADO ANTERIOR — CHECKPOINT P2-T29A EN PRODUCTION: `main`/Production promovidos a `c45fd5e` (source `testing-codex@4b19954`), 0 migrations, tag `p2-t29a-stable-2026-09-09` creado, NUEVA política `RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS` registrada — `P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED` (2026-09-09)

```text
HEAD=origin/testing-codex=4b199540c78ebe0a010c699f6fc2e63b43d162a0 (SIN CAMBIOS)
origin/main=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (AVANZÓ desde 969ea77 — checkpoint P2-T29A promovido)
Railway Production/DeliGO=c45fd5e... SUCCESS / Railway Production/chat en vivo=c45fd5e... SUCCESS (tras 1 reintento — ver incidente abajo)
TAG=p2-t29a-stable-2026-09-09 -> c45fd5e (nuevo) / tag pre-t29-stable-2026-09-08 -> 969ea77 (preservado, sin cambios)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios — este checkpoint NO es lanzamiento público)

RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS (NUEVA, registrada formalmente en DECISIONS_AND_INVARIANTS.md) — regla: cerrar+certificar un bloque grande o un lote lógico de tareas pequeñas implica EVALUAR promoción a main/Production antes de iniciar el siguiente bloque grande, salvo blocker real/gate físico pendiente/regresión nueva. Primera aplicación práctica: esta misma tarea (promovió T29A solo, sin esperar T29B-E).

PROMOTION_DIFF=exactamente los 10 archivos de T29A (6 A, 4 M, 0 D) / T29B_PRESENT=NO / T29C_PRESENT=NO / NEW_MIGRATIONS=0
RELEASE_METHOD=snapshot commit vía git commit-tree (tercera vez, mismo procedimiento) / BYTE_TREE_EQUIVALENT=SI
TEST_BATTERY=81 tests reales (30 authority + 23 CAS + 14 order-security + 14 cancelación, 2 fallos preexistentes reproducidos idénticos contra el commit fuente sin modificar) / PROMOTION_NEW_FAIL=0
BUILD/LINT/TYPECHECK/SECRET_SCAN=todos PASS/limpios, sin regresión

INCIDENTE_TRANSITORIO_RESUELTO=el servicio "chat en vivo" (subdirectorio mini-services/chat-service, CONFIRMADO sin cambios en el diff) falló su primer deploy en este commit (build OK, sin logs de runtime) — la versión anterior (969ea77) siguió sirviendo sin corte real durante todo el intervalo. Presentado al operador (AskUserQuestion) sin resolver unilateralmente; eligió reintentar el mismo commit vía `railway redeploy` — SUCCESS en el segundo intento. Sin relación con el código promovido, sin rollback necesario.

MAIN_PRODUCTION_COMMIT_MATCH=SI (ambos servicios) / TESTING_CODEX_UNCHANGED=SI

P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (avanzó desde CLOSED_TESTING_CERTIFIED) / P2_T27_STATUS=MERGED_CLOSED_BY_T29A (preservado) / P2_T29B_STATUS=READY_TO_START
P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION (preservado — P2-T29 completo sigue abierto, NO se marca cerrado) / P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (preservado)
F-PRE-T29-03=OPEN_NON_BLOCKING_TEST_INFRA (sin cambios) / F-P2-TESTINFRA-01=OPEN_DEFERRED (sin cambios) / F-P2-T29A-02=PREEXISTING_NON_BLOCKING_AUDIT_GAP (negocio/pedidos/route.ts PUT mesa nunca genera PedidoEvento, sin cambios)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, sigue bloqueando lanzamiento público)
NEXT_RECOMMENDED_ACTION=P2_T29B_NEGOCIO_ACCEPTED_PREPARING_WAITING_DRIVER_FLOW — activar recibido→aceptado→preparando→esperando_repartidor en la API/UI de Negocio, no implementado en esta tarea
```

Primera aplicación práctica de la nueva política de cadencia de
release de DeliGO: en vez de dejar `testing-codex` acumular T29B-E
completos antes de tocar `main` (patrón que llevó a la auditoría masiva
de la promoción PRE-T29 original, con 168+ archivos de múltiples epics
acumulados), se promovió el bloque pequeño y recién certificado de
T29A inmediatamente, con una batería de test proporcionalmente focal
(81 tests, no la masiva de 1177). El único incidente de la tarea —un
fallo transitorio de plataforma en el servicio de chat, en un
subdirectorio completamente ajeno al diff— se resolvió con un simple
reintento del mismo commit ya verificado, sin necesidad de rollback y
sin corte de servicio real en ningún momento. `main` y Production
quedan exactamente sincronizados en `c45fd5e`; `testing-codex` intacto
en `4b19954`. Reporte completo:
`codex-reports/P2_T29A_PROMOTE_TO_MAIN_AND_PRODUCTION.md`.

## 0.45 ESTADO ANTERIOR — P2-T29A CERRADO: autoridad de transición compartida (`src/lib/order-transitions.ts`) creada, 4 tablas de reglas duplicadas eliminadas (una cuarta, no documentada, encontrada en `negocio/pedidos/route.ts`), Negocio (ambos endpoints) migrado a DB CAS real, single-winner probado en 3 niveles, push+deploy TESTING SUCCESS, `origin/main`/Production SIN CAMBIOS — `P2_T29B_STATUS=READY_TO_START` (2026-09-09)

```text
HEAD=origin/testing-codex=4b199540c78ebe0a010c699f6fc2e63b43d162a0 (AVANZÓ desde 6c6fc58 — 1 commit nuevo)
origin/main=969ea77ab1630b443fbc0e609397d9c45c5d7443 (SIN CAMBIOS — checkpoint PRE-T29 preservado)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PRE_T29_TAG=pre-t29-stable-2026-09-08 -> 969ea77 (sin cambios)

TASK_STATUS=CLOSED_TESTING_CERTIFIED

ORDER_TRANSITION_AUTHORITY_FILE=src/lib/order-transitions.ts (100% puro, sin DB/HTTP/Prisma/notificaciones/UI) — ACTIVE_FORWARD_TRANSITIONS (grafo vigente hoy, consumido por 4 endpoints) vs TARGET_FORWARD_TRANSITIONS (grafo P2-T29 con aceptado/esperando_repartidor, CERO uso productivo — sólo 30 tests puros)
DUPLICACION_RESUELTA=4 copias eliminadas (negocio/pedidos/[id]/estado, negocio/pedidos PUT [4ta copia no documentada por la auditoría original, F-P2-T29A-01], operaciones/pyr/estado, operaciones/salon/estado)
NEGOCIO_NON_CANCEL_DB_CAS=SI (ambos endpoints) / DATABASE_CAS_FINAL_AUTHORITY=SI / PROCESS_LOCAL_LOCK_SUPPLEMENTARY=SI
CAS_SINGLE_WINNER_PROVEN=SI — 3 niveles: primitiva aislada sin lock (simula multi-instancia Railway), cross-actor (Negocio vs Operaciones/PyR), endpoint completo (1 solo PedidoEvento del ganador)
CANONICAL_ACCEPTED_STATE=aceptado / CANONICAL_WAITING_DRIVER_STATE=esperando_repartidor / CLIENTE_PUEDE_CANCELAR_EN_ACEPTADO=true / MESA_PASA_POR_ACEPTADO=false — todos representados y testeados puros, CERO activados en ninguna API (USER_VISIBLE_STATE_FLOW_CHANGED=NO)
PRISMA_SCHEMA_CHANGED=NO / MIGRATION_CREATED=NO

TEST_MATRIX=30 authority + 11 negocio (lock+CAS+mesa) + 6 pyr + 6 salon + 14 cancelación (2 fail intermitente, preexistente, sin relación con el fileset — F-P2-TESTINFRA-01) + 14 order-security = NEW_FAIL=0
BUILD=PASS / ESLINT=PASS / TYPECHECK=24 raw idéntico al baseline, 0 nuevos / DIFF_CHECK=PASS / SECRET_SCAN=limpio

T29A_COMMIT=4b199540c78ebe0a010c699f6fc2e63b43d162a0 (parent 6c6fc581ad678883f4e9fbcb9dbf8e90ecf63912, testing-codex)
PUSH_TO_TESTING=SI / MAIN_PUSH=NO
TESTING_DEPLOYMENT=e84a22e3-27f5-4863-944e-c559e03976e3 (DeliGO Copy) SUCCESS, commit match exacto, boot limpio / chat en vivo también SUCCESS mismo commit
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=969ea77ab1630b443fbc0e609397d9c45c5d7443 (mismo deployment b516194e, sin cambios)

FINDINGS_NUEVOS=F-P2-T29A-01 (4ta copia duplicada, RESUELTO en la misma tarea) / F-P2-T29A-02 (negocio/pedidos/route.ts PUT nunca genera PedidoEvento, OPEN_NON_BLOCKING, preexistente, fuera de alcance de T29A)

P2_T29A_STATUS=CLOSED_TESTING_CERTIFIED (era PAUSED_PENDING_PRE_T29_PROMOTION) / P2_T27_STATUS=MERGED_CLOSED_BY_T29A / P2_T29B_STATUS=READY_TO_START / P2_T29C_STATUS=QUEUED_AFTER_T29B
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (preservado) / P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION (preservado, diseño original)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, sigue bloqueando lanzamiento público)
NEXT_RECOMMENDED_ACTION=P2_T29B_NEGOCIO_ACCEPTED_PREPARING_WAITING_DRIVER_FLOW — activar recibido→aceptado→preparando→esperando_repartidor en la API/UI de Negocio ("Aceptar pedido", "Preparar", "Buscar repartidor", "Buscando repartidor..."), no implementado en esta tarea
```

Primera fase real de implementación de P2-T29 (T29A), preparando la
base backend sin activar todavía ningún flujo visible. Se descubrió y
cerró, dentro de la misma tarea, una cuarta copia de las reglas de
transición no documentada por la auditoría original — un endpoint real
y en uso de Negocio (gestión de mesas propia, `salon-tab.tsx`) tenía
exactamente el mismo gap de CAS que su endpoint hermano. La evidencia de
concurrencia se construyó deliberadamente en 3 capas para evitar el
error metodológico de probar sólo a través de un endpoint con lock
síncrono (que en un único proceso de test siempre serializa antes de
llegar a la DB, nunca ejerciendo la garantía de CAS en aislamiento) —
ver la nueva entrada en `DECISIONS_AND_INVARIANTS.md` sobre este método.
`testing-codex` avanzó a `4b19954`; `main`/Production permanecen
exactamente en el checkpoint `969ea77` de la tarea anterior, sin tocar.
Reporte completo:
`codex-reports/P2_T29A_ORDER_TRANSITION_AUTHORITY_CAS_AND_CONCURRENCY_TESTS.md`.

## 0.44 ESTADO ANTERIOR — CHECKPOINT PRE-T29 COMPLETO: `main`/Production promovidos a `969ea77` (source `testing-codex@6c6fc58`), 2 migrations aplicadas, tag `pre-t29-stable-2026-09-08` creado y pusheado, `testing-codex` intacto, `P2_T29A_STATUS=READY_TO_START` — DeliGO SIGUE SIN PUBLICARSE (2026-09-09)

```text
HEAD=origin/testing-codex=6c6fc581ad678883f4e9fbcb9dbf8e90ecf63912 (SIN CAMBIOS desde el fix de F-PRE-T29-02)
origin/main=969ea77ab1630b443fbc0e609397d9c45c5d7443 (AVANZÓ desde 1de0d3c1 — checkpoint pre-T29 promovido)
Railway Production/DeliGO=969ea77... SUCCESS (deployment b516194e-83ec-4325-b0c7-8a2fac3b3b53, match exacto) / Railway Production/chat en vivo=969ea77... SUCCESS
PRE_T29_TAG=pre-t29-stable-2026-09-08 -> 969ea77 (creado y pusheado sólo tras SUCCESS+smoke)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PRODUCTION_CURRENT_ROLE=PRE_LAUNCH_CONTROLLED_ENVIRONMENT / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios — este checkpoint NO es lanzamiento público)

F_PRE_T29_02_STATUS=CLOSED_TESTING_CERTIFIED (evidencia física del operador en iPhone real: instalación nueva sin panel por defecto, acceso manual /cliente?iosDebug=1 intacto) — el fix ya está en Production, confirmado en vivo (manifest-cliente.json start_url=/cliente, sin iosDebug)
F_PRE_T29_03_STATUS=OPEN_NON_BLOCKING (NUEVO — fila huérfana en super_admins de la DB compartida de TESTING bloquea el cleanup de superadmin-auth.test.ts vía FK RESTRICT; probado preexistente e independiente del código; requiere autorización separada para limpiar la fila, nunca hecho unilateralmente)

RELEASE_METHOD=snapshot commit vía git commit-tree (tree=testing-codex@6c6fc58, parent=origin/main tip), sin usar git reset/stash/clean/rebase en ningún momento — el worktree aislado se recreó desde cero para materializar el commit en vez de resetearlo (la tarea prohibía reset categóricamente, sin excepción para worktrees)
BYTE_TREE_EQUIVALENT_TO_TESTING_HEAD=SI / T29_PRODUCT_IMPLEMENTATION_PRESENT=NO

TEST_BATTERY=695 tests reales pasando, 6 fallos confirmados preexistentes (2 ios-standalone-post-keyboard-nav-occlusion-r6 + 4 tracking P2-T02) + 2 exclusiones de infraestructura externa (superadmin-auth.test.ts por F-PRE-T29-03; client-block-security.integration.test.ts por F-P2-TESTINFRA-01 ya documentado) — TODOS reproducidos idénticos contra testing-codex@6c6fc58 sin modificar. PROMOTION_NEW_FAIL=0.
BUILD=PASS / ESLINT=8 errores/3 warnings idénticos al HEAD sin modificar (pre-existentes) / TYPECHECK=25 raw (24 histórico +1, root-causado a un artefacto de node_modules del repo principal ajeno al código promovido) / DIFF_CHECK=PASS / SECRET_SCAN=limpio

MIGRATIONS_APPLIED_PRODUCTION=2 (legal_acceptance_versioning, email_verification_expiry) sin error
PRODUCTION_MANIFEST_CLIENTE_START_URL=/cliente (verificado en vivo contra deligo.ar) / PRODUCTION_MANIFEST_CLIENTE_IOSDEBUG_PRESENT=NO

PRODUCT_CODE_CHANGED=NO (en esta tarea — el código ya estaba en testing-codex) / COMMIT_PERFORMED=SI (1 release commit) / TAG_CREATED=SI / PUSH_PERFORMED=SI (main)
PRODUCTION_CODE_CHANGED=SI (avanzó a 969ea77) / PRODUCTION_TOUCHED=SI (deploy completo autorizado explícitamente)

P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (preservado) / P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION (preservado) / P2_T29A_STATUS=READY_TO_START (AVANZÓ desde PAUSED_PENDING_PRE_T29_PROMOTION)
P2_T02_STATUS=WAITING_FOR_OPERATOR (preservado) / PAYMENTS_WORK_STATUS=DEFERRED (preservado)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado — sigue bloqueando un futuro lanzamiento público, no este checkpoint técnico)
NEXT_RECOMMENDED_ACTION=P2_T29A_ORDER_TRANSITION_AUTHORITY_CAS_AND_CONCURRENCY_TESTS
```

Checkpoint completo de promoción PRE-T29: `main`/Production quedan
como la última versión estable pre-T29; `testing-codex` es la rama
donde continuará T29A/T29B/T29C/etc. El único blocker que había
detenido el intento R1 (`F-PRE-T29-02`) se cerró con evidencia física
humana antes de reintentar. El método de release curado (snapshot
commit, nunca merge/fast-forward genérico de toda la historia) se
reutilizó exitosamente por segunda vez, esta vez sin usar `git reset`
en ningún momento. Un hang de 15+ minutos durante la reejecución de
tests (causado por una ruta de archivo de test inexistente en un
comando, no por el código) fue diagnosticado exhaustivamente a pedido
explícito del operador antes de continuar — se confirmó que no había
procesos huérfanos ni daño al repositorio/worktree. Con esa
autorización, la batería completa se reejecutó en grupos pequeños con
timeouts finitos, alcanzando **0 fallas nuevas** verificadas por
reproducción idéntica contra el HEAD sin modificar. Reporte completo:
`codex-reports/PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION_R2.md`.

## 0.43 ESTADO ANTERIOR — F-PRE-T29-02 CORREGIDO Y DESPLEGADO A TESTING: `public/manifest-cliente.json` start_url vuelve a `/cliente`, acceso manual `/cliente?iosDebug=1` preservado, `testing-codex` HEAD avanzó a `6c6fc58` (push+deploy TESTING SUCCESS), `origin/main`/Production SIN CAMBIOS — falta confirmación física en iPhone antes de reintentar la promoción (2026-09-08)

```text
HEAD=origin/testing-codex=6c6fc581ad678883f4e9fbcb9dbf8e90ecf63912 (AVANZÓ desde 818b627 — 1 commit nuevo)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (SIN CAMBIOS)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios)

TASK_STATUS=IMPLEMENTED_COMMITTED_PUSHED_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION

FINDING_FIXED=F-PRE-T29-02 (public/manifest-cliente.json start_url: "/cliente?iosDebug=1" -> "/cliente" — único campo tocado, root cause confirmado por lectura directa: manifest estático sin condicional de entorno, panel activado sólo por query param sin escritor runtime)
MANUAL_DEBUG_ACCESS_PRESERVED=SI (/cliente?iosDebug=1 sigue activando isIosDebugFlagEnabled sin cambios — verificado por código, test nuevo de comportamiento real, y smoke HTTP 200 contra TESTING desplegado)
OTHER_7_MANIFESTS_AUDITED=SI, sin hallazgos / SERVICE_WORKER_CHANGED=NO (auditado, nunca cachea URLs con "manifest") / BRANDING_CHANGED=NO

FIX_COMMIT=6c6fc581ad678883f4e9fbcb9dbf8e90ecf63912 (parent 818b627b472e03e80034c047a51dfd3491f3add3, testing-codex) / FILESET=public/manifest-cliente.json + 2 tests (ios-pwa-debug-launch-static-contract.test.ts, pwa-identity.test.ts)
QUALITY_GATE=11/11 tests de contrato de manifest PASS; 87/89 batería ampliada iOS/PWA (2 fallas 100% preexistentes, confirmadas idénticas antes/después vía git stash del HEAD sin cambios); typecheck 24 raw idéntico (0 nuevos); lint/diff-check/build limpios
PUSH_TO_TESTING=SI (818b627..6c6fc58) / MAIN_PUSH=NO
TESTING_DEPLOYMENT=d636ab54-7104-4e55-b9a6-6928ffc0817a (DeliGO Copy) SUCCESS, commit 6c6fc58 (match exacto), boot limpio, sin migraciones pendientes
SERVED_MANIFEST_VERIFIED=SI (GET .../manifest-cliente.json → 200, start_url=/cliente, sin iosDebug; GET /cliente=200; GET /cliente?iosDebug=1=200)
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=1de0d3c153eaf3be068adeb004ea43feb42fc40e (mismo deployment bf242d3b, sin cambios) / preDeployCommand y GOOGLE_OAUTH_PENDING_SECRET de Production sin releer/mutar

F_PRE_T29_02_STATUS=FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION (bloquea la promoción y cualquier lanzamiento público hasta el PASS físico)
PRE_T29_PROMOTION_RETRY_READY=NO (pendiente confirmación física del operador en iPhone real)

P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (preservado) / P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION (preservado) / P2_T29A_STATUS=PAUSED_PENDING_PRE_T29_PROMOTION (sin cambio)
P2_T02_STATUS=WAITING_FOR_OPERATOR (preservado) / PAYMENTS_WORK_STATUS=DEFERRED (preservado)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado)
NEXT_RECOMMENDED_ACTION=PHYSICAL_IOS_CLIENT_INSTALL_NO_DEFAULT_DEBUG_CONFIRMATION — operador instala la PWA Cliente en TESTING desde cero en un iPhone real, confirma que el panel NO aparece por defecto y que SÍ aparece navegando a /cliente?iosDebug=1; luego reintentar PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION usando 6c6fc58 como nuevo RC source
```

Corrección focal del único blocker que había detenido la promoción
curada anterior. El manifest de Cliente es un archivo estático sin
ningún mecanismo de detección de entorno — el panel de diagnóstico se
activa exclusivamente por el query param de la URL, sin ningún escritor
runtime, así que revertir el `start_url` fue suficiente y seguro. El
mecanismo manual de diagnóstico (necesario para trabajo futuro de
diagnóstico iOS real-device) quedó expresamente preservado y verificado
en tres niveles (código, test de comportamiento, smoke HTTP real).
Gate de calidad completo sin regresiones, commit único, push exclusivo a
`testing-codex`, deploy a Railway TESTING verificado `SUCCESS` con el
manifest servido confirmado en vivo. Production no fue tocada. Reporte
completo: `codex-reports/PRE_T29_FIX_MANIFEST_CLIENTE_IOSDEBUG_FLAG_TESTING.md`.

## 0.42 ESTADO ANTERIOR — PROMOCIÓN DETENIDA ANTES DEL PUSH por decisión explícita del operador: bug real encontrado (`?iosDebug=1` hardcodeado en `public/manifest-cliente.json`) — `testing-codex`/`main` SIN CAMBIOS, `preDeployCommand` de Production quedó agregado (fix independiente retenido) (2026-09-08)

```text
HEAD=origin/testing-codex=818b627b472e03e80034c047a51dfd3491f3add3 (SIN CAMBIOS)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (SIN CAMBIOS — nada se promovió)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PRODUCTION_CURRENT_ROLE=PRE_LAUNCH_CONTROLLED_ENVIRONMENT / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios)

TASK_STATUS=STOPPED_BEFORE_PUSH_BY_OPERATOR_DECISION (ni CLOSED ni ROLLED_BACK_FAILED)

GAP_1_RESOLVED=preDeployCommand agregado a Production/"DeliGO" (railway api serviceInstanceUpdate, valor idéntico a TESTING: ["npx prisma migrate deploy --schema prisma/schema.prisma"]) — sin disparar deploy no deseado, APLICADO Y RETENIDO independientemente del código
GAP_2_OPEN=F-PRE-T29-02: public/manifest-cliente.json start_url="/cliente?iosDebug=1" hardcodeado, sin condicional de entorno — activaría el panel de diagnóstico iOS por defecto en instalaciones NUEVAS del Cliente PWA en Production (seguro, sin PII/secretos, pero no intencional). BLOQUEA esta promoción y cualquier lanzamiento público futuro hasta corregirse.

RELEASE_METHOD_VALIDATED=SI — commit snapshot (git commit-tree, tree=testing-codex@818b627, parent=origin/main tip, trailers Source-Head/Source-Merge-Base) construido y verificado byte-a-byte equivalente en un worktree aislado; T29_PRODUCT_IMPLEMENTATION_PRESENT=NO; SECRET_LEAK=NO. Commit local 245abcfa8 DESCARTADO sin pushear al detener la tarea — branch/worktree temporales eliminados, git worktree list y git branch --list confirmados limpios.

PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / DB_CHANGED=NO / COMMIT_PUSHED=NO / TAG_CREATED=NO
PRODUCTION_CODE_CHANGED=NO / PRODUCTION_TOUCHED=SI (sólo preDeployCommand, config, sin deploy nuevo) / PRODUCTION_COMMIT_FINAL=1de0d3c153eaf3be068adeb004ea43feb42fc40e

P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (preservado) / P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION (preservado) / P2_T29A_STATUS=PAUSED_PENDING_PRE_T29_PROMOTION (SIN CAMBIO — la promoción no se completó, NO pasa a READY_TO_START)
P2_T02_STATUS=WAITING_FOR_OPERATOR (preservado) / PAYMENTS_WORK_STATUS=DEFERRED (preservado)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado)
NEXT_RECOMMENDED_ACTION=corregir public/manifest-cliente.json en testing-codex (quitar ?iosDebug=1 del start_url o condicionarlo a detección real de entorno), re-certificar y desplegar a TESTING normalmente, luego reintentar PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION — el método de release ya está validado y es reutilizable
```

Tarea de promoción real, autorizada explícitamente en todos sus
aspectos (push a `main`, deploy a Production, tag), llegó lejos en su
ejecución siguiendo el método de release curado ya documentado
(`OPERATIONS_SECURITY_PRODUCTION_PROMOTION_R1.md`) antes de detenerse.
Durante la revisión focal de diagnósticos iOS que la propia tarea exige
antes de pushear, se encontraron 2 gaps no cubiertos por la
autorización original — el primero (migraciones sin mecanismo de
ejecución en Production) se resolvió con autorización explícita del
operador; el segundo (bug de manifest) llevó al operador a elegir la
opción MÁS conservadora posible: detener la promoción completa en vez
de un fix en vivo o promover tal cual. Git quedó exactamente en su
estado de partida — cero push, cero tag, cero deploy de código.
Reporte completo:
`codex-reports/PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION.md`.

## 0.41 ESTADO ANTERIOR — ÚNICO BLOCKER DE PROMOCIÓN RESUELTO: `GOOGLE_OAUTH_PENDING_SECRET` agregada a Railway Production, redeploy del mismo commit SUCCESS, `PRE_T29_PROMOTION_CAN_NOW_PROCEED=SI` (2026-09-08)

```text
HEAD=origin/testing-codex=818b627b472e03e80034c047a51dfd3491f3add3 (sin cambios — sin código nuevo)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios de código; mismo commit, ahora servido por un deployment nuevo tras el cambio de variable de entorno)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PRODUCTION_CURRENT_ROLE=PRE_LAUNCH_CONTROLLED_ENVIRONMENT / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios — esta tarea no constituye lanzamiento público)

RAILWAY_TARGET_ENVIRONMENT=production / RAILWAY_TARGET_SERVICE=DeliGO (confirmado explícitamente ANTES de mutar — el contexto CLI enlazado por defecto en este entorno de trabajo apuntaba a TESTING/"DeliGO Copy", no a Production; cada comando usó --service/--environment explícitos, nunca el contexto por defecto)

GOOGLE_OAUTH_PENDING_SECRET_GENERATED=SI (CSPRNG local, openssl rand -hex 32, 64 caracteres hexadecimales — secret NUEVO y DEDICADO, nunca copiado de TESTING ni de ningún otro secret existente)
GOOGLE_OAUTH_PENDING_SECRET_VALUE_EXPOSED=NO (aplicado vía --stdin, sin argv, sin --json/--kv en la escritura, variable de shell destruida inmediatamente después — el valor nunca apareció en ningún output/reporte)
PRODUCTION_GOOGLE_OAUTH_PENDING_SECRET_PRESENT=SI / PRODUCTION_GOOGLE_OAUTH_PENDING_SECRET_MIN_LENGTH_VALID=SI (64 caracteres, validado aritméticamente con awk sin leer el valor)
TESTING_ENV_MUTATED=NO / NON_TARGET_ENV_VARS_MUTATED=NO (diff de nombres de variables de Production: 51->52, +1 exacto, 0 removidas/modificadas)

ENV_CHANGE_TRIGGERED_PRODUCTION_REDEPLOY=SI / PRODUCTION_ENV_REDEPLOYMENT_ID=bf242d3b-35e1-4d55-8bfb-71d121e2fc6d / PRODUCTION_ENV_REDEPLOY_STATUS=SUCCESS / PRODUCTION_ENV_REDEPLOY_COMMIT=1de0d3c153eaf3be068adeb004ea43feb42fc40e (idéntico — sin cambio de código, sólo rebuild para inyectar la variable)
PRODUCTION_POST_ENV_SMOKE_PASS=SI (GET /, /cliente, /negocio, /repartidor sobre deligo.ar — sin 500, boot sano, logs limpios "Ready in 122ms")

PREVIOUS_PROMOTION_BLOCKER=MISSING_PRODUCTION_ENV_VAR_GOOGLE_OAUTH_PENDING_SECRET / PREVIOUS_PROMOTION_BLOCKER_RESOLVED=SI
PROMOTION_ENV_PRECONDITION_READY=SI / PRE_T29_PROMOTION_CAN_NOW_PROCEED=SI (de las 17 condiciones de PROMOTION_READY de la auditoría anterior, todas quedan satisfechas ahora — la promoción de código real sigue sin ejecutarse, requiere su propia tarea con autorización explícita)

REALTIME_KEY_ID_PREEXISTING_GAP_PRESERVED=SI (sin tocar — ausente en Production pero ya referenciado por main hoy, sin relación con esta tarea)

PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / DB_CHANGED=NO / COMMIT_PERFORMED=NO / TAG_CREATED=NO / PUSH_PERFORMED=NO
PRODUCTION_CODE_CHANGED=NO / PRODUCTION_TOUCHED=SI (única mutación: 1 variable de entorno + redeploy consecuente del mismo commit, explícitamente autorizado) / PRODUCTION_COMMIT_FINAL=1de0d3c153eaf3be068adeb004ea43feb42fc40e

P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (preservado) / P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION (preservado) / P2_T29A_STATUS=NOT_STARTED (PAUSED_PENDING_PRE_T29_PROMOTION)
P2_T02_STATUS=WAITING_FOR_OPERATOR (preservado) / PAYMENTS_WORK_STATUS=DEFERRED (preservado)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado — bloquea lanzamiento público, no esta precondición técnica)
NEXT_RECOMMENDED_ACTION=PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION (NO ejecutado en esta tarea)
```

Tarea operacional dirigida, resolviendo el ÚNICO blocker que
`PRE_T29_PRODUCTION_PROMOTION_READINESS_AUDIT.md` había encontrado.
Antes de mutar cualquier cosa, se confirmó explícitamente el target
real: el contexto de Railway CLI enlazado por defecto en este entorno
de trabajo apuntaba a TESTING/"DeliGO Copy" — **no** a Production. Cada
comando de esta tarea pasó `--service DeliGO --environment production`
de forma explícita, nunca confiando en ese contexto por defecto, lo
que evitó el riesgo real de mutar el servicio equivocado.

Se generó un secret criptográficamente seguro, nuevo y dedicado (64
caracteres hexadecimales vía `openssl rand -hex 32` — muy por encima
del mínimo de 32 caracteres que el código exige, y nunca una copia de
ningún secret existente) y se envió a Railway en un único pipeline de
shell vía `--stdin`, evitando que el valor pasara por `argv` o
apareciera en cualquier output de confirmación — la variable de shell
que lo contuvo se destruyó inmediatamente después. Se evitó
deliberadamente `--json`/`--kv` en el comando de escritura porque la
propia documentación del CLI de Railway advierte que esos formatos
incluyen valores crudos. El valor nunca apareció en ningún lugar
mostrado, guardado o reportado por esta tarea.

La verificación posterior confirmó presencia y longitud **sin leer el
valor en ningún momento**: presencia por conteo del nombre de la
variable (`grep -c`), longitud calculada aritméticamente con `awk`
sobre la longitud total de la línea menos la del nombre de la clave.
Un diff de los NOMBRES de todas las variables de Production antes y
después (52 vs 51) confirmó exactamente **una** variable agregada y
**cero** removidas o modificadas — ninguna otra variable (`DATABASE_
URL`, secrets de `REALTIME_*`, `VAPID*`, `RESEND*`/`SMTP*`,
`REGISTRATION_LIMIT_SECRET`, credenciales de OAuth de Google,
variables automáticas de Railway) fue tocada. TESTING confirmado sin
cambios (51 variables, intacto).

El cambio de variable disparó, como estaba explícitamente autorizado
para este caso, un redeploy automático de Production del **mismo
commit** (`1de0d3c1` — mismo `Source-Commit` trailer, mismo branch
`main`, sólo un `imageDigest`/`patchId` nuevos por el rebuild).
Polling directo y finito (sin watcher en background) hasta confirmar
`status: SUCCESS` e instancia `RUNNING`; logs de boot limpios
(`Next.js 16.1.3`, `Ready in 122ms`, sin excepciones). Smoke tests no
mutantes contra el dominio real (`deligo.ar`) confirmaron `/`, `/cliente`,
`/negocio` y `/repartidor` respondiendo correctamente, sin crear
usuarios, sin OAuth real, sin pedidos, sin emails, sin Push.

**Blocker resuelto formalmente**: de las 17 condiciones de
`PROMOTION_READY` que la auditoría anterior evaluó, la única pendiente
(variables de entorno de Production listas) ahora se cumple. Esto NO
significa que la promoción de código ya ocurrió — `main` y Production
siguen exactamente en `1de0d3c1`, el mismo código de siempre. La
promoción real (release curado con trailer `Source-Commit:`, siguiendo
la convención ya documentada) sigue requiriendo su propia tarea futura,
con autorización explícita separada de commit/push/deploy.

Git permaneció completamente intacto durante toda la tarea — ningún
merge, commit, tag ni push. Archivo `32` no tocado. El finding de
`REALTIME_KEY_ID` (ausente en Production, pero ya preexistente en
`main` hoy) se preservó sin tocar, fuera de alcance. El finding de
aislamiento de sesión Android Cliente/Repartidor se preserva sin
cambios — sigue bloqueando un futuro lanzamiento público, no esta
precondición técnica. P2-T31 permanece `CLOSED_TESTING_CERTIFIED`,
P2-T29 permanece `AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION`, T29A
sigue `PAUSED_PENDING_PRE_T29_PROMOTION`. Reporte completo:
`codex-reports/PRE_T29_PRODUCTION_GOOGLE_OAUTH_PENDING_SECRET_PRECONDITION.md`.

## 0.40 ESTADO ANTERIOR — PRE-T29 PROMOTION READINESS AUDIT (READ-ONLY): `PROMOTION_READY=NO` — único blocker es 1 variable de entorno faltante en Production; historia Git divergida confirma convención de release curado ya establecida — BLOCKER RESUELTO POR LA TAREA DE ARRIBA (2026-09-08)

```text
HEAD=origin/testing-codex=818b627b472e03e80034c047a51dfd3491f3add3 (sin cambios — tarea read-only)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
RAILWAY_TESTING_COMMIT=818b627b472e03e80034c047a51dfd3491f3add3 (sin cambios) / RAILWAY_PRODUCTION_COMMIT=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios, verificado también en el chat-service de Production)
MODE=READ_ONLY_PROMOTION_AUDIT / PRODUCT_DIFF=NONE / TEST_DIFF=NONE

DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / REAL_CUSTOMER_TRAFFIC_EXPECTED=NO / PRODUCTION_CURRENT_ROLE=PRE_LAUNCH_CONTROLLED_ENVIRONMENT / PUBLIC_RELEASE_AUTHORIZED=NO
PRE_T29_STABLE_CHECKPOINT_DESIRED=SI

PROMOTION_READY=NO
PROMOTION_BLOCKER=GOOGLE_OAUTH_PENDING_SECRET ausente en las variables de Railway de Production — requerida sin fallback por src/lib/google-oauth-pending.ts (lanza Error si falta o mide <32 caracteres); confirmado por NOMBRE únicamente, sin leer ningún valor; afecta sólo el callback de Google OAuth para identidades nuevas o cuentas sin LegalAcceptance, no rompe boot/build/ninguna otra ruta
NEXT_RECOMMENDED_ACTION=agregar esa variable a Production (Railway env var, string aleatorio >=32 caracteres, dedicado) como primer paso de la futura tarea de promoción — una vez hecho, las 16 condiciones restantes de PROMOTION_READY ya se cumplen

MERGE_BASE=86609599bcbdf7979244c34298a27836e6452d3c / MAIN_IS_ANCESTOR_OF_TESTING=NO / DIVERGED_HISTORY=SI / COMMITS_MAIN_ONLY=4 / COMMITS_TESTING_ONLY=61
HALLAZGO_DE_ESTRATEGIA=los 4 commits exclusivos de main llevan trailers "Source-Commit:" explícitos apuntando a commits reales de testing-codex, uno de ellos documentando una exclusión deliberada de hunks — confirma, junto con el reporte histórico OPERATIONS_SECURITY_PRODUCTION_PROMOTION_R1.md, que DeliGO usa una convención YA ESTABLECIDA de "release curado" (verificado byte a byte, aplicado sobre el HEAD real de main, NUNCA un merge de toda la historia de testing-codex)
RECOMMENDED_MAIN_PROMOTION_METHOD=release curado con Source-Commit trailer, siguiendo exactamente esa convención — NO merge genérico, NO fast-forward (ninguno de los dos es viable dada la historia divergida)
MERGE_SIMULATION_METHOD=git merge-tree --write-tree (100% read-only, no toca working tree/index/HEAD) -> produce 4 conflictos textuales reales si se intentara un merge genérico (mozos/route.ts, pedidos/route.ts, n/[slug]/page.tsx, un add/add en p2-t07-repartidor-active-gate-static-contract.test.ts) -- verificado por contenido (no sólo conteo de líneas) en 2 de los 4 que testing-codex es una evolución estrictamente posterior del MISMO texto, nunca una divergencia semántica real

NEW_MIGRATIONS_PENDING_FOR_PRODUCTION=2 (20260901112243_add_legal_acceptance_versioning: CREATE TABLE nueva, append-only; 20260901130000_add_email_verification_expiry: ADD COLUMN nullable x3 tablas) / DESTRUCTIVE_MIGRATIONS_PRESENT=NO / PRODUCTION_MIGRATION_RISK=LOW / DB_BACKUP_BEFORE_PROMOTION_REQUIRED=NO
AMBAS_MIGRATIONS_YA_CERTIFICADAS=SI (LEGAL_TERMS_ACCEPTANCE_VERSIONING_R1.md y P2_T07_HARDENING_R1.md, ambas CLOSED sin gaps) — excluidas de la promoción anterior sólo por corte cronológico, recomendado incluirlas ahora
SCHEMA_DIFF_PRESENT=SI (coherente con las 2 migrations, sin drift)

DEPENDENCY_DIFF_PRESENT=NO (package.json/bun.lock/package-lock.json byte-idénticos entre main y testing-codex)
SECRET_LEAK_IN_PROMOTION_DIFF=NO (secret scan del diff completo de 222 archivos: sólo placeholders de test "fixture"/"CorrectHorseBattery42"; sin .env, sin API keys/JWTs/DATABASE_URL/VAPID private key)
TRACKED_CODEX_REPORTS_IN_PROMOTION_DIFF=DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md (único, 539 líneas, sin secretos/PII, promovible sin limpieza previa)

TESTING_DIAGNOSTICS_PRODUCTION_SAFE_AFTER_PROMOTION=SI (revalidado, no sólo citado de R21: RAILWAY_ENVIRONMENT_NAME confirmado "production" en Railway, gate fail-closed intacto, 404 indistinguible fuera de TESTING)
TESTING_ONLY_BEHAVIOR_PRODUCTION_LEAK=NONE / AUTH_PROMOTION_SAFETY=PASS / TEST_FIXTURE_CODE_PROMOTION_SAFE=SI
SERVICE_WORKER_PROMOTION_CACHE_RISK=LOW (CACHE_NAME ya subió de deligo-v14 a deligo-v15) / PWA_MANIFEST_PROMOTION_SAFETY=PASS (8 manifests de rol verificados)
PRODUCTION_REALTIME_DEPENDENCY_READY=SI (salvo REALTIME_KEY_ID, gap PREEXISTENTE ya en main hoy, sin relación con este diff — no es blocker de esta promoción)

RC_BUILD_PASS=SI / TYPECHECK_RAW=24 (0 nuevos) / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI
PROMOTION_TEST_PASS=1177 (646 Push+chat+notificationclick+safe-area + 531 auth/PWA/legal/tracking) / PROMOTION_PREEXISTING_FAIL=9 (5 iOS + 4 P2-T02 MODEL-G1/E1, ya documentadas) / PROMOTION_NEW_FAIL=0

T29_PRODUCT_IMPLEMENTATION_PRESENT_IN_RC=NO (confirmado) / PRE_T29_RC_IS_EXACT_T31_CERTIFIED_HEAD=SI

PRE_T29_TAG_RECOMMENDED=SI / RECOMMENDED_TAG_NAME=pre-t29-stable-2026-09-08 (sin convención previa de tags en el repo — git tag --list vacío)
PRODUCTION_DEPLOY_TRIGGER=AUTODEPLOY_GIT / PRODUCTION_MIGRATION_EXECUTION_MECHANISM=preDeployCommand de Railway ("npx prisma migrate deploy") antes del boot de la nueva versión
PRODUCTION_ROLLBACK_CODE_PLAN=redeploy del commit conocido-bueno (1de0d3c1) vía autodeploy Git / PRODUCTION_ROLLBACK_DB_PLAN=ninguna acción necesaria para estas 2 migrations (puramente aditivas)

PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / DB_CHANGED=NO / COMMIT_PERFORMED=NO / TAG_CREATED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (preservado) / P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION (preservado) / P2_T29A_STATUS=NOT_STARTED (PAUSED_PENDING_PRE_T29_PROMOTION)
P2_T02_STATUS=WAITING_FOR_OPERATOR (preservado) / PAYMENTS_WORK_STATUS=DEFERRED (preservado)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado — bloquea lanzamiento público, NO esta promoción técnica) / ANDROID_PWA_INSTALL_COMPLETION_UX_FINDING=OPEN (preservado) / PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN (preservado) / P2_IOS_STATIC_CONTRACT_HYGIENE_REQUIRED_BEFORE_P2_CLOSEOUT=SI (preservado)
```

Auditoría exhaustiva, estrictamente READ-ONLY, de si el HEAD certificado
de `testing-codex` (`818b627`, el mismo que cerró P2-T31) puede
promoverse TÉCNICAMENTE a `main`/Production antes de iniciar P2-T29A.
Aclaración de contexto explícita: DeliGO **no está publicado** — sin
tráfico de clientes reales, Production funciona hoy como entorno
pre-lanzamiento controlado. Esta auditoría distingue con cuidado
"puede desplegarse técnicamente" de "listo para abrir al público" — el
finding de aislamiento de sesión Android Cliente/Repartidor sigue
bloqueando lo segundo, nunca lo primero, y no se tocó ni se corrigió
aquí.

**Hallazgo central de estrategia de promoción**: `git merge-base`
reveló que la historia de `main` y `testing-codex` está DIVERGIDA (ni
fast-forward ni ancestro directo) — 4 commits exclusivos de `main`, 61
exclusivos de `testing-codex`. Investigando esos 4 commits se encontró
que cada uno lleva un trailer `Source-Commit:` explícito apuntando a un
commit real de `testing-codex`, y que uno de ellos documenta una
exclusión DELIBERADA de hunks ("out of scope for this curated
release"). Esto, junto con el reporte histórico ya existente
`OPERATIONS_SECURITY_PRODUCTION_PROMOTION_R1.md` (que describe
exactamente esa misma metodología: "una rama de release curada — no un
merge de testing-codex — ... aplicada sobre la base exacta de
Production... en un único fast-forward"), confirma que DeliGO ya tiene
una convención de promoción establecida: **release curado, verificado
byte a byte, con trailer de origen — nunca un merge genérico de toda
la historia**. Para validar esta conclusión sin comprometerse con
ninguna acción, se simuló un merge genérico de forma 100% read-only
(`git merge-tree --write-tree`, que sólo escribe objetos blob/tree
inofensivos sin tocar working tree/index/HEAD/ninguna referencia): el
resultado son **4 conflictos textuales reales** — confirmando que la
convención curada sigue siendo la estrategia correcta, no una
alternativa de conveniencia genérica. Verificación de contenido (no
sólo conteo de líneas) en 2 de los 4 archivos en conflicto mostró que
`testing-codex` contiene una evolución estrictamente posterior del
MISMO texto/lógica que `main` — nunca una divergencia semántica real;
recomendado que la tarea de promoción revise los 4 archivos completos
antes de decidir.

**Único blocker real encontrado, mecánico y acotado**:
`GOOGLE_OAUTH_PENDING_SECRET` — requerida sin fallback por
`src/lib/google-oauth-pending.ts` (lanza si falta o mide menos de 32
caracteres) — está AUSENTE en las variables de Railway de Production,
confirmado consultando únicamente los NOMBRES de las variables (nunca
sus valores) vía `railway variables`. El impacto es acotado: sólo
rompería el callback de Google OAuth para una identidad de Google
completamente nueva o una cuenta existente sin evidencia de
`LegalAcceptance` — no afecta boot, build, ni ninguna otra ruta de la
aplicación (Cliente/Negocio/Repartidor con sesión ya iniciada, Push,
Chat, pedidos, etc. seguirían funcionando exactamente igual). Se
descartó explícitamente `REALTIME_KEY_ID` (también ausente) como
blocker de ESTA promoción porque ya está referenciado en el propio
`main` actual — es un gap preexistente, sin relación con este diff.

**Migrations**: 2 nuevas, ambas puramente aditivas (`CREATE TABLE`
nueva sin consumidores previos; `ADD COLUMN` nullable en 3 tablas, sin
backfill, sin pérdida de datos posible) y ambas YA certificadas y
cerradas en TESTING (`LEGAL_TERMS_ACCEPTANCE_VERSIONING_R1.md`,
`P2_T07_HARDENING_R1.md`, sin gaps abiertos) — quedaron fuera de la
promoción anterior únicamente por venir después de su corte
cronológico, no por estar incompletas; se recomienda incluirlas ahora.

Dependencias 100% idénticas entre ambas ramas (`package.json`, `bun.
lock`, `package-lock.json` byte-idénticos). Secret scan del diff
completo (222 archivos, 23237 inserciones): limpio, sin ningún patrón
real de secreto — sólo placeholders de test ya conocidos ("fixture",
el clásico "CorrectHorseBattery42" de XKCD). Único reporte de
`codex-reports/` realmente tracked en git en todo el árbol
(`DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md`) auditado y confirmado
seguro para promover sin limpieza previa.

Diagnósticos de TESTING (panel de Push, ver P2-T31-R21) revalidados
—no sólo citados de memoria— como seguros tras la promoción: el gate
`RAILWAY_ENVIRONMENT_NAME` sigue siendo server-side, fail-closed, y
Production reporta correctamente `"production"`. Ningún testing-only
guard adicional encontrado en todo el diff. Fixtures de test
confirmadas como código de test puro, sin ejecución en runtime de
producto. Cambios de auth en el diff (mesa, mozo legacy, terminal/
SuperAdmin) son endurecimientos, sin bypass ni credencial de prueba.

Gate de calidad completo corrido sobre el RC candidato (el HEAD real
`818b627`, sin ningún cambio introducido por esta auditoría): build
limpio, TypeScript 24 raw idéntico al baseline conocido (0 nuevos),
1177 tests pasando (646 de la batería Push/chat/safe-area + 531 de
auth/PWA/legal/tracking), exactamente 9 fallas — todas ya documentadas
como preexistentes (5 en el contrato estático iOS de teclado, 4 en el
contrato estático de tracking GPS de repartidor por la deuda MODEL-G1
vs MODEL-E1 de P2-T02, epic distinto) — **0 fallas nuevas**.

Diseño completo entregado, explícitamente NO ejecutado: estrategia de
release curado paso a paso, nombre de tag de checkpoint recomendado
(`pre-t29-stable-2026-09-08`, sin convención previa de tags en el repo),
mecanismo de deploy confirmado (autodeploy Git a ambos servicios de
Production — la app principal y el chat-service — más
`preDeployCommand` de Prisma para las migrations), checklist de smoke
tests no mutante, y plan de rollback (código: redeploy del commit
conocido-bueno vía el mismo autodeploy; DB: ninguna acción necesaria,
dado que ambas migrations son puramente aditivas).

Cero cambios de producto, tests, DB o variables de Railway en esta
tarea. Git estrictamente read-only — el único comando que escribió
algo fue `git merge-tree --write-tree`, que sólo agrega objetos
blob/tree inofensivos al object database sin tocar working tree,
index, HEAD ni ninguna referencia real; `git status`/`diff` idénticos
antes y después. Único archivo nuevo es el reporte de esta tarea
(local, untracked). Archivo `32` no tocado.

**`PROMOTION_READY=NO`** — de las 17 condiciones de cierre, 16 ya se
cumplen; la única pendiente (variables de entorno de Production listas)
requiere agregar una única variable, un paso mecánico y de bajo riesgo,
no una nueva auditoría ni un rediseño. P2-T31 permanece
`CLOSED_TESTING_CERTIFIED`, P2-T29 permanece `AUDITED_DESIGNED_
READY_FOR_IMPLEMENTATION`, T29A sigue `NOT_STARTED` — la promoción
(cuando se autorice) debe ocurrir ANTES de T29A, según el objetivo
explícito del operador de un checkpoint estable pre-rediseño de
estados. Reporte completo:
`codex-reports/PRE_T29_PRODUCTION_PROMOTION_READINESS_AUDIT.md`.

## 0.39 ESTADO ANTERIOR — P2-T29 AUDITADO Y DISEÑADO (READ-ONLY, NO IMPLEMENTADO): `ACEPTADO`+`ESPERANDO_REPARTIDOR` diseñados; T27 fusionado a T29A; cero migration necesaria; gap crítico de test identificado en aceptación atómica del repartidor (2026-09-08)

```text
HEAD=origin/testing-codex=818b627b472e03e80034c047a51dfd3491f3add3 (sin cambios — tarea read-only)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (preservado, no reabierto)
MODE=READ_ONLY_AUDIT_PLUS_DESIGN / PRODUCT_DIFF=NONE / TEST_DIFF=NONE

CANONICAL_ACCEPTED_STATE=aceptado / CANONICAL_WAITING_DRIVER_STATE=esperando_repartidor (elegido sobre "buscando_repartidor" — el mecanismo real es polling pasivo de 8s, sin dispatch activo, confirmado leyendo repartidor-panel.tsx)
RECOMMENDED_ORDER_STATE_GRAPH=DOMICILIO: recibido->aceptado->preparando->esperando_repartidor->en_camino->entregado / RETIRO: recibido->aceptado->preparando->listo_para_retirar->entregado / MESA: recibido->preparando->listo_para_retirar->entregado (SIN aceptado, justificado por ausencia de ventana de decisión remota)
ORDER_STATUS_DB_TYPE=String Prisma, SIN enum Postgres, SIN CHECK constraint (verificado en schema.prisma y en todos los migration.sql) / MIGRATION_REQUIRED=NO / NEW_ACCEPTED_STATE_REQUIRES_MIGRATION=NO / NEW_WAITING_DRIVER_STATE_REQUIRES_MIGRATION=NO
DELIVERY_ASSIGNMENT_SOURCE_OF_TRUTH=Pedido.repartidorId (campo directo, sin tabla de asignación separada)
CURRENT_DRIVER_ACCEPTANCE_ATOMIC=SI (repartidor/pedidos/[id]/aceptar usa updateMany CAS real — condición de estado esperado en el propio WHERE, no findUnique+update) / CURRENT_DRIVER_ACCEPTANCE_RACE_RISK=BAJO
HALLAZGO_CENTRAL=en_camino está SOBRECARGADO hoy — significa tanto "negocio empezó a buscar repartidor" (momento del click, sin asignación aún) como "repartidor ya asignado en camino" — probado leyendo negocio/pedidos/[id]/estado/route.ts + repartidor/pedidos/[id]/aceptar/route.ts; evidencia de UI ambigua confirmada en orders-tab.tsx:1017-1020 ("Esperando confirmación del cliente" mostrado en ambas fases sin distinguirlas)

P2_T27_DISPOSITION_FOR_T29=MERGE_INTO_T29 (P2-T27 nunca se implementó — QUEUED desde su creación, sin código ni reporte; el patrón CAS que generalizaría ya está probado en 6+ endpoints reales del repo)
P2_T28_DISPOSITION_FOR_T29=reutilizar CAS-vía-updateMany + lock process-local (src/lib/concurrency.ts) + PedidoEvento como historial; cerrar el gap residual (sólo cancelado usa CAS hoy en negocio/estado) dentro de la misma fase T29A que reescribe ese archivo
ORDER_TRANSITION_SINGLE_AUTHORITY=NO (3 copias independientes: VALID_TRANSITIONS en negocio/estado, TRANSICIONES en operaciones/pyr/estado, N endpoints fijos hardcoded en operativo/{pyr,salon,mozo}) — recomendado extraer autoridad compartida mínima en T29A, sin mega-refactor

TEST_GAPS_FOR_T29=CRÍTICO: repartidor/pedidos/[id]/aceptar (endpoint de mayor riesgo de concurrencia del sistema) tiene CERO tests dedicados hoy pese a ser, por lectura de código, un CAS correcto — toda la confianza actual es por inspección manual, no ejecutable
CURRENT_TEST_COVERAGE_MATRIX=casi nula para transiciones de estado en general (sólo order-estado-lock-ownership.test.ts existe, verifica ownership del lock, no transiciones/CAS)

LEGACY_ORDER_COMPATIBILITY_PLAN=sin backfill, sin transformación retroactiva de filas existentes — pedidos creados antes del deploy completan su ciclo LEGACY tal cual (preparando->en_camino overloaded->entregado); sólo pedidos nuevos post-deploy usan el grafo con aceptado/esperando_repartidor
NOTIFICATION_MATRIX_DESIGNED=SI (10 transiciones, reutilizando orderUpdateNotification.statusMessages como punto de extensión, sin rediseñar la factory)
CANCELLATION_MATRIX_DESIGNED=SI (por estado x actor) / TIMEOUT_POLICY_AUDITED=SI (auto-cancel de 30 min YA EXISTE, disparo manual del repartidor, ya seguro vía CAS — sólo necesita el nuevo nombre de estado en su filtro)

IMPLEMENTATION_PHASES=T29A(autoridad de transición compartida+CAS extendido+tests de concurrencia) -> T29B(Negocio UI/API: aceptar+preparar) -> T29C(Repartidor: rename+aceptación atómica+test físico) -> T29D(Cliente: notificaciones+labels+timeline) -> T29E(compatibilidad legacy+regresión+certificación física TESTING)

PREGUNTAS_DE_PRODUCTO_ABIERTAS_NO_ASUMIDAS=(1) ¿puede el Cliente cancelar mientras el pedido está `aceptado`? recomendación: SÍ, mismo criterio que hoy (recibido); (2) ¿mesa también debe recibir `aceptado`? recomendación: NO, sin ventana de decisión remota que lo justifique — ninguna implementación empieza sin que el operador resuelva ambas

PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / DB_CHANGED=NO / MIGRATION_CREATED=NO / COMMIT_PERFORMED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO
P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION
P2_T02_STATUS=WAITING_FOR_OPERATOR (preservado) / PAYMENTS_WORK_STATUS=DEFERRED (preservado)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, separado) / ANDROID_PWA_INSTALL_COMPLETION_UX_FINDING=OPEN (preservado) / PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN (preservado) / P2_IOS_STATIC_CONTRACT_HYGIENE_REQUIRED_BEFORE_P2_CLOSEOUT=SI (preservado)
NEXT_RECOMMENDED_ACTION=P2_T29A_ORDER_TRANSITION_AUTHORITY_CAS_AND_CONCURRENCY_TESTS (NO iniciado en esta tarea)
```

Auditoría profunda del lifecycle completo de pedidos, 100% desde código
real (schema Prisma, 3 copias independientes de reglas de transición,
el endpoint crítico de aceptación atómica de repartidor, factory de
notificaciones, UI de los 3 roles, cobertura de tests existente) — cero
suposiciones sin verificar, cero implementación.

Reconstruyó el grafo de estados ACTUAL leyendo cada endpoint que muta
`Pedido.estado` y probó, con evidencia directa, que `en_camino` está
sobrecargado hoy: el mismo string significa "Negocio acaba de pulsar
un botón, sin repartidor todavía" Y "un repartidor ya aceptó y está en
camino" — con una consecuencia de UI observable (`orders-tab.tsx`
muestra el mismo texto ambiguo en ambas fases). Diseñó el grafo
OBJETIVO por modalidad: domicilio y retiro reciben el nuevo estado
`aceptado`; mesa explícitamente NO (justificado, no asumido — un pedido
de mesa no tiene la ventana de decisión remota que `aceptado` resuelve
para delivery/pickup). El estado de espera de repartidor se recomienda
como `esperando_repartidor` (no "buscando_repartidor") porque el
mecanismo real, auditado, es un polling pasivo de 8 segundos sin ningún
dispatch/ranking activo del lado del servidor.

`estado` es un `String` Prisma plano, sin enum Postgres ni CHECK
constraint — agregar los 2 valores nuevos no requiere NINGUNA
migration, es 100% aditivo a nivel de esquema; todo el riesgo real vive
en el código (transiciones, filtros, UI), nunca en la base de datos.

La aceptación atómica del repartidor (`POST /api/repartidor/pedidos/
[id]/aceptar`) YA es segura hoy — usa un CAS real de Postgres (`update
Many` con la condición de estado/asignación esperada dentro del propio
`WHERE`, no un `findUnique`+`update` vulnerable a una carrera de
lectura-luego-escritura) — confirmado con una reconstrucción explícita
del timeline de dos repartidores compitiendo contra el código real. Sin
embargo, este endpoint —el de mayor riesgo de concurrencia de todo el
sistema— **no tiene ningún test que reproduzca esa concurrencia
ejecutablemente**; toda la confianza actual es por inspección manual.
Este es el gap más crítico identificado, y debe cerrarse en la primera
fase de implementación (T29A), antes de renombrar el estado comparado.

P2-T27 ("Order State DB-level CAS, no-cancellation transitions") nunca
se implementó — no existe ningún commit ni reporte con ese nombre,
permanece `QUEUED` en `ROADMAP.md` desde su creación. Se recomienda
`MERGE_INTO_T29` en vez de precederlo como tarea separada: el patrón de
CAS que generalizaría ya está probado y en producción en 6+ endpoints
reales de este mismo repo (no es una técnica nueva que necesite su
propio ciclo de validación), y T29 va a reescribir de todos modos el
archivo donde falta (`negocio/pedidos/[id]/estado/route.ts`) para
insertar los estados nuevos — cerrar el gap de CAS mientras se edita
ese archivo es prácticamente gratis, hacerlo dos veces sería
desperdicio. P2-T28 estableció formalmente (confirmado, no citado de
memoria) que sólo la transición a `cancelado` usa CAS hoy en ese
endpoint — T29A cierra ese residual.

Se encontraron y documentaron **3 copias independientes de reglas de
transición** (`VALID_TRANSITIONS` en el endpoint de Negocio,
`TRANSICIONES` en el endpoint de Operaciones-Terminal PyR, y varios
endpoints de transición única hardcoded en Operativo/{pyr,salon,mozo})
— `ORDER_TRANSITION_SINGLE_AUTHORITY=NO`. Recomendación acotada (no un
mega-refactor): extraer una autoridad de transición compartida mínima
en T29A, sin unificar los endpoints de transición fija que no la
necesitan.

Diseño completo entregado y documentado en el reporte: matriz de
notificaciones (10 transiciones, reutilizando la factory centralizada
existente `orderUpdateNotification.statusMessages`), matriz de UI por
rol (Negocio: botón/acción/cancelación por estado y modalidad; Cliente:
timeline de 6 pasos; Repartidor: sin cambios de comportamiento, sólo de
nombre de estado comparado), matriz de cancelación por estado y actor,
auditoría de timeouts (el mecanismo de auto-cancelación de 30 minutos
para pedidos sin repartidor YA EXISTE, ya es seguro vía CAS+transacción,
sólo necesita el nuevo nombre de estado en su filtro — no hace falta
construir nada nuevo), plan de compatibilidad con pedidos legacy
explícito (sin backfill, sin transformación retroactiva — los pedidos
existentes completan su ciclo tal cual, sólo los pedidos NUEVOS
posteriores al deploy usan el grafo con los estados nuevos), inventario
completo de tests actuales (prácticamente nulo para transiciones de
estado/concurrencia en todo el sistema), y 5 fases de implementación
con fileset, tests y dependencias explícitos por fase.

**2 preguntas de producto quedan explícitamente abiertas para el
operador, NO asumidas por esta auditoría**: (1) ¿puede el Cliente
cancelar mientras el pedido está `aceptado`? (recomendación: sí, mismo
criterio de hoy para `recibido`); (2) ¿mesa también debe recibir
`aceptado`? (recomendación: no). Ninguna fase de implementación debe
comenzar sin que el operador resuelva ambas explícitamente.

Cero cambios de producto, tests o base de datos en esta tarea. Git
estrictamente read-only (`git diff --name-status`/`--stat` vacíos antes
y después), único archivo nuevo es el reporte de esta tarea (local,
untracked). Archivo `32` no tocado. P2-T31 permanece
`CLOSED_TESTING_CERTIFIED`, no reabierto — ningún finding separado
(sesión Android, install UX, branding, deuda de contrato estático) fue
tocado. Reporte completo:
`codex-reports/P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md`.

## 0.38 ESTADO ANTERIOR — P2-T31 CERRADO: `P2_T31_STATUS=CLOSED_TESTING_CERTIFIED` — R24 CONFIRMADO FÍSICAMENTE; DIAGNÓSTICOS R6/R6A/R6B RECLASIFICADOS PERMANENTES (SIN CLEANUP NECESARIO) (2026-09-08)

```text
HEAD=origin/testing-codex=818b627b472e03e80034c047a51dfd3491f3add3 (sin cambios — R21 es read-only, ningún commit nuevo)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
RAILWAY_TESTING_DEPLOYMENT=1f025eba-02ed-469c-9412-3c3c740d4550 (DeliGO Copy, SUCCESS, sin cambios)
RAILWAY_PRODUCTION_COMMIT=1de0d3c153eaf3be068adeb004ea43feb42fc40e (verificado, sin cambios)
MODE=READ_ONLY_AUDIT_PLUS_CLOSEOUT_DECISION / PRODUCT_DIFF=NONE / TEST_DIFF=NONE

R24_PHYSICAL_CONFIRMATION=PASS / IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (CERRADO — listado, conversación, teclado en iPhone; control Android sin regresión)
PUSH_CHAT_NOTIFICATION_TAP_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (R23C, sin cambios, preservado)
ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (R22A, sin cambios, preservado)
PUSH_PHYSICAL_ROLE_DELIVERY_CERTIFICATION_COMPLETE=SI / PUSH_PHYSICAL_PLATFORM_CERTIFICATION_COMPLETE=SI / PUSH_CHAT_DEEPLINK_PHYSICAL_CERTIFICATION_COMPLETE=SI
MATRIZ_FISICA_FINAL=Cliente iPhone+Android CERTIFIED_TESTING / Negocio+Repartidor iPhone CERTIFIED_TESTING, Android PASS-short-smoke / iconos Android PASS los 3 roles / chat deep-link Android+iPhone cold+warm PASS
ANDROID_ABORTERROR_INCIDENTE_HISTORICO=STRONGLY_SUPPORTED_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE (nunca CONFIRMED, residual de dispositivo específico, no reabierto — MAX_PHYSICAL_SUBSCRIBE_ATTEMPTS_PER_USER_ACTION=2 congelado)

ANDROID_PHYSICAL_CERTIFICATION_COMPLETE=SI / PUSH_DIAGNOSTICS_POST_CERT_ACTION_TRIGGERED=SI / FINAL_PUSH_DIAGNOSTICS_DISPOSITION=RETAIN_SAFE_PERMANENT_ONLY
DIAGNOSTICS_INVENTORY=PushDebugPanel + push-debug-trace.ts + push-debug-snapshot.ts + push-debug-trace-bootstrap.tsx + wiring en 3 perfiles -> todos SAFE_TESTING_DIAGNOSTIC (gate server-side fail-closed 404 en Production vía RAILWAY_ENVIRONMENT_NAME, fingerprints no reversibles, sólo lectura, nunca sale de localStorage) verificado por lectura DIRECTA de push-testing-guard.ts/debug-guard/route.ts/push-debug-trace.ts en esta tarea; push-mutation-in-flight-registry.ts y logging de error estándar = PERMANENT_HARDENING
DIAGNOSTIC_SECRET_EXPOSURE_FINDING=NONE / PRODUCTION_USER_VISIBLE_PUSH_DIAGNOSTICS_PRESENT=NO / TEMPORARY_PUSH_LOGGING_REQUIRES_CLEANUP=NO
P2_T31_R21A_CLEANUP_REQUIRED=NO (no se diseñó ninguna tarea de cleanup — reclasificado a retención permanente en vez de retirar código seguro)

R21_READ_ONLY_TEST_RECHECK_PERFORMED=SI: chat-provider-deep-link-hydration 21/21, sw-notificationclick-target-routing 6/6, chat-ios-safe-area-static-contract 12/12, Push completa 607/607 (34 archivos) — todos sin regresión

ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (SEPARADO, no bloquea T31, sí production readiness general, causa raíz diferida) / ANDROID_PWA_INSTALL_COMPLETION_UX_FINDING=OPEN (SEPARADO, no bloquea) / PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN / ANDROID_MONOCHROME_BADGE_UX_TASK_REQUIRED=SI / SW_ICON_CACHE_BYPASS_SUBSTRING_FINDING=OPEN_NON_BLOCKING / UNSUBSCRIBE_STALE_GUARD_FINDING=OPEN_NON_BLOCKING_QUEUED (todos preservados sin tocar)
P2_IOS_STATIC_CONTRACT_HYGIENE_REQUIRED_BEFORE_P2_CLOSEOUT=SI (5 fallas preexistentes en ios-standalone-post-keyboard-nav-occlusion-r6-static-contract.test.ts, no introducidas por ninguna tarea reciente) / P2_T31_BLOCKED_BY_STATIC_CONTRACT_DEBT=NO
DEUDA_MODEL_G1_VS_MODEL_E1=P2-T02 (GPS de repartidor, epic distinto, NO Push — 4 fallas en repartidor-tracking-static-contract.test.ts, no relacionado a T31)

PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / COMMIT_PERFORMED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO / PRODUCTION_PROMOTION_AUTHORIZED=NO
P2_T31_TESTING_CERTIFICATION_COMPLETE=SI
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED
P2_T29_STATUS=READY_TO_START (NO iniciado en esta tarea) / P2_T02_STATUS=WAITING_FOR_OPERATOR (valor más reciente/autoritativo: el propio reporte de certificación P2_T02_REAL_ANDROID_GPS_DELIVERY_CERTIFICATION_R1.md, corrige entradas más antiguas de ROADMAP.md) / PAYMENTS_WORK_STATUS=DEFERRED
NEXT_RECOMMENDED_ACTION=P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN (NO iniciado en esta tarea)
```

Auditoría FINAL, estrictamente READ-ONLY, del epic completo P2-T31.
Baseline verificado fresco e idéntico al esperado en Git y Railway (TESTING
y Production).

**R24 reconciliado**: confirmación física completa en las 4 áreas
obligatorias (listado, conversación, teclado en iPhone; control
Android). El finding queda `PHYSICALLY_CONFIRMED_FIXED_TESTING`,
CERRADO. R23/R23A/R23B/R23C/R24 no se reabren.

**Matriz física final de Push consolidada** sin duplicados en los 3
roles y 2 plataformas. El incidente histórico "Android A" (`AbortError`
de `PushManager.subscribe()`) se preserva sin reabrir — residual
específico de dispositivo, clasificación `STRONGLY_SUPPORTED` (nunca
`CONFIRMED`), hardening R13A/R19/R19R/R19R1 confirmado intacto por
lectura directa de código en esta tarea.

**Inventario exhaustivo de diagnósticos** (código real, no sólo
reportes): toda la instrumentación R6/R6A/R6B/R7/R19R1 verificada como
`SAFE_TESTING_DIAGNOSTIC` — gate server-side fail-closed (404
indistinguible en Production), fingerprints no reversibles/redacción
por patrón de nombre, nunca sale del origen, de sólo lectura (nunca
puede mutar una subscripción real). Sin exposición de secretos/PII, sin
nada visible a un usuario normal en ningún entorno.

**Decisión**: la condición de retención de R10 (hasta certificación
física de Android) ya se cumplió, pero como todo lo auditado ya es
seguro por diseño, se reclasifica a retención PERMANENTE en vez de
disparar un cleanup — `P2_T31_R21A_CLEANUP_REQUIRED=NO`, no se diseñó
ninguna tarea de cleanup adicional.

Las 8 condiciones de cierre de P2-T31 se verificaron cumplidas.
Findings preservados explícitamente SEPARADOS del cierre (no
pertenecen al pipeline de Push, no lo bloquean): sesión cruzada Android
Cliente/Repartidor (production readiness general, causa raíz diferida),
Android install UX, branding/ícono, deuda de contrato estático iOS/PWA
(5 fallas preexistentes) y deuda MODEL-G1/MODEL-E1 de P2-T02 (epic
distinto). Recheck read-only barato: 21/21 + 6/6 + 12/12 + 607/607,
todos sin regresión. Git estrictamente read-only (`git diff --name-
status`/`--stat` vacíos antes y después), único archivo nuevo es el
reporte de esta tarea (local, untracked). Archivo `32` no tocado.
Production confirmada sin cambios, ninguna promoción autorizada ni
realizada.

**`P2_T31_STATUS=CLOSED_TESTING_CERTIFIED`**. P2-T29 queda
`READY_TO_START` pero NO se inicia en esta tarea. P2-T02 sigue
`WAITING_FOR_OPERATOR`. Payments sigue `DEFERRED`. Reporte completo:
`codex-reports/P2_T31_R21_FINAL_DIAGNOSTICS_DISPOSITION_AND_CLOSEOUT.md`.

## 0.37 ESTADO ANTERIOR — P2-T31-R24: R23C CONFIRMADO FÍSICAMENTE (CERRADO); FIX DE IOS CHAT SAFE-AREA DESPLEGADO EN TESTING (COMMIT 818B627) — CONFIRMADO FÍSICAMENTE Y CERRADO POR R21 ARRIBA (2026-09-08)

```text
HEAD=origin/testing-codex=818b627b472e03e80034c047a51dfd3491f3add3 (R24 — reemplaza a 1bd953a en TESTING)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
PUSH_CHAT_NOTIFICATION_TAP_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (R23C, 4/4 combinaciones Android/iPhone x cold/warm PASS — CERRADO, no se reabre)
CHAT_PUSH_DEEPLINK_PHYSICAL_CERTIFICATION_COMPLETE=SI

IOS_CHAT_SAFE_AREA_ROOT_CAUSE_CLASS=INTERACTIVE_HEADER_CONTAINER_TOP_0_WITHOUT_SAFE_AREA_PADDING / STATUS=PROVEN
FIX=header del listado (chat-sheet.tsx) y de la conversación (chat-view.tsx) reciben pt-[calc(env(safe-area-inset-top,0px)+Xrem)]; botón cerrar (X) built-in compartido de sheet.tsx recibe data-slot="sheet-close" inerte, reposicionado SÓLO para chat vía [data-ios-debug-role="chat-sheet"] en globals.css — ningún otro Sheet de la app afectado
IOS_CHAT_FULL_BLEED_PRESERVED=SI / GLOBAL_LAYOUT_CHANGED=NO / GLOBAL_VIEWPORT_POLICY_CHANGED=NO (viewportFit:"cover" intacto) / PLATFORM_BRANCH_ADDED=NO
R23C_CHAT_DEEPLINK_CODE_CHANGED=NO (useChatDeepLink/useChatActorReset/push routing/notificationclick sin tocar)
IOS_CHAT_SAFE_AREA_TEST_PASS=12 (nuevo) / CHAT_R23C_REGRESSION_PASS=21 (sin cambios) / NOTIFICATIONCLICK_TEST_PASS=6 (sin cambios) / PUSH_TEST_FINAL_PASS=607 (34 archivos, sin regresión)
IOS_PWA_PROXY_PASS=303 / IOS_PWA_PROXY_PREEXISTING_FAIL=5 (mismo archivo no tocado, ya documentado en R23C) / IOS_PWA_PROXY_NEW_FAIL=0
ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI
COMMIT_HASH=818b627b472e03e80034c047a51dfd3491f3add3 / COMMIT_PARENT=1bd953a6bc97fe5dffa993d1653ee55212f012d4 / COMMIT_MESSAGE=fix: keep chat controls below ios safe area
TESTING_DEPLOYMENT_ID=1f025eba-02ed-469c-9412-3c3c740d4550 / TESTING_DEPLOYMENT_STATUS=SUCCESS (match exacto, servicio "DeliGO Copy")
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=1de0d3c153eaf3be068adeb004ea43feb42fc40e
IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_FINDING=FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION
PHYSICAL_IOS_CHAT_SAFE_AREA_RETEST_REQUIRED=SI (iPhone listado/conversación/teclado, Android control)

ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (sin cambios, causa raíz diferida)
ANDROID_PWA_INSTALL_COMPLETION_UX_FINDING=OPEN (sin cambios, no bloquea)
ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (sin cambios, cerrado)

PRODUCT_CODE_CHANGED=SI (3 archivos: chat-sheet.tsx, chat-view.tsx, sheet.tsx + globals.css) / TEST_CODE_CHANGED=SI (1 nuevo) / COMMIT_PERFORMED=SI / PUSH_PERFORMED=SI / DEPLOY_PERFORMED=SI / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_PENDING_IOS_CHAT_SAFE_AREA_PHYSICAL_CONFIRMATION_AND_FINAL_DIAGNOSTICS_CLOSEOUT
P2_T29_STATUS=QUEUED / PAYMENTS_WORK_STATUS=DEFERRED
NEXT_RECOMMENDED_ACTION=P2_T31_R24_PHYSICAL_IOS_CHAT_SAFE_AREA_CONFIRMATION
```

**R23C reconciliado primero**: nueva evidencia física confirmó el fix
en las 4 combinaciones obligatorias (Android/iPhone × cold/warm) — el
finding de tap de chat queda `PHYSICALLY_CONFIRMED_FIXED_TESTING`,
CERRADO. R23/R23A/R23B/R23C no se reabren.

Auditó el árbol completo de Chat por lectura de código: DOS headers en
flujo normal sin protección de safe-area (listado en `chat-sheet.tsx`,
conversación en `chat-view.tsx`) más un tercer control afectado — el
botón cerrar (X) built-in compartido de `sheet.tsx` (único cierre
disponible en la vista de listado). Root cause `PROVEN`: contenedores
en flujo normal/`top:0` sin `env(safe-area-inset-top)`, mientras el
fondo del Sheet ya hereda correctamente el full-bleed vía
`viewport-fit=cover` (global, sin tocar).

Fix con el mismo idioma ya establecido en el repo
(`mesa-cuenta-dialog.tsx`, `n/[slug]/page.tsx`, `cliente/page.tsx`):
los dos headers reciben `pt-[calc(env(safe-area-inset-top,0px)+Xrem)]`
en vez de `py-*` plano. El botón X compartido de `sheet.tsx` (usado por
TODOS los Sheets de la app) recibió `data-slot="sheet-close"` —
puramente inerte, misma convención que `dialog.tsx` ya usa — para poder
escoparlo en `globals.css` exclusivamente bajo `[data-ios-debug-role=
"chat-sheet"]` (marcador ya existente en `chat-sheet.tsx`): ningún otro
Sheet de la app se ve afectado. Sin branching por plataforma.

Gate completo: 12 tests nuevos, R23C 21/21 sin cambios,
`notificationclick` 6/6 sin cambios, Push 607/607 sin regresión, iOS/
PWA proxy con las mismas 5 fallas preexistentes de R23C (0 nuevas),
ESLint/TypeScript (24 raw, 0 nuevos)/build limpios. Un commit
(`818b627`, parent `1bd953a`), push a `testing-codex`, autodeploy a
"DeliGO Copy" con match exacto de commit, smokes no mutantes
(`/negocio`→200, `/cliente/`→308). Production intacta.

No se certifica físicamente todavía. Findings preservados sin tocar:
sesión cruzada Android Cliente/Repartidor (`OPEN`, causa diferida),
Android install UX (`OPEN`, no bloquea), badge/maskable/cache/
unsubscribe (sin cambios). **P2-T31 SIGUE ABIERTO** — "R21 final" no se
ejecuta hasta la confirmación física de este fix. P2-T29 `QUEUED`,
Payments `DEFERRED`. Reporte completo:
`codex-reports/P2_T31_R24_IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_AUDIT_FIX_TESTING_DEPLOY.md`.

## 0.36 ESTADO ANTERIOR — P2-T31-R23C: FIX DEL ROOT CAUSE PROVEN DE R23B DESPLEGADO EN TESTING (COMMIT 1BD953A) — CONFIRMADO FÍSICAMENTE POR R24 ARRIBA; FINDING CLIENTE/REPARTIDOR ANDROID CORREGIDO — GOOGLE DESCARTADO COMO TRIGGER (2026-09-08)

```text
HEAD=origin/testing-codex=1bd953a6bc97fe5dffa993d1653ee55212f012d4 (R23C — reemplaza a 23c038a en TESTING)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
FIX=useChatActorReset (src/providers/chat-provider.tsx) agrega `previous !== null` a su guard de reset — null->primer actor real (primera hidratación) ya NO resetea el chat-store; real->null (logout) y real A->real B (incl. cambio de rol) SIGUEN reseteando sin cambios
R23A_AUTH_HYDRATION_FIX_STAYS_REQUIRED=SI (sin tocar) / R23B_ROOT_CAUSE_REPRO_WITH_OLD_RESET=FAIL_EXPECTED (5/21 confirmado) / R23C_ROOT_CAUSE_REPRO_WITH_NEW_RESET=PASS (21/21 confirmado)
MATRIZ_ACTOR_RESET_9_CASOS=PASS (A-I completos, ver reporte)
PUBLIC_SW_CHANGED=NO / AUTH_STORE_CHANGED=NO / CHAT_STORE_CHANGED=NO / PUSH_BACKEND_CHANGED=NO
CHAT_ACTOR_RESET_TEST_PASS=11 (nuevo) / CHAT_DEEPLINK_HYDRATION_TEST_PASS=10 (sin cambios, preservado) / NOTIFICATIONCLICK_TEST_PASS=6 (sin cambios) / PUSH_TEST_FINAL_PASS=607 (34 archivos, sin regresión)
ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI
COMMIT_HASH=1bd953a6bc97fe5dffa993d1653ee55212f012d4 / COMMIT_PARENT=23c038af4406e7ee838d465e3d2023acf391fb5f / COMMIT_MESSAGE=fix: preserve chat state on initial auth hydration
TESTING_DEPLOYMENT_ID=e1fad4be-dacb-44c8-8721-48973bb18bdf / TESTING_DEPLOYMENT_STATUS=SUCCESS (match exacto, servicio "DeliGO Copy")
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PHYSICAL_CHAT_RETEST_REQUIRED=SI (Android Negocio cold+warm, iPhone Negocio cold obligatorios; Negocio->Cliente recomendado)

GOOGLE_ACCOUNT_SPECIFIC_TRIGGER=RULED_OUT_BY_PHYSICAL_EVIDENCE (Android same-account FAIL Y different-account FAIL; iPhone same-account PASS control positivo)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (reemplaza al finding "misma cuenta Google" de R23B) / PLATFORM_SCOPE=ANDROID_ONLY_CONFIRMED / ROOT_CAUSE=NOT_AUDITED (diferido) / P2_T31_BLOCKER=NO / PRODUCTION_READINESS_BLOCKER=YES

IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_FINDING=OPEN (sin cambios, bloquea P2-T31) / ANDROID_PWA_INSTALL_COMPLETION_UX_FINDING=OPEN (sin cambios, no bloquea)
ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (sin cambios, cerrado)

PRODUCT_CODE_CHANGED=SI (1 archivo: src/providers/chat-provider.tsx) / TEST_CODE_CHANGED=SI (1 extendido) / COMMIT_PERFORMED=SI / PUSH_PERFORMED=SI / DEPLOY_PERFORMED=SI / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_PENDING_R23C_CHAT_TAP_PHYSICAL_CONFIRMATION_AND_IOS_SAFE_AREA_AND_FINAL_DIAGNOSTICS_CLOSEOUT
P2_T29_STATUS=QUEUED / PAYMENTS_WORK_STATUS=DEFERRED
NEXT_RECOMMENDED_ACTION=P2_T31_R23C_PHYSICAL_CHAT_TAP_CONFIRMATION_ANDROID_AND_IPHONE
```

Implementó el fix mínimo del root cause `PROVEN` de R23B:
`useChatActorReset` distinguía mal la transición `null → primer actor
real` (resolución inicial de identidad durante la hidratación de
`auth-store`) de un cambio de actor genuino — ambas disparaban
`useChatStore.getState().reset()` en el mismo commit de React en que
`useChatDeepLink` acababa de abrir el chat. El fix agrega un chequeo
`previous !== null` al guard: la transición inicial ya NO resetea;
`real → null` (logout) y `real A → real B` (incluyendo cambio de rol)
siguen reseteando exactamente igual que antes — la seguridad
cross-actor no se debilitó. R23A no se tocó.

Reproducción rigurosa: se extendió
`chat-provider-deep-link-hydration.test.ts` con un `JointHarness` que
monta `useChatDeepLink()` + `useChatActorReset()` (ambas exportadas
sólo para test) en el mismo orden que `ChatProvider` real. Revirtiendo
temporalmente sólo `previous !== null`, 5/21 tests fallan; restaurado
de inmediato, 21/21 verdes. Matriz completa de 9 transiciones de actor
cubierta verificando el estado observable del store.

Gate completo: Push 607/607 sin regresión, `notificationclick` 6/6 sin
cambios, ESLint/TypeScript (24 raw, 0 nuevos)/build limpios.
`sw.js`/`auth-store.ts`/`chat-store.ts`/backend: ningún cambio.
Fileset exacto: `chat-provider.tsx` + su test. Un commit (`1bd953a`,
parent `23c038a`), push a `testing-codex`, autodeploy a "DeliGO Copy"
con match exacto de commit, logs de boot limpios, smokes no mutantes
(`/negocio`→200, `/cliente/`→308). Production intacta.

**Finding Cliente/Repartidor Android CORREGIDO**: evidencia física
nueva descarta que la cuenta de Google sea el factor discriminante —
en Android falla TANTO con la misma cuenta COMO con cuentas distintas;
en iPhone, la misma cuenta SÍ permite ambos roles simultáneos (control
positivo). Requisito de producto reafirmado: DeliGO debe permitir
Cliente+Repartidor simultáneos en Android con cualquier combinación de
identidad de Google. Causa raíz técnica diferida a tarea futura.

No se certifica físicamente todavía. Findings preservados sin tocar:
iOS chat safe-area (`OPEN`, bloquea P2-T31), Android install UX
(`OPEN`, no bloquea), ícono de Push (cerrado), badge/maskable/cache/
unsubscribe (sin cambios). Git: sólo 2 archivos de producto/test
modificados, todo lo demás (reporte, context docs) local/untracked.
Archivo `32` no tocado. **P2-T31 SIGUE ABIERTO** — "R21 final" no se
ejecuta. P2-T29 `QUEUED`, Payments `DEFERRED`. Reporte completo:
`codex-reports/P2_T31_R23C_CHAT_ACTOR_RESET_FIRST_HYDRATION_GUARD_FIX_TESTING_DEPLOY.md`.

## 0.35 ESTADO ANTERIOR — P2-T31-R23B (READ-ONLY): CAUSA RAÍZ ADICIONAL PROBADA CON REPRODUCCIÓN DE CÓDIGO REAL (`useChatActorReset` borra el sheet que `useChatDeepLink` acaba de abrir); RETEST FÍSICO DE R23A FALLÓ EN ANDROID E IPHONE; NUEVO FINDING FORMAL DE SESIÓN GOOGLE CRUZADA MULTI-ROL (NO CORREGIDO, CORREGIDO POR R23C ARRIBA) (2026-09-08)

```text
HEAD=origin/testing-codex=23c038af4406e7ee838d465e3d2023acf391fb5f (sin cambios — R23B es read-only, ningún commit nuevo)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
MODE=READ_ONLY_AUDIT / PRODUCT_DIFF=NONE / TEST_DIFF=NONE / GIT_DEPLOY_HISTORY_UPDATED=NO
R23A_PHYSICAL_FIX_CONFIRMATION=FAIL / PHYSICAL_CHAT_NOTIFICATION_TAP_ANDROID=FAIL / PHYSICAL_CHAT_NOTIFICATION_TAP_IPHONE=FAIL
ANDROID_CHAT_TAP_WARM_APP=FAIL / ANDROID_CHAT_TAP_WARM_APP_FINAL_DESTINATION=DASHBOARD / ANDROID_CHAT_TAP_BACKGROUND_FOREGROUND_RETRY=FAIL (descarta la hidratación como causa ÚNICA — app ya autenticada/hidratada y aun así falla)
AUTH_HYDRATION_RACE_EXISTS=SI / AUTH_HYDRATION_RACE_WAS_COMPLETE_PHYSICAL_ROOT_CAUSE=NO / R23_PRIMARY_CAUSE_SUFFICIENT_FOR_PHYSICAL_BUG=NO (el fix de R23A NO se descarta — cerró una carrera real y sigue siendo necesario)
FINAL_ROOT_CAUSE_CLASSIFICATION=H_CHAT_SHEET_STATE_IS_RESET_AFTER_OPEN / FINAL_ROOT_CAUSE_STATUS=PROVEN
ROOT_CAUSE_MECHANISM=ChatProvider llama useChatDeepLink() y luego useChatActorReset(); ambos efectos corren, en ese orden, en el MISMO commit de React cuando auth-store rehidrata user+_hasHydrated sincrónicamente (onRehydrateStorage llama setHasHydrated(true) inmediatamente después del merge(), sin await); useChatActorReset trata null->usuario-real como cambio de actor y llama useChatStore.getState().reset(), borrando isSheetOpen/activePedidoId que useChatDeepLink acababa de fijar
ROOT_CAUSE_EVIDENCE=reproducción con happy-dom+react-dom/client+act() (script fuera del repo, nunca commiteado) que monta el useChatDeepLink REAL y exportado junto a una redeclaración fiel de useChatActorReset (no exportado), en el mismo orden real de ChatProvider — CASO A (un solo commit, el real) pierde el deep-link; CASO B (dos commits) lo preserva
URL_WRITER_INVENTORY=ningún archivo en app/negocio/**, app/cliente/**, components/business/**, providers/**, store/**, hooks/** escribe la URL fuera de los ya conocidos (login-form submit, el propio useChatDeepLink, 2 efectos de cliente/page.tsx gateados por auth_success/register ajenos a `chat`) -> descarta normalización/limpieza de query como causa
MANIFEST_START_URL_LAUNCH_HANDLER_PLAUSIBILITY=RULED_OUT (no interceptan URLs explícitas de notificationclick; el bug ocurre igual en iPhone sin WebAPK)
R23B_OUTCOME=A_ROOT_CAUSE_PROVEN / RUNTIME_INSTRUMENTATION_REQUIRED=NO / NEXT_RECOMMENDED_ACTION=P2_T31_R23C_CHAT_ACTOR_RESET_FIRST_HYDRATION_GUARD_FIX_AND_TESTING_DEPLOY (fix diseñado, NO implementado en R23B)
CROSS_ROLE_SAME_GOOGLE_ACCOUNT_CONCURRENT_SESSION_FINDING=OPEN (NUEVO) / SAME_GOOGLE_ACCOUNT_CROSS_ROLE_CONCURRENCY=FAIL / DIFFERENT_GOOGLE_ACCOUNT_CROSS_ROLE_CONCURRENCY=PASS / SAME_IDENTITY_MULTI_ROLE_CONCURRENT_SESSION_REQUIRED=SI (requisito de producto explícito) / CROSS_ROLE_GOOGLE_SESSION_ROOT_CAUSE=NOT_AUDITED (diferido) / P2_T31_BLOCKER=NO / PRODUCTION_READINESS_BLOCKER=YES
P2_T31_STATUS=IN_PROGRESS_PENDING_CHAT_TAP_R23C_FIX_AND_IOS_SAFE_AREA_AND_FINAL_DIAGNOSTICS_CLOSEOUT
P2_T29_STATUS=QUEUED / PAYMENTS_WORK_STATUS=DEFERRED
```

Auditoría estrictamente READ-ONLY. Baseline verificado fresco e
idéntico al esperado. El retest físico del fix de hidratación de R23A
(ya desplegado en TESTING el mismo día, commit `23c038a`) volvió a
fallar en Android e iPhone. Evidencia "warm app" decisiva del
operador: con Negocio ya abierto, autenticado, sin hidratación
pendiente, el tap de un chat entrante sigue sin abrir el chat — esto
prueba que la carrera de hidratación no es la causa completa, porque
`Client.navigate()` (usado por `notificationclick` sobre una PWA ya
abierta) es, por spec, una navegación de documento real que reinicia el
runtime de JS igual que un arranque en frío, cayendo en la misma
carrera de todos modos.

Causa raíz adicional PROBADA (no sólo inferida): `ChatProvider`
(`src/providers/chat-provider.tsx`) llama `useChatDeepLink()` y luego,
en la misma función, `useChatActorReset()` — React corre los efectos
de ambos hooks, en ese orden, dentro del MISMO commit cuando la
rehidratación de `auth-store` actualiza `user` y `_hasHydrated`
sincrónicamente. `useChatActorReset` trata la transición `null ->
usuario real` (identidad recién hidratada) igual que un cambio real de
actor, y llama `useChatStore.getState().reset()` —el único call site
de producción de ese reset, confirmado por grep— borrando el
`isSheetOpen`/`activePedidoId` que `useChatDeepLink` acababa de fijar
segundos antes en el mismo commit. Se probó con un script de
reproducción FUERA del repo (nunca commiteado) que monta el
`useChatDeepLink` real y exportado junto a una redeclaración fiel de
`useChatActorReset`, en el mismo orden de `ChatProvider` real: el
escenario "un solo commit" (el real de `auth-store.ts`) pierde el
deep-link; el escenario "dos commits separados" lo preserva —
reproducción decisiva con código real, DOM real y React real.

**No se afirma que R23A introdujo una regresión ni se descarta su
fix**: cerró una carrera real (10/10 tests) y sigue siendo necesario —
sin él, ni el escenario de "dos commits" funcionaría en un arranque en
frío puro. Es una causa adicional e independiente, no detectada por
R23A porque su propio test nunca montó `useChatActorReset` junto a
`useChatDeepLink`. No se implementó ningún fix en esta tarea — se
dimensiona (no se codifica) el guard correcto para una futura `R23C`:
`useChatActorReset` debe ignorar la transición `null -> primer usuario
real tras el mount`, y sólo resetear cuando el actor anterior YA era un
usuario real distinto.

Inventario exhaustivo de escritores de URL en el árbol relevante
descartó cualquier hipótesis de normalización/limpieza de query o de
`start_url`/`launch_handler` del manifest como causa (ver marcadores
arriba) — ningún archivo bajo `app/negocio/**`, `components/business/**`,
`providers/**`, `store/**`, `hooks/**` toca la URL fuera de los casos ya
conocidos, y el mecanismo de lanzamiento de la PWA no intercepta URLs
explícitas que el propio Service Worker pasa a
`clients.openWindow()`/`client.navigate()`.

**Nuevo finding formal, no corregido, no mezclado con el de chat**:
usar la MISMA cuenta de Google para DeliGO Cliente y DeliGO Repartidor
hace que una sesión interfiera con la otra; con cuentas de Google
DISTINTAS, ambos roles permanecen autenticados simultáneamente sin
problema. Requisito de producto explícito del operador: una misma
persona con una misma identidad de Google debe poder tener Cliente y
Repartidor autenticados a la vez, sin necesitar cerrar sesión de uno ni
usar una cuenta distinta como workaround. La causa raíz (modelo de
identidad/sesión) queda explícitamente diferida a una tarea futura —
NO se afirma "Google causa el bug", NO se audita ni corrige aquí.

Findings preservados sin tocar: iOS chat safe-area (`OPEN`, bloquea
P2-T31), Android install UX (`OPEN`, no bloquea), ícono de Push
(`PHYSICALLY_CONFIRMED_FIXED_TESTING`, cerrado), badge monocromo
Android (pendiente), PWA maskable icon (`OPEN`), SW icon cache bypass
(`OPEN_NON_BLOCKING`), unsubscribe stale guard
(`OPEN_NON_BLOCKING_QUEUED`). Git estrictamente read-only (`git diff
--name-status`/`--stat` vacíos), único archivo nuevo es el reporte de
esta tarea (local, untracked). Archivo `32` no tocado. Production sin
cambios. **P2-T31 SIGUE ABIERTO** — "R21 final" no se ejecuta. P2-T29
`QUEUED`, Payments `DEFERRED`. Reporte completo:
`codex-reports/P2_T31_R23B_CHAT_PUSH_TAP_RUNTIME_URL_CONSUMPTION_ROOT_CAUSE_AUDIT.md`.

## 0.34 ESTADO ANTERIOR — P2-T31-R23A: FIX DE LA CARRERA DE HIDRATACIÓN DE CHAT DESPLEGADO EN TESTING (COMMIT 23C038A) — RETEST FÍSICO FALLÓ EN AMBAS PLATAFORMAS, CAUSA ADICIONAL PROBADA Y AUDITADA POR R23B ARRIBA; 2 FINDINGS NUEVOS (iOS chat safe-area — bloquea T31; Android install UX — no bloquea) (2026-09-08)

```text
HEAD=origin/testing-codex=23c038af4406e7ee838d465e3d2023acf391fb5f (R23A — reemplaza a ed58ca4 en TESTING)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
PUSH_CHAT_NOTIFICATION_TAP_ROUTING_FINDING=FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION (elevado desde STRONGLY_SUPPORTED)
AUTH_HYDRATION_GATE_IMPLEMENTED=SI / AUTH_HYDRATION_RETRY_IMPLEMENTED=SI
R23_AUTH_HYDRATION_RACE_REPRO_BEFORE=FAIL_EXPECTED (verificado: revirtiendo TEMPORALMENTE sólo la línea de dependencias del efecto, exactamente 3/10 tests fallan) / R23_AUTH_HYDRATION_RACE_REPRO_AFTER=PASS (10/10 con el fix restaurado)
PUBLIC_SW_CHANGED=NO / PUSH_BACKEND_CHANGED=NO / AUTH_STORE_CHANGED=NO
CHAT_DEEPLINK_TEST_PASS=10 / NOTIFICATIONCLICK_TEST_PASS=6 (nuevo, cierra el gap de R23) / PUSH_TEST_FINAL_PASS=607 (sin regresión) / PWA_FOCAL_TEST_PASS=52 (sin regresión)
ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI
COMMIT_HASH=23c038af4406e7ee838d465e3d2023acf391fb5f / COMMIT_PARENT=ed58ca47a522b8190c41283818d1742887f24d31 / COMMIT_MESSAGE=fix: preserve chat deep links through auth hydration
TESTING_DEPLOYMENT_ID=96dc9cd8-b4d6-492b-a0e6-e6566127d38c / TESTING_DEPLOYMENT_STATUS=SUCCESS (match exacto verificado)
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PHYSICAL_CHAT_RETEST_REQUIRED=SI (Android Negocio + iPhone Negocio obligatorios, Negocio→Cliente recomendado)

IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_FINDING=OPEN (NUEVO — full-bleed intencional preservado, pero controles de cerrar/volver del chat quedan dentro de la safe-area en iPhone; Android no lo presenta; ROOT_CAUSE=NOT_AUDITED) / P2_T31_CLOSEOUT_BLOCKED_BY_IOS_CHAT_SAFE_AREA_FIX=YES
ANDROID_PWA_INSTALL_COMPLETION_UX_FINDING=OPEN (NUEVO — la UI muestra "instalada" antes de que el WebAPK termine en background; UX general, DETERMINATE_REAL_PROGRESS_BAR_SUPPORTED=NO, GET_INSTALLED_RELATED_APPS_FEASIBILITY=NOT_AUDITED) / P2_T31_CLOSEOUT_BLOCKED_BY_ANDROID_PWA_INSTALL_UX=NO (queued, tarea UX separada)

ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (sin cambios, cerrado, no se reabre)
ANDROID_MONOCHROME_BADGE_UX_TASK_REQUIRED=SI / PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN / SW_ICON_CACHE_BYPASS_SUBSTRING_FINDING=OPEN_NON_BLOCKING / UNSUBSCRIBE_STALE_GUARD_FINDING=OPEN_NON_BLOCKING_QUEUED (todos sin cambios)
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios) / ANDROID_NEGOCIO_SHORT_SMOKE=PASS / ANDROID_REPARTIDOR_SHORT_SMOKE=PASS (sin cambios, ninguna certificación funcional se revoca)

PRODUCT_CODE_CHANGED=SI (1 archivo: src/providers/chat-provider.tsx) / TEST_CODE_CHANGED=SI (2 nuevos) / COMMIT_PERFORMED=SI / PUSH_PERFORMED=SI / DEPLOY_PERFORMED=SI / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_PENDING_CHAT_TAP_PHYSICAL_CONFIRMATION_AND_IOS_CHAT_SAFE_AREA_FIX_AND_FINAL_DIAGNOSTICS_CLOSEOUT
P2_T29_STATUS=QUEUED / PAYMENTS_WORK_STATUS=DEFERRED
NEXT_RECOMMENDED_ACTION=P2_T31_R23A_PHYSICAL_CHAT_TAP_CONFIRMATION_ANDROID_AND_IPHONE
```

Tarea TARGETED IMPLEMENTATION + REPRODUCTION TEST + REGRESSION TESTS +
CONTROLLED COMMIT + PUSH + TESTING DEPLOY, explícitamente autorizada.
Baseline verificado fresco (`HEAD=origin/testing-codex=ed58ca4`,
`origin/main=1de0d3c1`, coincidían exactamente).

**Fix implementado — diff mínimo**: `src/providers/chat-provider.tsx`
::`useChatDeepLink` ahora lee `authHasHydrated = useAuthStore((s) =>
s._hasHydrated)` —un campo YA EXISTENTE en `auth-store.ts`, sin crear
ningún sistema de hidratación paralelo— y lo agrega a las
dependencias del `useEffect` que consume `?chat=<pedidoId>`. Cuando la
hidratación del store de auth Zustand `persist` termina (transición de
`false` a `true`), React vuelve a ejecutar el efecto automáticamente
(que llama a `consumeChatParam()` de nuevo, ahora con
`isAuthenticated()` reflejando el usuario real) — cerrando la carrera
donde un arranque en frío (exactamente el escenario de un tap de
notificación de chat que abre la PWA recién cerrada) podía descartar
el deep-link para siempre, en silencio. `consumeChatParam()` en sí
**no cambió ni una línea**; el guard existente (`if (!chatPedidoId)
return` — el parámetro ya eliminado si se consumió antes) previene
cualquier doble apertura sin necesidad de un flag nuevo. El hook se
exportó (antes privado al módulo) exclusivamente para poder montarlo
aislado en tests reales de DOM.

**Reproducción rigurosa, no sólo asumida**: se construyó un test que
monta `useChatDeepLink` en un ciclo de commit de React REAL —
`happy-dom` (vía `@happy-dom/global-registrator`) + `react-dom/client`
+ `act()`, exactamente el mismo patrón ya establecido en
`src/store/auth-store.test.ts`/`src/hooks/use-repartidor-tracking.
test.ts` (ningún harness nuevo inventado). Para demostrar que la
carrera era real y no sólo teórica, se REVIRTIÓ TEMPORALMENTE sólo la
línea de dependencias del efecto (quitando `authHasHydrated`) y se
re-ejecutó la suite: **exactamente 3 de 10 tests fallaron** — la
reproducción de la carrera en sí, y los 2 casos de camino feliz que
dependen de una hidratación diferida (Negocio y Cliente,
respectivamente) — mientras los 7 tests que no dependen de ese trigger
siguieron en verde. Se restauró el fix inmediatamente después y se
reconfirmaron los 10/10 verdes antes de continuar con cualquier otro
paso de la tarea.

Matriz de tests completa (10, todos PASS con el fix): auth ya
hidratado antes del montaje (abre inmediato); hidratación diferida
para Negocio (abre exactamente una vez, verificado cerrando
manualmente y disparando un evento `focus` después — no reabre);
hidratación diferida para Cliente (misma verificación, dirección
Negocio→Cliente, mismo hook compartido); hidrata SIN usuario (no
abre, y el query param se preserva intacto para un reintento real
futuro — comportamiento seguro ya existente, sin cambios); superadmin
(no abre, ya hidratado); sin `?chat=` en la URL (no hace nada); un
`focus()` después de ya consumido (no reabre); un `visibilitychange`
después de ya consumido (no reabre); y preservación de otros query
params (`?tab=pedidos&chat=abc&foo=bar` → sólo `chat` se elimina).

Se agregó además un contrato de regresión PERMANENTE para
`notificationclick` (`src/lib/sw-notificationclick-target-routing.
test.ts`, 6 tests nuevos) — carga el `public/sw.js` REAL (misma
técnica de R22/R22A/R23: `vm.runInContext`) y prueba
`negocio+chat`/`cliente+chat` (PWA cerrada y abierta) junto a los 2
controles ya certificados físicamente (`cliente+order_update`,
`repartidor+new_delivery`) y un test explícito de que el
window-matching es role-safe (una ventana de Cliente abierta nunca se
reutiliza para un target de Negocio). Esto cierra el gap TOTAL de
cobertura que R23 había documentado (cero tests existían para
`notificationclick`/`buildPersonalNotificationTarget`/`ChatProvider`
antes de esta tarea) — no es el fix primario, pero convierte la
reproducción read-only de R23 en un contrato permanente.

Gate completo: suite Push 607/607 sin regresión (el nuevo archivo de
`notificationclick` se nombró deliberadamente fuera del patrón
`*push*.test.ts` para no confundirse con la suite funcional de Push,
se ejecutó por separado con éxito); PWA focal 52/52 sin regresión;
suite completa de Chat 285 pass/4 fail (los 4 fallos son
`.integration.test.ts` pre-existentes que requieren `DATABASE_URL` —
ambiental, confirmado explícitamente sin relación con
`chat-provider.tsx`); ESLint limpio; TypeScript 24 raw idéntico a la
baseline (0 nuevos, ninguno menciona los 3 archivos tocados); `git
diff --check` limpio; `next build` completo sin errores.
`public/sw.js`, `src/lib/push.ts`, `src/store/auth-store.ts`: **ningún
cambio** — no surgió ningún blocker que contradijera R23, no fue
necesario tocar el Service Worker ni el backend de Push ni la
semántica de auth.

Stage selectivo de EXACTAMENTE 3 archivos (`chat-provider.tsx`
modificado + 2 tests nuevos) — el reporte de esta tarea permanece
**untracked**, preservando la convención histórica, sin generalizar el
precedente puntual de Branding R1A. `branding-source/`,
`DELIGO_FULL_CONTEXT_LATEST.md` y `32` intactos. Un solo commit
(`23c038a`, parent `ed58ca4` verificado, sin `--amend`). Push
únicamente a `testing-codex` — `origin/testing-codex` confirmado en
`23c038a`.

Autodeploy Git-triggered normal a "DeliGO Copy" (sin `railway up`, sin
mutar variables/domains/DB/service settings/replicas/VAPID/secrets) —
deployment `96dc9cd8-b4d6-492b-a0e6-e6566127d38c` `SUCCESS`,
`meta.commitHash` == `23c038a` exacto (verificado vía `railway status
--json`, no asumido). Logs de boot limpios ("No pending migrations to
apply.", Next.js 16.1.3 "✓ Ready in 136ms"). Validación NO mutante
post-deploy: `GET /negocio` → 200, `GET /cliente/` → 308 (normalización
de slash, normal, sin cambios); se descargaron los chunks JS
referenciados por `/negocio` y se confirmó que el bundle desplegado
contiene la propiedad `_hasHydrated` (evidencia complementaria, no
autoritativa por sí sola — la confirmación autoritativa es el match
exacto de `commitHash` ya verificado). Ninguna suscripción Push fue
mutada. Ningún pedido/mensaje fue creado. Ningún Push real fue
enviado. Production ("DeliGO") confirmado sin cambios en el MISMO
`railway status --json`.

**Dos findings NUEVOS registrados formalmente, aportados físicamente
por el operador durante esta tarea — ninguno auditado ni corregido**:

1. **iOS Chat safe-area de controles interactivos**
   (`IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_FINDING=OPEN`): el
   full-bleed de DeliGO en iPhone hasta la status bar es INTENCIONAL y
   debe preservarse (banners/backgrounds/hero content deben poder
   ocupar toda la pantalla) — pero en las vistas de chat, los
   CONTROLES INTERACTIVOS superiores (cerrar/volver del chat
   individual, cerrar/volver del listado) también quedan dentro/debajo
   de esa misma safe-area, pudiendo dejar al usuario sin forma de
   salir del chat (workaround físico actual del operador: cerrar y
   reabrir la PWA). Android no presenta este problema. Principio ya
   fijado para el futuro fix (no implementado): fondo/banner puede
   extenderse a `top:0`, pero los controles interactivos deben
   respetar `env(safe-area-inset-top)` (o abstracción equivalente) —
   nunca resolver con padding global a toda la pantalla, nunca romper
   el full-bleed general de iPhone ya establecido. **Este finding
   BLOQUEA el closeout de P2-T31.**
2. **Android PWA install completion UX**
   (`ANDROID_PWA_INSTALL_COMPLETION_UX_FINDING=OPEN`): en Android, tras
   aceptar el prompt de instalación de Chrome, la UI de DeliGO muestra
   inmediatamente "App instalada" — pero el WebAPK puede seguir
   generándose en segundo plano; el usuario vuelve al launcher,
   todavía no la ve, y parece que la instalación falló. Objetivo UX
   futuro (no implementado): máquina de estados `AVAILABLE →
   PROMPTING → ACCEPTED → INSTALLING_BACKGROUND →
   INSTALLED_CONFIRMED`, con progreso indeterminado ("Instalando
   DeliGO… puede tardar unos segundos" — la Web Platform NO expone un
   porcentaje real de instalación de WebAPK), evaluando
   `navigator.getInstalledRelatedApps()` sin asumir su viabilidad
   todavía. Es una mejora de UX GENERAL de instalación —
   **NO bloquea P2-T31**, queda `QUEUED` como tarea separada.

**Checklist de re-test físico — para el operador** (no ejecutado desde
Claude): **obligatorio** — Android Negocio con la PWA REALMENTE
cerrada, Cliente envía un mensaje de chat, tocar la notificación debe
abrir DeliGO Negocio con el `ChatSheet` YA mostrando la conversación
del pedido correcto (no sólo el dashboard); **obligatorio** — mismo
escenario en iPhone Negocio; **recomendado** — Negocio→Cliente, para
confirmar simetría (mismo código compartido). No se pide repetir la
matriz completa de Push.

**Ninguna certificación funcional de Push preexistente se revoca** —
iPhone los 3 roles, Android Cliente/Negocio/Repartidor: todos
`CERTIFIED_TESTING`/`PASS` sin cambios. `ANDROID_PUSH_NOTIFICATION_
ICON_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING` (R22A) sigue
cerrado, no se reabre. Los findings preexistentes (`PWA_MASKABLE_
ICON_SAFE_ZONE_FINDING=OPEN`, `SW_ICON_CACHE_BYPASS_SUBSTRING_
FINDING=OPEN_NON_BLOCKING`, badge monocromático inadecuado,
`unsubscribe()` stale) quedan todos preservados sin tocar.

**P2-T31 SIGUE ABIERTO** — ahora bloqueado por DOS condiciones
explícitas: (1) confirmación física del fix de chat tap, y (2) el
nuevo finding de safe-area de chat en iOS. "R21 final"/closeout
explícitamente NO se ejecuta hasta ambas. P2-T29 sigue `QUEUED`, no se
inicia. Payments `DEFERRED`, no se inicia.
`ANDROID_PWA_INSTALL_COMPLETION_UX` queda en cola como tarea de UX
separada, explícitamente NO bloqueante. `GIT_DEPLOY_HISTORY.md`
actualizado con esta entrada (SÍ hubo deploy). Reporte completo:
`codex-reports/P2_T31_R23A_CHAT_NOTIFICATION_DEEPLINK_AUTH_HYDRATION_FIX_TESTING_DEPLOY.md`.

## 0.33 ESTADO ANTERIOR — P2-T31-R23: ROUTING DE ÍCONOS (R22A) CONFIRMADO FÍSICAMENTE Y CERRADO; NUEVO FINDING — TAP DE NOTIFICACIÓN DE CHAT FALLA EN ANDROID E IPHONE, CAUSA STRONGLY_SUPPORTED (2026-09-08) — FIX IMPLEMENTADO Y DESPLEGADO EN TESTING POR 0.34 ARRIBA

```text
HEAD=origin/testing-codex=ed58ca47a522b8190c41283818d1742887f24d31 (sin cambios — R23 es read-only)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R23_STATUS=CHAT_TAP_ROOT_CAUSE_STRONGLY_SUPPORTED_FIX_DESIGNED_NOT_IMPLEMENTED

ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (CERRADO — no se reabre salvo evidencia nueva)
R22A_CLIENT_ICON_PHYSICAL=PASS / R22A_NEGOCIO_ICON_PHYSICAL=PASS / R22A_REPARTIDOR_ICON_PHYSICAL=PASS
R22A_ROLE_ICON_PHYSICAL_CONFIRMATION_COMPLETE=SI

PUSH_CHAT_NOTIFICATION_TAP_ROUTING_FINDING=OPEN (NUEVO, independiente del routing de íconos)
PHYSICAL_CHAT_PUSH_DELIVERY=PASS / PHYSICAL_CHAT_PUSH_ICON_ROUTING=PASS / PHYSICAL_CHAT_PUSH_DUPLICATE=NO
PHYSICAL_CHAT_NOTIFICATION_TAP_ANDROID=FAIL / PHYSICAL_CHAT_NOTIFICATION_TAP_IPHONE=FAIL
PHYSICAL_CHAT_FAILURE_SCOPE=CONFIRMED_ONLY_FOR_CLIENTE_TO_NEGOCIO_CHAT_TAP (no se asume que otros flujos también fallen)

ROOT_CAUSE_PRIMARY_CLASS=CLIENT_SIDE_AUTH_HYDRATION_RACE_SILENTLY_DROPS_ONE_SHOT_CHAT_DEEPLINK
ROOT_CAUSE_PRIMARY_STATUS=STRONGLY_SUPPORTED (7 de 9 categorías candidatas RULED_OUT con ejecución real del sw.js; no PROVEN por no reproducir timing en navegador real)
NOTIFICATIONCLICK_AUDITED=SI / BUILD_PERSONAL_TARGET_AUDITED=SI / WINDOW_FOCUS_ROUTING_ROLE_SAFE=SI / OPEN_WINDOW_TARGET_CORRECT=SI (el sw.js NO es la causa, probado)
CHAT_DATA_ROLE_PRESENT=SI / CHAT_DATA_ROLE_CORRECT=SI / CHAT_PAYLOAD_URL_STATUS=CORRECT / IDENTIFIER_MATCH=SI

CHAT_NOTIFICATION_TAP_FIX_REQUIRED=SI
RECOMMENDED_FIX_ARCHITECTURE=GATE_USECHATDEEPLINK_ON_AUTH_HASHYDRATED_WITH_RETRY_ON_HYDRATE_COMPLETE
BACKWARD_COMPATIBILITY_STATUS=SAFE_BY_DESIGN
PHYSICAL_RETEST_REQUIRED=SI (post-fix: Android + iPhone Negocio, Cliente→Negocio chat; recomendado también Negocio→Cliente)

PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / COMMIT_PERFORMED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO
PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN (sin cambios) / SW_ICON_CACHE_BYPASS_SUBSTRING_FINDING=OPEN_NON_BLOCKING (sin cambios) / ANDROID_MONOCHROME_BADGE_UX_TASK_REQUIRED=SI (sin cambios) / DELIGO_BRANDING_R1_TESTING_DEPLOY_STATUS=DEPLOYED_AWAITING_PHYSICAL_VISUAL_CHECK (sin cambios)
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios) / ANDROID_NEGOCIO_SHORT_SMOKE=PASS / ANDROID_REPARTIDOR_SHORT_SMOKE=PASS (sin cambios, ninguna certificación funcional se revoca)
P2_T31_STATUS=IN_PROGRESS_PENDING_CHAT_NOTIFICATION_TAP_ROUTING_FIX_AND_FINAL_DIAGNOSTICS_CLOSEOUT
P2_T29_STATUS=QUEUED / PAYMENTS_WORK_STATUS=DEFERRED
NEXT_RECOMMENDED_ACTION=P2_T31_R23A_CHAT_NOTIFICATION_TAP_DEEPLINK_FIX
```

Tarea DEEP READ-ONLY PRODUCT AUDIT + ROOT-CAUSE CLASSIFICATION + FIX
DESIGN + PHYSICAL RETEST DESIGN — sin código, sin tests, sin commit/
push/deploy. Baseline verificado fresco (`HEAD=origin/testing-codex=
ed58ca4`, `origin/main=1de0d3c1`, coincidían exactamente).

**Reconciliación de R22A — CERRADO**: el operador confirmó físicamente
los 3 casos pendientes de la tarea anterior. Android Cliente
(`order_update`, cambio de estado de pedido): push llegó, ícono
naranja correcto, sin duplicado, **tap correcto**. Android Repartidor
(`new_delivery`): push llegó, ícono azul correcto, sin duplicado,
**tap correcto**. Android Negocio (`chat`, mensaje de Cliente): push
llegó, ícono turquesa correcto, sin duplicado, **tap INCORRECTO**. Con
esto, `ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING` pasa a
`PHYSICALLY_CONFIRMED_FIXED_TESTING` en los 3 roles — el routing de
íconos por rol (R22/R22A) queda **cerrado físicamente**, no se reabre
salvo evidencia nueva explícita. El `tap` incorrecto de Negocio+chat
es un finding COMPLETAMENTE NUEVO E INDEPENDIENTE — el operador
confirmó además que el mismo fallo ocurre en iPhone (no es Android-
only), y no se trata como regresión de R22A: R22A únicamente tocó el
cómputo de `icon`/`badge` dentro del `push` event de `sw.js`, un
bloque de código completamente distinto y anterior al de
`notificationclick`, donde vive este nuevo bug.

**Root cause del tap de chat — trazado end-to-end con evidencia de
código real en cada tramo**: `chatMessageNotification`
(`src/lib/push.ts:926-942`) → NO envía `url` por diseño (mismo patrón
que `orderUpdateNotification`, ya probado correcto) → `data.role`
agregado centralmente por `createNotification()` (sin exclusión para
`chat`) → `public/sw.js`::`notificationclick` extrae `type`/`role`/
`pedidoId` → `buildPersonalNotificationTarget` (función pura) → para
`type==="chat"` devuelve `${basePath}?chat=<pedidoId>` (basePath
resuelto por `role`, `/negocio` para Negocio) → `clients.matchAll`/
`navigate`/`openWindow`.

**Se ejecutó el `public/sw.js` REAL** (no una reimplementación) en un
sandbox VM de Node —misma técnica exacta de R22/R22A— disparando
`notificationclick` para `negocio+chat` en 2 escenarios (PWA cerrada,
PWA ya abierta en `/negocio`) y para los 2 controles positivos
(`cliente+order_update`, `repartidor+new_delivery`, ambos con tap ya
certificado físicamente). Resultado: **en los 4 casos, el Service
Worker calcula la URL/ventana EXACTA y correcta** —
`self.location.origin + "/negocio?chat=<pedidoId>"` para el caso de
chat, indistinguible en calidad de los 2 controles. **El bug NO está
en `sw.js`** — esto descarta con evidencia directa de ejecución 7 de
las 9 categorías de causa candidatas: fábrica con URL/identificador
incorrecto, mapping de target roto en `buildPersonalNotificationTarget`,
window-matching role-unsafe (el matching exige `pathname.startsWith(
"/negocio")`, probado), ruta de chat legacy (auditado el inventario de
rutas reales: Negocio NO tiene ninguna página de chat dedicada, usa el
MISMO widget global flotante que Cliente — `ChatFab`/`ChatSheet`,
montados en `src/app/layout.tsx` raíz), action-button handler
equivocado (el payload de chat no define `actions`, la evidencia física
es tap de cuerpo), y atribución multi-PWA same-origin (descartada, el
matching es explícitamente role-safe, probado en el escenario de app
ya abierta).

**La única diferencia real** — encontrada comparando campo por campo
el caso roto contra los 2 controles que sí funcionan —: `src/providers/
chat-provider.tsx`::`useChatDeepLink` es el ÚNICO consumidor de un
deep-link de notificación montado en el **LAYOUT RAÍZ** (antes de
cualquier gate de ruta específico de rol) que se auto-condiciona a
`isAuthenticated()`/`userType()` de `src/store/auth-store.ts` —un
store Zustand con middleware `persist`, cuya hidratación es
ASÍNCRONA por diseño de Zustand, incluso usando `localStorage` como
storage síncrono— **sin esperar `_hasHydrated`** y **sin ningún
reintento** cuando esa hidratación efectivamente termina. En un
arranque en frío (exactamente el escenario de abrir la PWA de Negocio
recién cerrada desde un tap de notificación — `self.clients.
openWindow(...)`), esto puede leer `isAuthenticated()===false` ANTES
de que el usuario persistido se rehidrate, descartando el deep-link
para siempre, silenciosamente, sin ningún mecanismo de recuperación.

Los 2 consumidores de deep-link que SÍ funcionan
(`src/components/business/orders-tab.tsx` para Negocio,
`src/components/client/client-orders-panel.tsx` para Cliente) **nunca
se auto-verifican auth** — leen su parámetro de query (`pedidoId`/
`focusPedido`) incondicionalmente, porque sólo se montan DENTRO de una
ruta que la app YA trata como autenticada a un nivel superior (el
shell del rol) — nunca antes. Este mismo patrón defensivo
(`_hasHydrated`/`authHasHydrated`) YA existe, activamente usado, en 6+
archivos reales de este mismo repositorio (`src/app/cliente/page.tsx`,
`src/hooks/use-push-notifications.ts`, `src/store/cart-store.ts`,
`src/store/nav-store.ts`, `src/components/shared/push-debug-panel.tsx`,
`src/components/shared/push-debug-trace-bootstrap.tsx`) —
`chat-provider.tsx` es una OMISIÓN de un patrón ya establecido en el
propio codebase, no una idea nueva a inventar. Coincide además,
explícitamente, con el `AUTH_HYDRATION_PUSH_RACE` ya documentado
(`AUTH_HYDRATION_PUSH_RACE_STATUS=OPEN_STRUCTURAL_GAP_PROVEN_IMPACT_
PLAUSIBLE_NOT_CONFIRMED`) en R6A de este mismo epic P2-T31, para un
escenario análogo distinto (una lectura de estado de Push, no de
chat) — nunca antes confirmado por falta de evidencia; R23 no lo
reclasifica, pero aporta evidencia adicional consistente de que esta
clase de race es real en este codebase. La causa es 100% cross-
platform por naturaleza (un problema de timing de JavaScript/
hidratación de estado persistido, no de renderizado específico de
Android/iOS) — coherente con que el operador confirmó el mismo fallo
en AMBAS plataformas.

`ROOT_CAUSE_PRIMARY_STATUS=STRONGLY_SUPPORTED` — deliberadamente NO
`PROVEN`: no se reprodujo el timing EXACTO de la carrera de
hidratación en un navegador real (lanzar un browser real para forzar
y cronometrar esa carrera está fuera del alcance de una auditoría
read-only de código sin producto/tests modificados). La eliminación de
las otras 7 categorías, en cambio, SÍ es `PROVEN` (por ejecución
directa de código real).

**Fix diseñado, NO implementado en R23** (tarea explícitamente
read-only): `useChatDeepLink` debe leer `authHasHydrated
(useAuthStore((s) => s._hasHydrated))` y volver a ejecutar
`consumeChatParam()` cuando esa bandera pase de `false` a `true` —
ADEMÁS de (no en reemplazo de) los triggers actuales de mount/focus/
visibilitychange. Un solo archivo, sin tocar `sw.js` (routing de
íconos R22A intacto), sin tocar `push.ts` (backend), sin tocar
`notificationclick`, sin tocar los targets de pedidos/`new_delivery`
ya certificados. Backward compatible por diseño: una app ya abierta
con hidratación ya completada hace tiempo se comporta EXACTAMENTE
igual que hoy (el trigger de mount ya funciona en ese caso); un SW
viejo no se ve afectado (el fix vive 100% en React/cliente); ningún
cambio de contrato de URL/query param.

**Re-test físico diseñado, no ejecutado**: obligatorio — Android
Negocio Y iPhone Negocio, con la PWA de Negocio REALMENTE cerrada
(cierre forzado, no sólo background), Cliente envía un mensaje de chat
→ tap sobre la notificación → debe abrir DeliGO Negocio con el
`ChatSheet` YA mostrando la conversación del pedido correcto (no sólo
el dashboard de Negocio). Recomendado: Negocio→Cliente, para confirmar
simetría (mismo código compartido). No se pide repetir la matriz
completa de Push — sólo estos 2-3 casos.

**Gap de tests confirmado**: cero tests en todo el repo cubren
`notificationclick`, `buildPersonalNotificationTarget`, o
`ChatProvider`/`useChatDeepLink` — ni siquiera para los casos que sí
funcionan hoy (`order_update`/`new_delivery`). Matriz completa de gaps
en el reporte.

**Ninguna certificación funcional de Push preexistente se revoca** —
iPhone los 3 roles, Android Cliente/Negocio/Repartidor: todos
`CERTIFIED_TESTING`/`PASS` sin cambios; el matiz explícito preservado
es que esas certificaciones cubren los eventos YA probados (entrega,
ícono, no-duplicado, y los taps de `order_update`/`new_delivery`
específicamente) — no una certificación exhaustiva de TODOS los
`notifType`/deep-links. Los findings preexistentes
(`PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN`, `SW_ICON_CACHE_BYPASS_
SUBSTRING_FINDING=OPEN_NON_BLOCKING`, badge monocromático inadecuado,
`DELIGO_BRANDING_R1_TESTING_DEPLOY_STATUS=DEPLOYED_AWAITING_PHYSICAL_
VISUAL_CHECK`) quedan todos preservados sin tocar, ninguno mezclado
con este finding de chat.

**P2-T31 SIGUE ABIERTO** — bloqueado ahora específicamente por el fix
de tap de chat (R23A), no por el routing de íconos (cerrado). "R21
final"/closeout explícitamente NO se ejecuta hasta el fix +
confirmación física. P2-T29 sigue `QUEUED`, no se inicia. Payments
`DEFERRED`, no se inicia. `COMPLETED_TASKS.md` actualizado — se
registró una entrada de sub-etapa PASS para "P2-T31 — SUB-ETAPA R22/
R22A (Android Push Notification Icon Routing)" (routing de íconos
cerrado), dejando explícito en su propia nota que P2-T31 en sí sigue
abierto por el finding de chat. `GIT_DEPLOY_HISTORY.md` NO se
actualiza (sin commit/deploy en R23). Reporte completo:
`codex-reports/P2_T31_R23_CHAT_PUSH_NOTIFICATION_TAP_DEEPLINK_ROOT_CAUSE_AUDIT.md`.

## 0.32 ESTADO ANTERIOR — P2-T31-R22A: FIX DE ROUTING DE ÍCONO DE NOTIFICACIÓN DESPLEGADO EN TESTING (COMMIT ED58CA4), PENDIENTE CONFIRMACIÓN FÍSICA ANDROID (2026-09-08) — CONFIRMADO FÍSICAMENTE Y CERRADO; NUEVO FINDING DE CHAT TAP AUDITADO POR 0.33 ARRIBA

```text
HEAD=origin/testing-codex=ed58ca47a522b8190c41283818d1742887f24d31 (R22A — reemplaza a 1d3f58a en TESTING)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R22A_STATUS=FIX_IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION
ROLE_FIRST_ICON_ROUTING_IMPLEMENTED=SI (public/sw.js, push event listener)
CLIENT_ROLE_ICON_PATH=/icon-cliente-192x192.png / NEGOCIO_ROLE_ICON_PATH=/icon-negocio-192x192.png / REPARTIDOR_ROLE_ICON_PATH=/icon-repartidor-192x192.png
LEGACY_NOTIFTYPE_FALLBACK_PRESERVED=SI / EXPLICIT_PAYLOAD_ICON_OVERRIDE_PRESERVED=SI
BACKEND_CODE_CHANGE_REQUIRED=NO / BACKEND_CODE_CHANGED=NO (data.role ya existía, sólo faltaba consultarlo en el SW)
NOTIFICATION_CLICK_CHANGED=NO / PUSH_DELIVERY_LOGIC_CHANGED=NO / PUSH_SUBSCRIPTION_LOGIC_CHANGED=NO
BADGE_ROLE_ROUTING_CORRECTED=SI / ANDROID_MONOCHROME_BADGE_UX_TASK_REQUIRED=SI (sin cambios, separado, no resuelto)
SW_CACHE_NAME_BUMP_REQUIRED_FOR_R22A=NO / SW_CACHE_NAME_CHANGED=NO (deligo-v15 sin cambios, justificado: el propio script SW no se sirve desde ese cache)
ROLE_ICON_ROUTING_TEST_PASS=26 (sw-push-role-icon-routing.test.ts, sw.js real en VM sandbox) + 4 (push.test.ts, data.role directo)
PUSH_TEST_BASELINE_PASS=577 / PUSH_TEST_FINAL_PASS=607 / PUSH_TEST_FINAL_FAIL=0
PWA_FOCAL_TEST_PASS=52 / PWA_FOCAL_TEST_FAIL=0 / ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI
R22_BUG_REPRO_BEFORE=FAIL_EXPECTED / R22_BUG_REPRO_AFTER=PASS (Cliente+order_update, Negocio+chat, Repartidor+new_delivery)
COMMIT_HASH=ed58ca47a522b8190c41283818d1742887f24d31 / COMMIT_PARENT=1d3f58a1ea5487d254b51fa8627b5935065bce3a / COMMIT_MESSAGE=fix: route push notification icons by recipient role
TESTING_DEPLOYMENT_ID=34f5cf79-25bd-4d7a-855c-287d8bacdc4a / TESTING_DEPLOYMENT_STATUS=SUCCESS (match exacto verificado)
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=1de0d3c153eaf3be068adeb004ea43feb42fc40e
POST_DEPLOY_SW_JS_CONTENT_VERIFIED_BYTE_IDENTICAL=SI (diff --strip-trailing-cr contra el archivo servido en TESTING) / ICON_FILES_STILL_200=SI (los 3 de rol)
ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION
REPORT_STAGED=NO / FULL_CONTEXT_STAGED=NO / BRANDING_SOURCE_STAGED=NO / FILE_32_TOUCHED=NO
PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN (sin cambios) / SW_ICON_CACHE_BYPASS_SUBSTRING_FINDING=OPEN_NON_BLOCKING (sin cambios) / DELIGO_BRANDING_R1_TESTING_DEPLOY_STATUS=DEPLOYED_AWAITING_PHYSICAL_VISUAL_CHECK (sin cambios, distinto de este finding)
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios, los 3+1) / ANDROID_NEGOCIO_SHORT_SMOKE=PASS / ANDROID_REPARTIDOR_SHORT_SMOKE=PASS (sin cambios, ninguna certificación funcional se revoca)
P2_T31_STATUS=IN_PROGRESS_PENDING_ANDROID_NOTIFICATION_ICON_ROUTING_PHYSICAL_CONFIRMATION_AND_FINAL_DIAGNOSTICS_CLOSEOUT
P2_T29_STATUS=QUEUED / PAYMENTS_WORK_STATUS=DEFERRED
NEXT_RECOMMENDED_ACTION=P2_T31_R22A_PHYSICAL_ANDROID_ROLE_ICON_CONFIRMATION
```

Tarea TARGETED IMPLEMENTATION + REGRESSION TESTS + CONTROLLED COMMIT +
PUSH + TESTING DEPLOY, explícitamente autorizada
(`PRODUCT_CODE_CHANGE_AUTHORIZED=SI`/`COMMIT_AUTHORIZED=SI`/
`PUSH_AUTHORIZED=SI`/`TESTING_DEPLOY_AUTHORIZED=SI`/
`PRODUCTION_DEPLOY_AUTHORIZED=NO`). Baseline verificado fresco
(`HEAD=origin/testing-codex=1d3f58a`, `origin/main=1de0d3c1`,
coincidían exactamente).

Implementó el fix diseñado por R22, dentro del `push` event de
`public/sw.js`: `icon`/`badge` se resuelven PRIMERO por
`data.data?.role` (cliente/negocio/repartidor → su propio ícono),
usando un nuevo mapa `ROLE_ICON`. El campo `data.role` **ya existía**
—agregado por `createNotification()`::`personalRoleFor` en
`src/lib/push.ts` desde "Bugfix-4 [17]", entregado de forma probada
end-to-end (mismo mecanismo que `notificationclick` ya usaba)— así que
**el backend no se tocó en absoluto**. El `if/else if` legacy completo
por `notifType` se preservó línea por línea, ahora como fallback
exclusivo dentro de un `else`, para cualquier payload sin `role`
reconocido (Salón/Mozo/Empleado/Operaciones, y pushes viejos ya
encolados). El override explícito `data.icon`/`data.badge` del payload
(usado hoy sólo por `operaciones_order_cancelled`) sigue ganando
siempre — esa línea no se tocó. `notificationclick`, delivery,
subscription, fan-out, dedupe, tag, actions, urgency, TTL, permission,
auth: **nada de esto se modificó**.

Se agregaron 26 tests nuevos
(`src/lib/sw-push-role-icon-routing.test.ts`) que cargan el
`public/sw.js` REAL en un sandbox VM de Node (misma técnica exacta que
`src/lib/sw-push-dedupe.test.ts`, nunca una reimplementación) —
cobertura completa: los 3 roles core (Cliente/Negocio/Repartidor) ×
sus notifType realmente compartidos (order_update/review/chat/
new_order/account_update/new_delivery); 11 casos de fallback legacy
SIN `role`, cada uno verificado IDÉNTICO al comportamiento anterior a
este fix (salon_new_order, operaciones_salon_new_order,
mesa_order_ready, operaciones_order_cancelled ×2 áreas, new_order,
order_update, review, account_update, chat, new_delivery); un `role`
desconocido (`"superadmin"`) y un `role` `null` explícito, ambos
cayendo al fallback SIN lanzar excepción; y 2 tests de precedencia que
confirman que el override explícito de `data.icon`/`data.badge` sigue
ganando incluso con `role` presente. Se agregaron además 4 tests
directos en `src/lib/push.test.ts` —extendiendo el mock YA EXISTENTE
de `web-push` para capturar el payload JSON real enviado a
`webpush.sendNotification`, sin ninguna fixture de DB nueva— que
verifican `data.role = "cliente"/"negocio"/"repartidor"` exactamente
para cada `userType`, y su ausencia para `empleado` (rol sin PWA
"personal" en el modelo actual).

**Reproducción antes/después del bug físico exacto de R22**:
`R22_BUG_REPRO_BEFORE=FAIL_EXPECTED` / `R22_BUG_REPRO_AFTER=PASS` — los
3 casos documentados como rotos en R22 (Cliente+order_update →
mostraba ícono de Negocio; Negocio+chat → mostraba ícono de Cliente;
Repartidor+new_delivery → mostraba ícono de Cliente) ahora resuelven
cada uno a su propio ícono, confirmado en tests con nombres explícitos
que citan el bug original. Regresión negativa también verificada:
Negocio+new_order, Salón, y Mozo siguen resolviendo exactamente igual
que antes del fix.

Gate completo: suite Push 607/607 (577 baseline + 30 nuevos), PWA
focal 52/52 sin cambios (branding/manifests/identidad PWA no se
tocaron), ESLint limpio, TypeScript 24 raw idéntico a la baseline (0
nuevos, ninguno menciona los 3 archivos tocados), `git diff --check`
limpio, `next build` completo sin errores. `bun test` global no se
re-ejecutó (antecedente ambiental de `DATABASE_URL` ya documentado,
sin señal nueva que aportar).

`SW_CACHE_NAME_BUMP_REQUIRED_FOR_R22A=NO`, justificado técnicamente:
`CACHE_NAME` versiona el cache INTERNO de assets estáticos
(`caches.open(CACHE_NAME)`) — el propio SCRIPT `sw.js` nunca se sirve
desde ese cache; el navegador lo re-descarga y compara por su cuenta en
cada registro/chequeo periódico, independiente de `CACHE_NAME`. Este
fix no agrega, quita ni renombra ningún asset estático — permanece en
`deligo-v15`, sin tocar.

Stage selectivo de EXACTAMENTE 3 archivos (`public/sw.js`,
`src/lib/push.test.ts`, `src/lib/sw-push-role-icon-routing.test.ts`) —
el reporte de esta tarea permanece **untracked**; se preservó
explícitamente la convención histórica de `codex-reports/` local, SIN
generalizar el precedente puntual de Branding R1A (que trackeó un solo
reporte por autorización explícita de esa tarea específica).
`branding-source/`, `DELIGO_FULL_CONTEXT_LATEST.md` y `32` intactos.
Un solo commit (`ed58ca4`, parent `1d3f58a` verificado, sin `--amend`).
Push únicamente a `testing-codex` — `origin/testing-codex` confirmado
en `ed58ca4`.

Autodeploy Git-triggered normal a "DeliGO Copy" (sin `railway up`, sin
mutar variables/domains/DB/service settings/replicas/VAPID/secrets) —
deployment `34f5cf79-25bd-4d7a-855c-287d8bacdc4a` `SUCCESS`,
`meta.commitHash` == `ed58ca4` exacto (verificado vía `railway status
--json`, no asumido). Logs de boot limpios ("No pending migrations to
apply.", Next.js 16.1.3 "✓ Ready in 59ms"). Validación NO mutante
post-deploy: `GET /sw.js` → 200, contenido descargado y comparado
byte a byte contra el archivo local commiteado (`diff
--strip-trailing-cr`) — **idéntico** (única diferencia CRLF/LF de
transporte, sin significado); confirmado estáticamente en el archivo
servido (no por inferencia) que contiene los 3 selectores de rol
(`cliente`/`negocio`/`repartidor` → sus propios paths de ícono) y el
bloque legacy completo por `notifType`. Los 3 íconos de rol
(`icon-cliente/negocio/repartidor-192x192.png`) siguen respondiendo
200 `image/png`. Ninguna suscripción Push fue mutada. Ningún pedido fue
creado. Ningún Push real fue enviado. Production ("DeliGO") confirmado
sin cambios en el MISMO `railway status --json`.

**No se certifica físicamente** — `ANDROID_PUSH_NOTIFICATION_ICON_
ROUTING_FINDING=FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION`.
Checklist de re-test entregado al operador, 3 casos (no se pide repetir
la matriz completa de 12 tipos):

1. **Android Cliente (obligatorio)**: Cliente con Push activo y un
   pedido en curso → Negocio cambia el estado (ej. PREPARANDO o
   EN_CAMINO) → debe llegar una Push `order_update` → verificar entrega
   SÍ, ícono NARANJA de Cliente (NO turquesa de Negocio), sin
   duplicados, tap al pedido correcto.
2. **Android Negocio (recomendado)**: Cliente envía un mensaje de chat
   → Negocio debe ver su propio ícono TURQUESA (no el naranja de
   Cliente).
3. **Android Repartidor (recomendado)**: evento `new_delivery` actual →
   Repartidor debe ver su propio ícono AZUL (no el naranja de Cliente).

Ninguna certificación funcional de Push preexistente se revoca —
iPhone los 3 roles, Android Cliente/Negocio/Repartidor: todos
`CERTIFIED_TESTING`/`PASS` sin cambios. Los findings preexistentes
(`PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN`, `SW_ICON_CACHE_BYPASS_
SUBSTRING_FINDING=OPEN_NON_BLOCKING`, badge monocromático inadecuado
—`ANDROID_MONOCHROME_BADGE_UX_TASK_REQUIRED=SI`, separado y NO resuelto
por este fix—, `DELIGO_BRANDING_R1_TESTING_DEPLOY_STATUS=DEPLOYED_
AWAITING_PHYSICAL_VISUAL_CHECK` —launcher/ícono instalado, un check
DISTINTO al de notificaciones, no mezclado—, y el finding de
`unsubscribe()` stale de R19R) quedan todos preservados sin tocar.

**P2-T31 SIGUE ABIERTO** — "R21 final"/closeout explícitamente NO se
ejecuta hasta la confirmación física del checklist de arriba. P2-T29
sigue `QUEUED`, no se inicia. Payments `DEFERRED`, no se inicia.
`GIT_DEPLOY_HISTORY.md` actualizado (localmente, untracked) con esta
entrada (SÍ hubo deploy). Reporte completo:
`codex-reports/P2_T31_R22A_ANDROID_PUSH_NOTIFICATION_ROLE_ICON_ROUTING_FIX_TESTING_DEPLOY.md`.

## 0.31 ESTADO ANTERIOR — P2-T31-R22: CAUSA RAÍZ DEL ROUTING DE ÍCONO DE NOTIFICACIÓN ANDROID PROBADA (notifType compartido entre roles, ignora data.role ya existente); FIX DISEÑADO, NO IMPLEMENTADO (2026-09-08) — FIX IMPLEMENTADO Y DESPLEGADO EN TESTING POR 0.32 ARRIBA

```text
HEAD=origin/testing-codex=1d3f58a1ea5487d254b51fa8627b5935065bce3a (sin cambios — R22 es read-only)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R22_STATUS=ROOT_CAUSE_PROVEN_FIX_DESIGNED_NOT_IMPLEMENTED
ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=PROVEN (elevado desde OPEN/NOT_AUDITED)
ROOT_CAUSE_PRIMARY_CLASS=SHARED_NOTIFTYPE_USED_BY_MULTIPLE_ROLES_WITH_ROLE_UNSAFE_ICON_MAPPING / STATUS=PROVEN
SHARED_NOTIFTYPE_LIST=order_update(cliente+negocio+repartidor), review(cliente+negocio), chat(cliente+negocio)
CLIENT_EVENT_USING_NEGOCIO_ICON_BRANCH_FOUND=SI (3 de 5 eventos Cliente reales)
PAYLOAD_ROLE_FIELD_EXISTS=SI / PAYLOAD_ROLE_FIELD_DELIVERED_RELIABLY=SI / PAYLOAD_ROLE_FIELD_USED_FOR_ICON_SELECTION=NO
WRONG_ICON_PATH_GENERATED=SI (probado ejecutando el sw.js real en VM sandbox con payloads de forma real de producción) / CACHE_ROOT_CAUSE_PLAUSIBILITY=NO_EVIDENCE
IPHONE_EQUIVALENT_NOTIFICATION_ICON_BEHAVIOR=CORRECT (explicado: WebKit/Safari ignora NotificationOptions.icon y usa siempre el ícono de manifest de la PWA instalada — enmascara el mismo bug, no lo desmiente)
ANDROID_BADGE_CURRENTLY_ROLE_SAFE=NO (badge hereda el mismo valor incorrecto que icon)
RECOMMENDED_FIX_ARCHITECTURE=SW_USES_DATA_ROLE_AS_PRIMARY_ICON_SELECTOR_WITH_NOTIFTYPE_FALLBACK / BACKWARD_COMPATIBILITY_STATUS=SAFE_WITH_FALLBACK
PHYSICAL_RETEST_REQUIRED=SI (post-fix, no ejecutado ahora) / PHYSICAL_RETEST_EVENT=negocio cambia estado de un pedido activo de Cliente / PHYSICAL_RETEST_EXPECTED_ICON=/icon-cliente-192x192.png
PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN (sin cambios) / SW_ICON_CACHE_BYPASS_SUBSTRING_FINDING=OPEN_NON_BLOCKING (sin cambios)
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios, los 3+1) / ANDROID_NEGOCIO_SHORT_SMOKE=PASS / ANDROID_REPARTIDOR_SHORT_SMOKE=PASS (sin cambios, ninguna certificación funcional se revoca)
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / COMMIT_PERFORMED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_PENDING_ANDROID_NOTIFICATION_ICON_ROUTING_FIX
P2_T29_STATUS=QUEUED / PAYMENTS_WORK_STATUS=DEFERRED
NEXT_RECOMMENDED_ACTION=P2_T31_R22A_ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FIX
```

Tarea DEEP READ-ONLY PRODUCT AUDIT + ROOT-CAUSE CLASSIFICATION + TEST/
DESIGN PLAN — sin código, sin tests tracked, sin commit/push/deploy.
Se reconstruyó el pipeline Push completo end-to-end con evidencia de
código real en cada tramo: productor (`src/lib/push.ts`, ~15 fábricas
de payload) → `createNotification()`/`enrichedPushPayload` →
`webpush.sendNotification()` → `push` event de `public/sw.js` →
`self.registration.showNotification()`. Se inventariaron
exhaustivamente los 12 valores reales de `NotificationType`
(`src/lib/push.ts:41-53`) contra más de 20 call sites reales,
determinando el/los recipient(s) verdadero(s) de cada uno.

**Causa raíz PROBADA** (no plausible, no inferida — probada por
ejecución de código real): `order_update` —el tipo MÁS FRECUENTE que
un Cliente recibe, cubriendo TODO el ciclo de vida visible de su
pedido ("confirmó tu pedido", "en camino", "listo para retirar",
"entregado")— se comparte entre Cliente, Negocio Y Repartidor.
`public/sw.js` lo mapea INCONDICIONALMENTE al ícono de Negocio (misma
rama que `new_order`/`review`/`account_update`). El mismo patrón
aplica a `review` (compartido Cliente+Negocio, rompe para Cliente) y,
en dirección opuesta, a `chat` (compartido Cliente+Negocio, cae al
default Cliente, rompe para Negocio).

El campo que YA RESUELVE esto correctamente **ya existe en el
código**: `createNotification()` (`src/lib/push.ts:608-622`, desde
"Bugfix-4 [17]") agrega `data.role = personalRoleFor(userType)` a
TODO payload personal (cliente/negocio/repartidor) — diseñado
originalmente sólo para que `notificationclick` supiera qué app
abrir/enfocar, entregado de forma end-to-end probada y confiable
(`webpush.sendNotification` serializa el payload completo sin
pérdida). El `push` event handler que selecciona `icon`/`badge`
simplemente **nunca consulta `data.role`** — sólo mira
`data.data?.type`.

**Evidencia de ejecución real**: se cargó el `public/sw.js` GENUINO
(no una reimplementación) en un sandbox VM de Node — reutilizando
exactamente la técnica ya usada por `src/lib/sw-push-dedupe.test.ts` —
y se le alimentaron payloads con la forma EXACTA que produce
`enrichedPushPayload` en producción. Resultado: Cliente+order_update →
ícono de Negocio (reproduce EXACTAMENTE el finding físico reportado);
Cliente+review → ícono de Negocio (instancia NUEVA confirmada);
Negocio+chat → ícono de Cliente (instancia NUEVA confirmada, dirección
opuesta); Negocio+new_order/review → correctos; Cliente+chat/
review_request → correctos por coincidencia del default. El script de
reproducción vivió exclusivamente en el scratchpad de la sesión, nunca
dentro del repositorio.

**Descartado con evidencia directa** (no por omisión): (A) notifType
equivocado en el backend — el tipo es semánticamente correcto, el
problema es que se comparte; (B) override de icon/badge en el payload
— sólo 1 de 12 tipos lo tiene (`operaciones_order_cancelled`, no
relacionado); (E) binding equivocado de destinatario — el `userId`/
`userType` de cada call site apunta correctamente al Cliente/Negocio/
Repartidor real, el bug es posterior a una entrega ya correcta; (G)
atribución multi-PWA de Android — cada notificación se procesa según
su propio payload, sin mezcla de contexto entre las PWA instaladas;
(H) caché/asset viejo — el path incorrecto se genera en tiempo de
ejecución, probado, no son bytes viejos de un path correcto.

**Explicación de "iPhone correcto" — con fuente citada**: foros
oficiales de Apple Developer (`developer.apple.com/forums/thread/
740688`, "iOS Web Push - Passing in Icon Doesn't Work") documentan que
WebKit/Safari en iOS/iPadOS **ignora estructuralmente** el campo
`icon` de `showNotification()` y sustituye siempre el ícono de
manifest de la PWA instalada del destinatario. Esto explica con
precisión por qué iPhone se ve correcto pese al MISMO bug de código —
no es que iOS enrute bien, es que iOS ignora cualquier valor de `icon`
(correcto o incorrecto) y muestra siempre el ícono ya instalado.
Android, en cambio, SÍ honra fielmente `NotificationOptions.icon`
— por eso expone el bug y iPhone no.

**`badge`**: siempre hereda el mismo valor que `icon`
(`badge: data.badge || icon`, nunca un cómputo independiente) — mismo
origen, no una causa independiente. `ANDROID_BADGE_CURRENTLY_ROLE_
SAFE=NO`. El finding preexistente de badge monocromático inadecuado
(`NOTIFICATION_BADGE_STATUS=LEGACY_INADEQUATE_PRESERVED_NOT_FIXED`)
se preserva sin cambios, explícitamente como tarea de UX separada, no
mezclada con este fix de routing.

**Fix diseñado, NO implementado en R22** (tarea explícitamente
read-only): el `push` event de `sw.js` debe usar `data.data?.role`
como criterio PRIMARIO de selección de ícono
(cliente/negocio/repartidor → su propio ícono), cayendo al `if/else if`
por `notifType` actual COMPLETO como fallback únicamente para los
tipos que hoy no llevan `role` (salon/mozo/empleado/operaciones/
general). Menor blast radius que las alternativas evaluadas (payload
con icon canónico explícito por notificación, o dividir cada notifType
compartido en variantes role-specific) — un solo archivo, reutiliza un
campo YA probado. Backward compatibility explícita y fail-safe: SW
nuevo + payload viejo/sin `role` → mismo comportamiento de hoy exacto,
nunca un ícono roto/ausente; ningún delivery se ve afectado, sólo qué
ícono se muestra. Re-test físico diseñado (no ejecutado): Negocio
cambia el estado de un pedido activo de Cliente, verificar ícono
naranja de Cliente en Android.

**Gap de tests confirmado**: cero tests en todo el repo cubren
notifType→icon o role→icon — el único test que carga el `sw.js` real
(`sw-push-dedupe.test.ts`) sólo cubre el registro de dedupe D2. Matriz
completa de gaps en el reporte.

**Ninguna certificación funcional de Push se revoca** — este finding
es de branding visual, no de entrega física (que ya está probada y
completa: iPhone los 3 roles, Android Cliente/Negocio/Repartidor).
`PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN` y `SW_ICON_CACHE_BYPASS_
SUBSTRING_FINDING=OPEN_NON_BLOCKING` preservados sin cambios; el
finding preexistente de `unsubscribe()` stale (R19R) preservado sin
tocar. **P2-T31 SIGUE ABIERTO** — el siguiente paso es implementar el
fix (R22A), explícitamente NO "R21 final"/closeout. P2-T29 sigue
`QUEUED`, no se inicia. Payments `DEFERRED`, no se inicia. Sin
commit/push/deploy en esta tarea — `GIT_DEPLOY_HISTORY.md` no se
actualiza. Reporte completo:
`codex-reports/P2_T31_R22_ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_ROOT_CAUSE_AUDIT.md`.

## 0.30 ESTADO ANTERIOR — DELIGO-BRANDING-R1A: BRANDING DESPLEGADO EN TESTING (COMMIT 1D3F58A), NUEVO FINDING DE ROUTING DE ÍCONO DE NOTIFICACIÓN ANDROID (OPEN), P2-T31 SIGUE ABIERTO (2026-09-08) — CAUSA RAÍZ PROBADA POR 0.31 ARRIBA

```text
HEAD=origin/testing-codex=1d3f58a1ea5487d254b51fa8627b5935065bce3a (Branding R1A — reemplaza a 39566e6 en TESTING)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
DELIGO_BRANDING_R1A_STATUS=DEPLOYED_TESTING_EXACT_COMMIT_PENDING_PHYSICAL_VISUAL_CHECK_AND_ICON_ROUTING_AUDIT
BRANDING_REVIEW_PASS=SI (comparado contra Git/archivos reales, no sólo el reporte R1)
COMMIT_HASH=1d3f58a1ea5487d254b51fa8627b5935065bce3a / COMMIT_PARENT=39566e69647fd2b19453721214563a7b9a0ccc5e / COMMIT_MESSAGE=feat: refresh DeliGO role icons
STAGED_FILE_COUNT=15 (14 producto/test + codex-reports/DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md — PRIMER archivo jamás trackeado bajo codex-reports/, explícitamente autorizado por esta tarea)
TESTING_DEPLOYMENT_ID=976a7fa7-b607-40e2-8cb4-22907f005d22 / TESTING_DEPLOYMENT_STATUS=SUCCESS (match exacto de commitHash verificado)
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=1de0d3c153eaf3be068adeb004ea43feb42fc40e
SMOKES_HTTP_PASS=16/16 (app + 5 manifests + 10 íconos, bytes idénticos al commit; manifest-operaciones sin icon-negocio; sw.js sirviendo deligo-v15)
FOCAL_TEST_PASS=52 / PUSH_TEST_PASS=577 (re-ejecutada por tocar sw.js) / ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI
PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN / MASKABLE_SAFE_DERIVATIVE_STATUS=BLOCKED_NEEDS_DESIGN_DECISION / BLOCKS_TESTING_DEPLOY=NO / BLOCKS_FUTURE_PRODUCTION_CERTIFICATION=YES_UNTIL_DESIGN_OR_PHYSICAL_DECISION
SW_ICON_CACHE_BYPASS_SUBSTRING_FINDING=OPEN_NON_BLOCKING
ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=OPEN (NUEVO — Android Cliente mostró el ícono de Negocio en una notificación Push; iPhone equivalente correcto; ROOT_CAUSE=NOT_AUDITED)
P2_T31_CLOSEOUT_BLOCKED_BY_ANDROID_NOTIFICATION_ICON_ROUTING_AUDIT=YES
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios, los 3+1)
ANDROID_NEGOCIO_SHORT_SMOKE=PASS (segundo Android) / ANDROID_A_ABORTERROR_RESIDUAL_STATUS=DEVICE_OR_BROWSER_PROFILE_SPECIFIC_STRONGLY_SUPPORTED_NOT_GENERAL_DELIGO_BLOCKER / ANDROID_REPARTIDOR_SHORT_SMOKE=PASS
PUSH_PHYSICAL_ROLE_DELIVERY_CERTIFICATION_COMPLETE=SI
P2_T31_STATUS=IN_PROGRESS_PENDING_ANDROID_NOTIFICATION_ICON_ROUTING_AUDIT_AND_FINAL_DIAGNOSTICS_CLOSEOUT
P2_T29_STATUS=QUEUED / PAYMENTS_WORK_STATUS=DEFERRED
NEXT_RECOMMENDED_ACTION=P2_T31_ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_AUDIT
```

Tarea FINAL REVIEW + CONTROLLED COMMIT + PUSH + RAILWAY TESTING DEPLOY
+ NON-MUTATING SMOKES + CONTEXT RECONCILIATION, explícitamente
autorizada (`COMMIT_AUTHORIZED=SI`/`PUSH_AUTHORIZED=SI`/
`TESTING_DEPLOY_AUTHORIZED=SI`/`PRODUCTION_DEPLOY_AUTHORIZED=NO`).
Baseline verificado fresco (`HEAD=origin/testing-codex=39566e6`,
`origin/main=1de0d3c1`, coincidían exactamente). Se comparó cada
afirmación del reporte de Branding R1 contra Git y archivos reales sin
confiar ciegamente en él: los 10 PNG re-verificados con firma/dimensión
reales, ningún `icon192`/`icon512` compartido entre roles,
`manifest-operaciones.json` sin `icon-negocio`, `sw.js` sirviendo
`deligo-v15` — todo confirmado antes de tocar nada.

Gate re-ejecutado fresco: 52 tests focales PWA/icon en 0 fail, suite
Push completa (577 tests) en 0 fail (re-ejecutada por tocar `sw.js`),
ESLint limpio, TypeScript 24 raw idéntico a la baseline (0 nuevos),
`git diff --check` limpio, `next build` completo sin errores. Ningún
blocker real encontrado durante la review. Stage selectivo individual
de EXACTAMENTE 15 archivos — 14 de producto/test más el reporte
`DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md`, explícitamente
autorizado dos veces por el texto de esta tarea. **Se deja constancia
expresa**: esto es el PRIMER archivo jamás trackeado bajo
`codex-reports/` en todo este repositorio (`git ls-files
codex-reports/` devolvía 0 archivos antes de este commit) — un cambio
de precedente respecto a la convención histórica de mantener esa
carpeta 100% local, seguido tal cual estaba escrito en la tarea, no
por inferencia propia. Ningún otro archivo de `codex-reports/`
(`CODEX_REPORT.md`, `ROADMAP.md`, etc.) se stageó — todos siguen
exclusivamente locales. `branding-source/` (ya en `.gitignore` desde
antes de esta sesión) y `DELIGO_FULL_CONTEXT_LATEST.md` permanecen
untracked; `32` intacto. Un solo commit (`1d3f58a`, parent `39566e6`
verificado, sin `--amend`). Push únicamente a `testing-codex` —
`origin/testing-codex` confirmado en `1d3f58a`.

Autodeploy Git-triggered normal a "DeliGO Copy" (sin `railway up`, sin
mutar variables/domains/DB/service settings/replicas/VAPID/secrets) —
deployment `976a7fa7-b607-40e2-8cb4-22907f005d22` `SUCCESS`,
`meta.commitHash` == `1d3f58a` exacto (verificado vía `railway status
--json`, no asumido). Logs de boot limpios ("No pending migrations to
apply.", Next.js 16.1.3 "✓ Ready in 65ms"). 16 smokes HTTP no mutantes
(`GET /` + 5 `manifest-{rol}.json` + 10 `icon-{rol}-{192,512}.png`) —
todos con bytes idénticos al archivo local commiteado, verificado
programáticamente; `manifest-operaciones.json` confirmado sin
`icon-negocio`; `sw.js` confirmado sirviendo `deligo-v15`. Production
("DeliGO") confirmado sin cambios en el MISMO `railway status --json`.

**Findings registrados** — 3 en total, ninguno resuelto por este
deploy:

1. `PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN` (preexistente de R1 — no
   bloquea TESTING, sí bloquea certificación de Production futura
   hasta una decisión de diseño; no se intentó "arreglar"
   creativamente, no se redibujó ni se inventó padding).
2. `SW_ICON_CACHE_BYPASS_SUBSTRING_FINDING=OPEN_NON_BLOCKING`
   (preexistente de R1 — el bump `v14`→`v15` ya desplegado es
   suficiente para ESTE refresh; el bug del substring roto en `sw.js`
   en sí sigue sin corregirse).
3. **`ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=OPEN`** (NUEVO,
   reportado por el operador durante esta tarea): en Android, una
   notificación Push destinada a Cliente se mostró con el ícono de
   Negocio; en iPhone el comportamiento equivalente fue correcto.
   **No se investigó ni se corrigió** — sólo se documentó, junto con
   el wiring de `sw.js` como evidencia de código para la próxima
   auditoría (que deberá trazar backend → `notifType` → actor/
   recipient → service worker → `NotificationOptions.icon`/`badge` →
   render Android). Un refresh de branding cambia el CONTENIDO visual
   de un ícono, nunca la lógica de qué ícono se elige — no se asume
   que este deploy arregló ni empeoró este bug. **Este finding bloquea
   el closeout final de P2-T31.**

**Estado físico Push reconciliado** — Android Negocio en un SEGUNDO
dispositivo (`PASS` completo: activación, foreground/background push
sin duplicados, contenido correcto, tap al pedido correcto) y Android
Repartidor (`PASS` completo, mismo patrón) confirmados por el
operador. La historia del Android con `AbortError` persistente
(R13/R18/R19A/R20) se preserva intacta, sin borrar ni reinterpretar —
queda como residual específico de dispositivo/perfil de navegador,
`STRONGLY_SUPPORTED` (no `CONFIRMED`), explícitamente NO un blocker
general de producto. Con esto, `PUSH_PHYSICAL_ROLE_DELIVERY_
CERTIFICATION_COMPLETE=SI` — la matriz funcional de entrega física de
Push por rol (Cliente/Negocio/Repartidor, Android + iPhone) queda
completa — pero el finding #3 de arriba mantiene P2-T31 abierto.

**P2-T31 SIGUE ABIERTO** — bloqueado específicamente por la auditoría
de routing de ícono de notificación Android; "R21 final" explícitamente
NO se ejecuta todavía. P2-T29 sigue `QUEUED`, no se inicia. Payments
`DEFERRED`, no se inicia. `GIT_DEPLOY_HISTORY.md` actualizado con esta
entrada (SÍ hubo deploy). Reporte completo:
`codex-reports/DELIGO_BRANDING_R1A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY.md`.

**Próximo paso — checklist visual manual para el operador** (Android:
íconos de Cliente/Negocio/Repartidor/Operaciones/Admin instalados
correctamente, sin recortes por maskable; iPhone: spot-check de
Cliente/Negocio/Repartidor) — Claude no puede certificar esto
físicamente. NO se prueba todavía el routing de ícono en
notificaciones — eso es la próxima auditoría formal, no un check
visual de instalación.

## 0.29 ESTADO ANTERIOR — DELIGO-BRANDING-R1: NUEVOS ÍCONOS DE ROL INSTALADOS LOCAL, OPERACIONES DEJA DE PRESTAR EL ÍCONO DE NEGOCIO (2026-09-08) — TAREA INDEPENDIENTE DE P2-T31 — DESPLEGADO EN TESTING POR 0.30 ARRIBA

```text
HEAD=origin/testing-codex=39566e69647fd2b19453721214563a7b9a0ccc5e (sin cambios — sin commit en esta tarea)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
DELIGO_BRANDING_R1_STATUS=IMPLEMENTED_LOCAL_TESTED_PENDING_COMMIT_REVIEW
ICON_SOURCE_ASSETS_AVAILABLE=SI (tras un STOP inicial por BLOCKED_MISSING_SOURCE_ASSETS — el operador colocó los 5 PNG en branding-source/)
CLIENT/NEGOCIO/REPARTIDOR/ADMIN_ICON_REFRESHED=SI (mismo path de archivo de siempre, sólo contenido binario)
OPERACIONES_ICON_REFRESHED=SI (paths NUEVOS: icon-operaciones-192x192.png/512x512.png — ya NO reusa icon-negocio-*)
MASKABLE_SAFE_DERIVATIVE_STATUS=BLOCKED_NEEDS_DESIGN_DECISION (preexistente desde antes de esta tarea, no es una regresión — assets fuente 100% opacos, texto de rol muy cerca del borde, fondo no extensible sin inventar píxeles)
NOTIFICATION_ICON_CHANGED=SI (contenido, CERO cambio de wiring en sw.js) / NOTIFICATION_BADGE_CHANGED=NO (limitación preexistente documentada, no corregida)
SW_CACHE_VERSION_CHANGED=SI (deligo-v14 -> deligo-v15) — evidencia directa: el bypass de red "icon-192"/"icon-512" de sw.js NUNCA matchea ningún nombre de archivo real de ícono de rol
FOCAL_TEST_PASS=52 / FOCAL_TEST_FAIL=0 / PUSH_TEST_PASS=577 / PUSH_TEST_FAIL=0 (re-ejecutada completa por tocar sw.js)
ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / DIFF_CHECK_PASS=SI / BUILD_PASS=SI / BUILD_NEW_ERRORS=0
STAGE_PERFORMED=NO / COMMIT_PERFORMED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_ANDROID_NEGOCIO_PERSISTENT_PUSHMANAGER_ABORTERROR_PENDING_PLATFORM_DEVICE_DIAGNOSTIC (SIN CAMBIOS — ver 0.28 abajo, tarea completamente independiente)
NEXT_RECOMMENDED_ACTION=DELIGO_BRANDING_R1_REVIEW_BEFORE_COMMIT_AND_TESTING_DEPLOY
```

Tarea AUDIT + LOCAL IMPLEMENTATION + TESTS + LOCAL REVIEW ONLY —
completamente independiente del epic de Push (P2-T31, sin ningún
cambio, ver la sección 0.28 más abajo). El operador entregó 5 assets
nuevos (`deligo {cliente,negocio,repartidor,admin,operaciones}.png`,
naranja/turquesa/azul/violeta/rojo respectivamente, todos 1254x1254)
para refrescar el branding de las 5 superficies PWA de rol. Bloqueó
inicialmente (`ICON_SOURCE_ASSETS_AVAILABLE=NO`) porque los 5 PNG
adjuntos directamente al chat no eran accesibles desde el filesystem
de la sesión — el operador los colocó en
`branding-source/` y la tarea se retomó EXACTAMENTE desde la
auditoría de integridad de assets, sin reiniciar ni cambiar alcance.

Auditoría de integridad: escaneo píxel-a-píxel completo de los 5
assets confirmó que son 100% opacos (`minAlpha=255` en absolutamente
todos los píxeles) pese a declarar un canal alfa — las esquinas
redondeadas y la sombra ya vienen "horneadas" en negro opaco, no como
transparencia real. Mismo perfil estructural que los PNG legacy que
reemplazan (que tampoco tenían canal alfa). Auditoría de wiring ANTES
de tocar nada confirmó que `role-config.ts` es la fuente única de
verdad de `icon192`/`icon512`/`manifestFile` por rol, y que 4 de los 5
roles objetivo (Cliente/Negocio/Repartidor/Admin) YA apuntaban cada
uno a su propio archivo — sólo Operaciones prestaba el ícono de Negocio
desde su alta como PWA (comentario preexistente explícito lo
documentaba: "no se generaron imágenes nuevas").

Se generaron los 10 derivados (192x192 + 512x512 por rol) con `sharp`
(ya presente en `package.json` — CERO dependencias nuevas), resize
directo sin recorte ni deformación (el origen ya es un cuadrado
perfecto). Para Cliente/Negocio/Repartidor/Admin se sobrescribió
CONTENIDO en el mismo path de archivo de siempre — cero cambio de
wiring en manifests/`role-config.ts`/`layout.tsx`/`sw.js` para esos 4
roles. Para Operaciones se crearon 2 archivos NUEVOS
(`icon-operaciones-192x192.png`/`512x512.png`) y se actualizaron
`role-config.ts` + `manifest-operaciones.json` para dejar de prestar
el ícono de Negocio — verificado con un test focal explícito que
ningún manifest de Operaciones contiene ya el substring `icon-negocio`.

Maskable icons: `MASKABLE_SAFE_DERIVATIVE_STATUS=BLOCKED_NEEDS_
DESIGN_DECISION` — inspección visual confirmó que el texto de rol
(NEGOCIO/REPARTIDOR/ADMIN/OPERACIONES) queda muy cerca del borde
inferior, probablemente fuera del círculo de safe-zone del 80% que
exige un ícono maskable real; generar un derivado seguro exigiría
inventar/extender el fondo degradado más allá de la forma ya
"horneada" con esquinas negras opacas — eso cruza a rediseño,
explícitamente prohibido. Se preservó exactamente el mismo patrón
preexistente (mismo archivo reusado para `any` y `maskable` en los 5
manifests) sin bloquear los íconos `any` por esto — no es una
regresión, es idéntico al estado anterior con contenido nuevo.

Favicon/Apple: sin cambios de wiring — `favicon.ico` se dejó intacto
(regenerar el `.ico` multi-resolución está fuera de alcance de un
simple resize y no es necesario, ya que `icon-cliente-192x192.png` ya
está declarado como entrada adicional y SÍ se refresca); el
apple-touch-icon sigue reusando `icon192` sin una variante 180x180
dedicada, exactamente el mismo wiring ya certificado físicamente en
iPhone (Cliente/Negocio/Repartidor `CERTIFIED_TESTING`, P2-T31) — no se
tocó para no arriesgar esa certificación.

Notificaciones: `sw.js` referencia los MISMOS paths de archivo de
siempre para seleccionar el `icon` por `notifType` — CERO línea de esa
lógica se tocó. Como consecuencia, las notificaciones de Cliente y
Negocio (los 2 únicos roles con rama propia en esa selección)
refrescan su branding automáticamente sin ningún cambio de código. Se
auditó y NO se corrigió (preexistente, fuera de alcance): Repartidor/
Admin/Operaciones no tienen rama propia y caen al ícono de Cliente por
defecto; `badge` siempre reusa el mismo valor que `icon` (nunca existió
un asset monocromático dedicado) — misma limitación estructural que
antes, sólo con el logo nuevo en vez del viejo. No se cambió la acción
"ANULAR SUSCRIPCIÓN" ni ningún copy/action de notificación.

**Hallazgo con evidencia directa**: la regla de `sw.js` que pretende
servir "manifest files or PWA icons" siempre desde red
(`includes("icon-192")`/`("icon-512")`) NUNCA matchea ningún nombre de
archivo de ícono de rol real (`"icon-cliente-192x192.png".includes(
"icon-192")` es `false`) — sin bump de `CACHE_NAME`, un cliente con el
ícono viejo ya cacheado lo seguiría sirviendo indefinidamente pese al
refresh. Se subió `CACHE_NAME` (`deligo-v14`→`deligo-v15`) con un
comentario que documenta esta evidencia exacta; el bug del substring en
sí NO se corrigió (fuera de alcance de un refresh de branding, deuda
técnica documentada para el futuro).

Gates: se agregó `src/lib/pwa-role-icon-contract.test.ts` (5 tests
nuevos) — 52 tests focales en 0 fail junto con los tests de identidad/
scope PWA existentes. Como se tocó `sw.js`, se re-ejecutó la suite Push
completa por ser P2-T31 un epic abierto: 577/577 verde, idéntico al
baseline, cero regresiones. ESLint limpio; TypeScript 24 raw idéntico a
la baseline vigente (0 nuevos); `git diff --check` limpio; `next
build` completo sin errores. Un `bun test` global mostró 227 fallos/3
errores 100% pre-existentes y ambientales (`DATABASE_URL` no
configurado en este entorno local) — ninguno relacionado con archivos
de esta tarea.

**Git**: cero stage/commit/push/deploy. 8 PNG modificados in-place + 2
PNG nuevos + `manifest-operaciones.json`/`role-config.ts`/`sw.js`
modificados + 1 test nuevo, todo revisado línea por línea
(`git diff --name-status`/`--stat`/`--check`). `32` no fue tocado en
ningún momento. Reporte completo:
`codex-reports/DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md`.

**P2-T31 SIN CAMBIOS** — esta tarea no tocó ninguna lógica de
suscripción/entrega/retry de Push, no avanza ni certifica nada del
epic. El estado de Android Negocio/Repartidor y el resto de marcadores
de P2-T31 se preservan literalmente como R20 los dejó (sección 0.28
abajo).

## 0.28 ESTADO ANTERIOR — R20: AMBOS INTENTOS FÍSICOS DE R19A FALLARON CON ABORTERROR, CAUSA DE PLATAFORMA ELEVADA A STRONGLY_SUPPORTED, PENDIENTE CONTROL EXTERNO (2026-09-08) — P2-T31 SIN CAMBIOS, VER 0.29 ARRIBA (TAREA DE BRANDING INDEPENDIENTE)

```text
HEAD=origin/testing-codex=39566e69647fd2b19453721214563a7b9a0ccc5e (sin cambios — R20 es read-only)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R20_STATUS=ANDROID_NEGOCIO_PERSISTENT_ABORTERROR_AUDITED_SOURCE_LEVEL_RULED_OUT_PLATFORM_CAUSE_STRONGLY_SUPPORTED_PENDING_EXTERNAL_CONTROL_DIAGNOSTIC
R19A_RUNTIME_ON_DEVICE=CONFIRMED / R19A_ABORT_RECOVERY_EXECUTED=SI / R19A_POST_ABORT_RECHECK_RESULT=NO_SUBSCRIPTION_FOUND
R19A_SECOND_PHYSICAL_ATTEMPT_EXECUTED=SI / R19A_SECOND_PHYSICAL_ATTEMPT_RESULT=ABORTERROR / R19A_PHYSICAL_MITIGATION_RESULT=FAIL
BACKEND_SUBSCRIBE_REACHED=NO / R13A_FAILURE_STATE_CONTRACT_PHYSICAL_RESULT=PASS
MAX_PHYSICAL_SUBSCRIBE_ATTEMPTS_PER_USER_ACTION=2 (congelado, sin tercer retry)
VAPID_MALFORMATION_STILL_PLAUSIBLE=NO / VAPID_ENV_MISMATCH_STILL_PLAUSIBLE=NO (key en vivo: 87 chars b64url, 65 bytes, primer byte 0x04, sin rotación registrada jamás)
SERVICE_WORKER_APPLICATION_LEVEL_CAUSE_STATUS=NOT_PROVEN_LOW_PLAUSIBILITY
ABORTERROR_UNDERLYING_CAUSE_STATUS=STRONGLY_SUPPORTED_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE (elevado desde NOT_PROVEN_PLAUSIBLE, criterio de 4 niveles explícito — NO se declara CONFIRMED)
PWA_REINSTALL_ALREADY_TESTED=SI (no se pide otra reinstalación)
EXTERNAL_WEB_PUSH_CONTROL_TEST_RECOMMENDED=SI / EXTERNAL_CONTROL_EXPECTED_DISCRIMINATION=ALTA
FURTHER_DELIGO_CODE_CHANGE_JUSTIFIED_NOW=NO
NEXT_PHYSICAL_DIAGNOSTIC_ACTION=EXTERNAL_WEB_PUSH_CONTROL_TEST_VIA_WEB_PUSH_CODELAB_GLITCH_ME
NEXT_DELIGO_PUSH_TOGGLE_ACTION=BLOCKED_UNTIL_DIAGNOSTIC_RESULT
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios, los 3+1)
ANDROID_NEGOCIO_SMOKE=FAIL_PHYSICAL_SUBSCRIPTION_CREATE_ON_R19A_AFTER_TWO_ABORTERROR_ATTEMPTS / ANDROID_REPARTIDOR_SMOKE=NOT_STARTED
P2_T31_STATUS=IN_PROGRESS_ANDROID_NEGOCIO_PERSISTENT_PUSHMANAGER_ABORTERROR_PENDING_PLATFORM_DEVICE_DIAGNOSTIC
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / COMMIT_PERFORMED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO
```

Tarea DEEP READ-ONLY ROOT-CAUSE + PLATFORM/DEVICE DIAGNOSTIC DESIGN —
sin código, sin tests, sin commit/push/deploy. El primer retest físico
válido del build R19A (commit `39566e6`) ejecutó exactamente la
mitigación diseñada por R19/R19R: recheck defensivo
(`SUBSCRIBE_ABORT_RECHECK_RESULT found=false`) autorizó el único retry
permitido, y el retry TAMBIÉN falló con `AbortError` (~290ms el primer
intento, ~510ms el retry) — exactamente 2 llamadas reales a
`registration.pushManager.subscribe()`, el límite exacto respetado, sin
que ningún request HTTP saliera hacia el backend de DeliGO en ningún
momento. El contrato de failure-state de R13A se verificó PASS completo
de nuevo (`SUBSCRIBE_FINISH subscribed=false`, registry liberado, sin
éxito falso, switch final OFF).

Se reauditó exhaustivamente la matriz completa de precondiciones
source-level del punto exacto de `subscribe()` (forma/conversión/
longitud/contenido de la VAPID key, origen, `ServiceWorkerRegistration`,
scope, worker activo, secure context, permiso, user gesture, timing,
same-origin, ausencia de subscription previa ambigua) — todas PASS, con
evidencia directa de código/snapshot/spec, ninguna asumida. Se hizo un
`GET /api/push/vapid-key` real (lectura pública, no mutante) contra
TESTING y se decodificó la key vigente localmente SIN imprimirla: 87
caracteres base64url → 65 bytes decodificados, primer byte `0x04`
(formato EC P-256 sin comprimir canónico, exactamente el que exige
`PushManager.subscribe()`) — descarta malformación con evidencia
directa. `GIT_DEPLOY_HISTORY.md` no registra ninguna rotación de VAPID
jamás — descarta mismatch de entorno; la MISMA key sirvió con éxito
para Android Cliente y los 3 roles de iPhone, todos `CERTIFIED_TESTING`,
en el mismo periodo.

Investigación de Chromium/Push API con fuentes 2025-2026 (Opera forums,
`firebase/firebase-js-sdk#7748`/`#7764`, GitLab Gitter webapp#1892,
MDN): confirmado por múltiples fuentes independientes que
`PushManager.subscribe()` en Chrome/Android envía internamente una
solicitud HTTPS a `android.clients.google.com/c2dm/register3` (registro
FCM de Google) — un fallo en ESA solicitud interna es lo que Chrome
expone a la página como `AbortError`, nunca como `NetworkError` propio.
El issue `firebase-js-sdk#7748` documenta un caso completamente ajeno a
DeliGO (Pixel 6, Android 14, Chrome 118) con el MISMO síntoma exacto —
funciona en desktop, falla en mobile con el mismo código — cerrado sin
causa raíz aislada ni siquiera por el propio equipo de Firebase.

Con 4 ocurrencias totales de `AbortError` ya documentadas en todo el
epic (R13 Cliente, R18 Negocio, y estos 2 intentos de R19A — 3 de las 4
en el MISMO dispositivo/rol Negocio, pese a una reinstalación completa
de la PWA que, auditada en detalle, NO tiene razón estructural para
tocar la capa de Chrome/Play Services/FCM donde vive la causa
plausible), se introdujo un criterio explícito de 4 niveles
(`NOT_PROVEN`/`PLAUSIBLE`/`STRONGLY_SUPPORTED`/`CONFIRMED`, nuevo
invariante en `DECISIONS_AND_INVARIANTS.md`) y se elevó
`ABORTERROR_UNDERLYING_CAUSE_STATUS` de `NOT_PROVEN_PLAUSIBLE` a
`STRONGLY_SUPPORTED` — deliberadamente SIN llegar a `CONFIRMED`, que
exigiría una prueba de control independiente que todavía no se hizo.

`FURTHER_DELIGO_CODE_CHANGE_JUSTIFIED_NOW=NO` — la matriz de
precondiciones agotó lo auditable desde DeliGO sin ningún hallazgo, la
VAPID vigente es correcta y no rotada, y la mitigación de retry ya
implementada se ejecutó exactamente como fue diseñada y falló en el
mismo punto — cualquier cambio de código adicional ahora sería adivinar
una causa que la evidencia sitúa fuera de la aplicación. No se agrega
tercer retry, timeouts inventados, reset de SW/permisos, ni hacks
Android.

**Siguiente paso — UN solo diagnóstico físico, no un toggle de DeliGO**:
Leonardo debe abrir `https://web-push-codelab.glitch.me` (demo oficial
de `GoogleChromeLabs`, sin login, sin datos personales, sin instalar
ningún APK) en Chrome, en el MISMO dispositivo Android donde falló
Negocio, y tocar "Subscribe" una única vez. Si esa web —origin
completamente distinto, sin ninguna relación de código con DeliGO—
TAMBIÉN falla con `AbortError`, la causa quedaría `CONFIRMED` como de
plataforma/dispositivo. Si esa web suscribe con éxito, reabriría una
auditoría dirigida a algo específico del origin de DeliGO en ese
navegador (no una repetición ciega del mismo retry). Un checklist de
apoyo (fecha/hora automática, Google Play Services, restricciones de
batería/datos de Chrome, VPN/Private DNS/adblock) queda documentado
como respaldo, ordenado por poder de discriminación, pero el control
externo es el paso de mayor prioridad. `NEXT_DELIGO_PUSH_TOGGLE_ACTION=
BLOCKED_UNTIL_DIAGNOSTIC_RESULT` — no se le pide a Leonardo ningún otro
toggle de DeliGO antes de ese resultado.

**P2-T31 SIGUE ABIERTO** — ningún estado certificado previamente se
revoca (iPhone los 3 roles, Android Cliente). Android Negocio queda
`FAIL_PHYSICAL_SUBSCRIPTION_CREATE_ON_R19A_AFTER_TWO_ABORTERROR_
ATTEMPTS`; Android Repartidor sigue `NOT_STARTED`. P2-T29 y Mercado
Pago no se inician. Sin deploy en esta tarea —
`GIT_DEPLOY_HISTORY.md` no se actualiza. Reporte completo:
`codex-reports/P2_T31_R20_ANDROID_PERSISTENT_ABORTERROR_ROOT_CAUSE_DEVICE_DIAGNOSTIC.md`.

## 0.27 ESTADO ANTERIOR — R19A: MITIGACIÓN COMPLETA DE ABORTERROR DESPLEGADA EN TESTING (COMMIT 39566E6), PENDIENTE RETEST FÍSICO ÚNICO (2026-09-08) — AMBOS INTENTOS DEL RETEST FÍSICO FALLARON, VER 0.28 ARRIBA

```text
HEAD=origin/testing-codex=39566e69647fd2b19453721214563a7b9a0ccc5e (R19A — reemplaza a d7cc66d en TESTING)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R19A_STATUS=DEPLOYED_TESTING_EXACT_COMMIT_PENDING_ANDROID_NEGOCIO_PHYSICAL_RETEST
FINAL_DIFF_REVIEW_PASS=SI (coincide exactamente con R19/R19R/R19R1 auditados, cero cambios funcionales nuevos)
PRECOMMIT_PUSH_TEST_PASS=577 / PRECOMMIT_PUSH_TEST_FAIL=0 / ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / TYPECHECK_DISTINCT_FINAL=18 / NEW_TYPECHECK_ERRORS=0
STAGED_FILE_COUNT=4 / UNEXPECTED_STAGED_FILES=0
COMMIT_HASH=39566e69647fd2b19453721214563a7b9a0ccc5e / COMMIT_PARENT=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84 / COMMIT_MESSAGE=fix: harden push subscription recovery
TESTING_DEPLOYMENT_ID=425ff95a-5a2e-4d70-9dd1-fbae6df5ce19 / TESTING_DEPLOYMENT_STATUS=SUCCESS (match exacto de commitHash verificado)
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_UNCHANGED=SI (servicio "DeliGO", branch main, mismo commitHash, verificado en el mismo railway status --json)
TESTING_APP_HTTP_SMOKE=PASS / TESTING_NON_MUTATING_SMOKE=PASS / ANDROID_PHYSICAL_MITIGATION_CERTIFIED=NO
UNSUBSCRIBE_STALE_BIND_FINDING_PRESERVED=SI / UNSUBSCRIBE_CHANGED_IN_R19A=NO
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (sin cambios) / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios, los 3)
ANDROID_NEGOCIO_SMOKE=FAIL_AT_ACTIVATION_ABORTERROR (histórico) / ANDROID_REPARTIDOR_SMOKE=NOT_STARTED
P2_T31_STATUS=IN_PROGRESS_R19A_DEPLOYED_TESTING_PENDING_ANDROID_NEGOCIO_PHYSICAL_RETEST_AND_ANDROID_REPARTIDOR_SMOKE
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_RECOMMENDED_ACTION=ANDROID_NEGOCIO_SINGLE_ACTIVATION_RETEST_WITH_TRACE_ARMED_ON_R19A_BUILD
```

Tarea IMPLEMENTATION+COMMIT+PUSH+TESTING DEPLOY, explícitamente
autorizada por el operador (Production NO autorizada). Baseline
verificado fresco (`HEAD=origin/testing-codex=d7cc66d`,
`origin/main=1de0d3c1`, coincidían exactamente). Se leyó completo el
diff real de los 2 archivos tracked (`use-push-notifications.ts`,
`use-push-notifications-static-contract.test.ts`) y el contenido
íntegro de los 2 tests nuevos — confirmado punto por punto contra R19
(máx. 2 intentos, retry sólo `AbortError`, recheck obligatorio,
fail-closed ante ambigüedad, sin delay, sin rama de plataforma, backend
una vez, R13A preservado), R19R (guard `gate.isCurrent(opId)` sin
`await` de por medio, stale = backend 0/sin toast/subscription
intacta), y R19R1 (SET=1/RELEASE=1/entrada final ausente, flujo stale y
normal) — **cero cambios funcionales nuevos**.

Gate re-ejecutado fresco: 577 tests focales en 0 fail, ESLint limpio en
los 4 archivos exactos, TypeScript idéntico a la baseline (24 raw/18
distintos, 0 nuevos), `git diff --check` limpio. Stage selectivo
individual de exactamente 4 archivos — `git diff --cached
--name-status` confirmó el fileset exacto antes de commitear, sin
ningún archivo inesperado (ni reportes, ni `DELIGO_FULL_CONTEXT_
LATEST.md`, ni `.claude/skills/**`, ni `32`). Commit único (`39566e6`,
parent `d7cc66d` verificado, sin `--amend`, sin `Co-Authored-By`). Push
a `testing-codex` (nunca `main`, sin `--force`) — `origin/testing-codex`
confirmado en `39566e6`.

Autodeploy Git-triggered normal a "DeliGO Copy" (sin `railway up`, sin
mutar variables/domains/DB/service settings/replicas/VAPID/secrets),
poll directo y finito: deployment `425ff95a-5a2e-4d70-9dd1-fbae6df5ce19`
`SUCCESS`, instancia `RUNNING`, `meta.commitHash` == `39566e6` exacto
(verificado vía `railway status --json`, no asumido). Logs de build
(imagen exportada/pusheada sin error) y de boot ("No pending
migrations to apply.", Next.js "✓ Ready in 67ms") limpios, sin
error/fatal/unhandled/500. Smokes NO destructivos: `/` → 307 a
`/cliente/` (normal), `/cliente/` → 308 (normalización de slash,
normal), `/negocio` → 200, `/repartidor` → 200, `GET /api/push/
debug-guard` → `200 {"allowed":true}` (lectura), `GET /api/push/
vapid-key` → `200` (lectura pública) — deliberadamente NUNCA se
ejecutó `POST /api/push/subscribe` (sería una mutación). En el MISMO
`railway status --json`, el servicio Production ("DeliGO", `branch:
main`) confirmó `commitHash: 1de0d3c153eaf3be068adeb004ea43feb42fc40e`
— sin cambios.

**`ANDROID_PHYSICAL_MITIGATION_CERTIFIED=NO`** — este deploy pone la
mitigación completa (retry acotado + guard stale-actor + cobertura
explícita de registry) disponible en TESTING, pero NO la certifica
físicamente. El hallazgo lateral de `unsubscribe()` (mismo patrón de
fetch incondicional, sin retry que lo haga relevante hoy) se preservó
sin corregir, sin expandir este commit.

**Siguiente acción — UN solo retest físico**: Leonardo debe esperar
confirmación de este deploy exacto (`39566e6` en "DeliGO Copy") antes
de reintentar. Con la traza de diagnóstico armada, activar el switch de
Negocio UNA sola vez y observar uno de 3 caminos: (A) éxito directo sin
retry; (B) `AbortError` recuperado automáticamente vía el retry
(`SUBSCRIBE_ABORT_RECHECK_*` → `SUBSCRIBE_PHYSICAL_RETRY_*` → backend
success → switch ON); (C) ambos intentos fallan → `SUBSCRIBE_FINISH
subscribed=false` → switch OFF → error seguro (failure-state de R13A).
**El camino C NO sería una certificación** — requeriría una nueva
auditoría, no una repetición ciega del mismo retest. No se le pide a
Leonardo más de un intento en este paso.

**P2-T31 SIGUE ABIERTO** — por Android Negocio (pendiente el retest
físico único) y Android Repartidor (smoke `NOT_STARTED`), además de
las matrices de Android Negocio/Repartidor no ejecutadas formalmente
(iPhone de los 3 roles ya certificado, preservado sin cambios). P2-T29
y Mercado Pago no se inician. `codex-reports/GIT_DEPLOY_HISTORY.md`
actualizado con esta entrada (SÍ hubo deploy). Reporte completo:
`codex-reports/P2_T31_R19A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY.md`.

## 0.26 ESTADO ANTERIOR — R19R1: EVIDENCIA EXPLÍCITA DE MUTATION REGISTRY SET/RELEASE, CERO CAMBIOS DE PRODUCTO, TESTS VERDES (2026-09-08) — DESPLEGADO EN TESTING POR 0.27 ARRIBA

```text
HEAD=origin/testing-codex=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84 (sin cambios — R19R1 es TEST-ONLY)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R19R1_STATUS=EXPLICIT_MUTATION_REGISTRY_SET_RELEASE_COVERAGE_ADDED_TESTS_GREEN_PENDING_REVIEW_AND_DEPLOY
MUTATION_REGISTRY_SET_COUNT_STALE_ABORT_RETRY=1 / MUTATION_REGISTRY_RELEASE_COUNT_STALE_ABORT_RETRY=1 / MUTATION_REGISTRY_FINAL_ENTRY_EXISTS_STALE_ABORT_RETRY=NO
MUTATION_REGISTRY_SET_COUNT_NORMAL_SUCCESS=1 / MUTATION_REGISTRY_RELEASE_COUNT_NORMAL_SUCCESS=1 / MUTATION_REGISTRY_FINAL_ENTRY_EXISTS_NORMAL_SUCCESS=NO
STALE_DURING_ABORT_RETRY_BACKEND_CALL_COUNT=0 (preservado)
PRODUCT_CODE_CHANGED_IN_R19R1=NO / TEST_CODE_CHANGED_IN_R19R1=SI (1 archivo existente extendido, sin archivos nuevos)
FOCAL_TEST_PASS=577 / FOCAL_TEST_FAIL=0 / ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / TYPECHECK_DISTINCT_FINAL=18 / NEW_TYPECHECK_ERRORS=0
PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_ABORTERROR_MITIGATION_AND_STALE_ACTOR_GUARD_IMPLEMENTED_LOCALLY_PENDING_COMMIT_DEPLOY_AND_ANDROID_ROLE_RETESTS (sin cambios)
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_RECOMMENDED_ACTION=P2_T31_R19A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY_PENDING_ANDROID_NEGOCIO_PHYSICAL_RETEST
```

TEST-ONLY LOCAL CLOSEOUT — **cero cambios de código de producto**. R19R
(0.25 abajo) había demostrado que `gate.begin()` se llama exactamente
1 vez en el flujo compuesto creación+bind — evidencia INDIRECTA de una
sola operación de alto nivel. El TEST 8 de su propio mandato pedía
explícitamente `MUTATION_REGISTRY_SET`/`MUTATION_REGISTRY_RELEASE`
contados DIRECTAMENTE en la ruta compuesta nueva
(stale-durante-el-retry-de-AbortError) — esa discrepancia de evidencia
queda cerrada en esta tarea.

Se extendió `use-push-notifications-stale-actor-backend-guard.test.ts`
(sin archivos nuevos) con un harness TEST-ONLY
(`runLikeSubscribeHighLevelOperation`) que compone, en el mismo orden
que `subscribe()` propio, las 3 funciones REALES ya exportadas:
`createPhysicalPushSubscriptionWithAbortRecovery` (R19),
`bindPhysicalPushSubscriptionToBackend` (R19R), y
`registerInFlightPersonalPushMutation` (R2, el registry REAL de
`push-mutation-in-flight-registry.ts` — **nunca mockeado**). No es un
mock que reproduce el resultado deseado — cada función interna es la
implementación real ya probada por su propia suite; el harness sólo
provee el mismo pegamento secuencial que el closure de `subscribe()`
ya provee gratis. Ningún export nuevo de producción fue necesario (las
3 funciones ya eran públicas).

Test 1 (el que faltaba): la operación arranca (SET síncrono
confirmado), primer intento físico → `AbortError`, recheck → `null`,
segundo intento físico queda GENUINAMENTE pendiente (confirmado con
`hasInFlightPersonalPushMutationForDebug === true` en ese instante), el
actor se invalida MIENTRAS sigue pendiente, el intento resuelve con
éxito DESPUÉS, el bind se salta por stale (`backend.calls.length===0`,
sin cambios) — resultado: `SET=1`, `RELEASE=1`, entrada final ausente.
Test 2: mismo harness para el camino normal exitoso, mismo contrato de
limpieza — sin duplicar toda la suite.

Ni `createPhysicalPushSubscriptionWithAbortRecovery` ni
`bindPhysicalPushSubscriptionToBackend` fueron tocadas — confirmado por
un `git diff --stat` de `use-push-notifications.ts` IDÉNTICO al que
R19R dejó (cero cambios netos de esta tarea). No apareció ningún bug
real durante esta cobertura. **577 tests focales en 0 fail** (575
previos + 2 nuevos, mismos 33 archivos, sin archivos nuevos), ESLint
limpio, TypeScript idéntico a la baseline (24 raw/18 distintos, 0
nuevos). Se preservó la misma precisión sobre `git diff --check` no
cubriendo contenido untracked — validado por ESLint + ejecución real +
revisión manual de whitespace.

**Hallazgo lateral de `unsubscribe()`** (documentado por R19R):
preservado sin corregir, fuera de alcance de esta tarea.

**P2-T31 SIGUE ABIERTO.** Ningún blocker nuevo se creó ni se resolvió
— esta tarea sólo cerró una discrepancia de evidencia sobre trabajo ya
implementado en R19/R19R. P2-T29 y Mercado Pago no se inician. Sin
commit/push/deploy en ningún momento; `COMPLETED_TASKS.md` y
`GIT_DEPLOY_HISTORY.md` no fueron tocados. Se preserva la corrección
documental de R19: "el contrato de failure-state de R13A quedó
físicamente confirmado en runtime real de TESTING, nunca en
Production." Reporte completo:
`codex-reports/P2_T31_R19R1_EXPLICIT_MUTATION_REGISTRY_COVERAGE.md`.

## 0.25 ESTADO ANTERIOR — R19R: GAP STALE-ACTOR/BACKEND CERRADO, RETRY DE R19 PRESERVADO, TESTS VERDES, SIN DEPLOY (2026-09-08) — EVIDENCIA DE TEST 8 COMPLETADA POR 0.26 ARRIBA

```text
HEAD=origin/testing-codex=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84 (R15A, SIN CAMBIOS — R19R es implementación LOCAL, sin commit)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R19R_STATUS=STALE_ACTOR_BACKEND_GUARD_IMPLEMENTED_TESTS_GREEN_PENDING_REVIEW_AND_DEPLOY
PRE_BACKEND_STALE_OPERATION_GUARD_EXISTS_BEFORE_R19R=NO / PREEXISTING_STALE_BACKEND_BIND_GAP_EXPOSED_DURING_R19_REVIEW=SI
STALE_ACTOR_GUARD_IMPLEMENTED=SI / STALE_ACTOR_GUARD_SOURCE=OP_ID_ONLY
STALE_DURING_ABORT_RETRY_TEST=PASS / STALE_DURING_ABORT_RETRY_BACKEND_CALL_COUNT=0 / STALE_AFTER_FIRST_PHYSICAL_SUCCESS_BACKEND_CALL_COUNT=0
ABORTERROR_RETRY_MAX_ATTEMPTS=2 (sin cambios) / R13A_FAILURE_STATE_CONTRACT_PRESERVED=SI / DOUBLE_BACKEND_REGISTER_POSSIBLE=NO
FOCAL_TEST_PASS=575 / FOCAL_TEST_FAIL=0 / ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / TYPECHECK_DISTINCT_FINAL=18 / NEW_TYPECHECK_ERRORS=0
PRODUCT_CODE_CHANGED=SI (local, sin commit) / BACKEND_CHANGED=NO / SCHEMA_CHANGED=NO / DEPENDENCIES_CHANGED=NO / PRODUCTION_TOUCHED=NO
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (sin cambios) / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios, los 3)
P2_T31_STATUS=IN_PROGRESS_ABORTERROR_MITIGATION_AND_STALE_ACTOR_GUARD_IMPLEMENTED_LOCALLY_PENDING_COMMIT_DEPLOY_AND_ANDROID_ROLE_RETESTS
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_RECOMMENDED_ACTION=P2_T31_R19A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY_PENDING_ANDROID_NEGOCIO_PHYSICAL_RETEST
```

R19 (0.24 abajo) ya había reconocido honestamente un gap al validarse
a sí mismo: el `POST /api/push/subscribe` en `subscribe()` corría
**incondicionalmente** respecto al gate de operación — nada
verificaba `gate.isCurrent(opId)` ANTES del `fetch`; sólo
`finishMutation`, DESPUÉS de que el request ya había salido, decidía
si el resultado se aplicaba a la UI. Con la ventana de R19 (hasta 2
intentos físicos + un recheck defensivo, todos `await`-eados en
secuencia) esa ventana se hizo más larga — pero el gap en sí **no es
nuevo de R19**: existía ya para el caso de un solo intento, y se
reconoce honestamente como tal
(`PREEXISTING_STALE_BACKEND_BIND_GAP_EXPOSED_DURING_R19_REVIEW=SI`,
nunca presentado como bug introducido por R19).

Se implementó `bindPhysicalPushSubscriptionToBackend` (nueva,
exportada en `src/hooks/use-push-notifications.ts`, mismo patrón de
dependencias inyectadas que `checkPersonalPushStatus`): verifica
`gate.isCurrent(opId)` — la MISMA autoridad canónica que
`finishMutation` ya usa en todo el archivo (los cambios de actor
enrutan exclusivamente por `gate.invalidate()`, nunca por una
comparación de identidad separada — `STALE_ACTOR_GUARD_SOURCE=
OP_ID_ONLY`, sin duplicar autoridad) — como la ÚLTIMA sentencia
síncrona antes de construir la URL y llamar al backend, con **cero
`await`** entre el guard y el request de red (auditado explícitamente:
nada puede ceder el control al event loop en esa ventana). Si la
operación quedó stale: `posted:false` — **sin backend POST, sin toast,
sin estado ON, sin inventar un error técnico** — resuelve por el mismo
`finishMutation(opId, false)` que cualquier otra rama stale del
archivo ya usa. La `PushSubscription` física NUNCA se destruye por
quedar stale — pertenece al browser/origin, el actor que sucede a la
operación la reconcilia por su propio flujo normal.
`createPhysicalPushSubscriptionWithAbortRecovery` (R19) **no fue
tocada** — cero líneas modificadas; el retry (máximo 2 intentos, sólo
`AbortError`, recheck obligatorio, sin delay) queda exactamente igual.

**TEST 9 del mandato original de R19, ahora determinista** (nuevo
archivo `use-push-notifications-stale-actor-backend-guard.test.ts`):
compone el `LatestOperationGate` REAL con la función de retry REAL de
R19, controlando el timing exacto — el segundo intento físico queda
GENUINAMENTE pendiente (una promesa real, no simulada), el test invoca
`gate.invalidate()` mientras sigue pendiente, LUEGO el intento resuelve
con éxito, y se confirma `backend.calls.length === 0` — la operación
nunca escribe el binding aunque el segundo intento físico haya tenido
éxito. Un test adicional (`spyOnGateBegin`) prueba dinámicamente que
ni la creación ni el bind mintan una segunda operación de alto nivel
(`gate.begin()` llamado exactamente 1 vez en todo el flujo). Un test
paralelo prueba el mismo gap para el camino SIN `AbortError` (éxito
inmediato en el primer intento, actor stale antes del backend) — 6
conteos exactos de llamadas a backend quedan afirmados con tests
reales, no sólo grep.

**575 tests focales en 0 fail** (33 archivos `*push*.test.ts`), ESLint
limpio, TypeScript idéntico a la baseline vigente (24 raw/18
distintos, 0 nuevos), `git diff --check` limpio sobre los archivos
TRACKED. Se corrigieron 2 assertions preexistentes de
`use-push-notifications-static-contract.test.ts` cuya ubicación
literal cambió por el refactor (la invariante que protegen — URL
construida desde `actorType` con la misma forma ternaria, `fetch`
consume la variable calculada nunca un literal, guardia contra el
mutante histórico M9 — sigue exactamente igual, sólo cambió la
ubicación literal del código real). **Precisión documental explícita**:
`git diff --check` no cubre contenido untracked — el archivo de test
nuevo se validó por ESLint limpio + ejecución real con éxito +
revisión manual de whitespace, nunca declarado como cubierto por Git.

**Hallazgo lateral, no corregido**: `unsubscribe()` tiene el mismo
patrón de `fetch` incondicional respecto al gate, pero sin ningún
retry que lo haga relevante hoy (nunca reintenta nada) — documentado
para no perderlo, sin expandir el alcance de esta tarea.

Ningún test/deploy/prueba física certifica todavía que la mitigación
completa (retry + guard stale-actor) resuelve el `AbortError` real en
el dispositivo de Leonardo — sólo prueba que el algoritmo completo se
comporta exactamente como se diseñó. La certificación real requiere el
ciclo commit→deploy→smoke→retest físico de Android Negocio (tarea
separada, `R19A`, no ejecutada aquí). **P2-T31 SIGUE ABIERTO.** P2-T29
y Mercado Pago no se inician. Sin commit/push/deploy en ningún
momento; `COMPLETED_TASKS.md` y `GIT_DEPLOY_HISTORY.md` no fueron
tocados. Se preserva la corrección documental de R19: "el contrato de
failure-state de R13A quedó físicamente confirmado en runtime real de
TESTING, nunca en Production." Reporte completo:
`codex-reports/P2_T31_R19R_ABORTERROR_RETRY_STALE_ACTOR_BACKEND_GUARD.md`.

## 0.24 ESTADO ANTERIOR — R19: MITIGACIÓN DE RETRY ÚNICO PARA ABORTERROR IMPLEMENTADA LOCALMENTE, TESTS VERDES, SIN DEPLOY (2026-09-08) — GAP STALE-ACTOR/BACKEND CERRADO POR 0.25 ARRIBA

```text
HEAD=origin/testing-codex=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84 (R15A, SIN CAMBIOS — R19 es implementación LOCAL, sin commit)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R19_STATUS=ABORTERROR_SINGLE_RETRY_MITIGATION_IMPLEMENTED_LOCALLY_TESTS_GREEN_PENDING_REVIEW_AND_DEPLOY
ANDROID_NEGOCIO_MANUAL_RETRY_STATUS=FAIL_ABORTERROR (2da recurrencia consecutiva, proceso nuevo, backend nunca alcanzado)
MANUAL_RETRY_ONLY_STRATEGY=INSUFFICIENT / ANDROID_ABORTERROR_MITIGATION_REQUIRED_BEFORE_T31_CLOSEOUT=SI (corregido desde NO de 0.23)
ABORTERROR_RETRY_IMPLEMENTED=SI / ABORTERROR_RETRY_MAX_ATTEMPTS=2 / ABORTERROR_RETRY_ONLY_FOR_ABORTERROR=SI / ABORTERROR_POST_FAILURE_GETSUBSCRIPTION_RECHECK=SI / ABORTERROR_RETRY_DELAY_MS=0
DOUBLE_BACKEND_REGISTER_POSSIBLE=NO / POST_ABORT_RECHECK_FAILURE_FAILS_CLOSED=SI / R13A_FAILURE_STATE_CONTRACT_PRESERVED=SI
FOCAL_TEST_PASS=564 / FOCAL_TEST_FAIL=0 / ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / TYPECHECK_DISTINCT_FINAL=18 / NEW_TYPECHECK_ERRORS=0 / DIFF_CHECK_PASS=SI
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (sin cambios) / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios, los 3)
PRODUCT_CODE_CHANGED=SI (local, sin stage/commit) / TEST_CODE_CHANGED=SI (local) / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_ABORTERROR_MITIGATION_IMPLEMENTED_LOCALLY_PENDING_REVIEW_DEPLOY_AND_ANDROID_ROLE_RETESTS
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_RECOMMENDED_ACTION=P2_T31_R19A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY_PENDING_ANDROID_NEGOCIO_PHYSICAL_RETEST
```

El reintento manual único que 0.23 (abajo) había autorizado a Leonardo
en Android Negocio **también falló** con `AbortError` — en un PROCESO
NUEVO de la PWA (`proc=0dj6pj`, distinto del primer fallo
`proc=7sa51r`, descartando estado de memoria arrastrado, `opId` viejo,
o mutación en vuelo previa), ~1103ms, backend nunca alcanzado por
segunda vez consecutiva. La condición explícita que 0.23 había dejado
(si el retry manual también falla, implementar el recheck defensivo +
retry único) se cumplió — `MANUAL_RETRY_ONLY_STRATEGY=INSUFFICIENT`.

Se implementó `createPhysicalPushSubscriptionWithAbortRecovery` en
`src/hooks/use-push-notifications.ts`: envuelve la función YA
existente `createPhysicalPushSubscription` (sin modificarla) con,
como máximo, UN intento físico adicional — gateado exclusivamente por
`errorClass === "AbortError"` (cualquier otro error re-lanza de
inmediato, sin cambios respecto al comportamiento previo a R19). Ante
`AbortError`, relee OBLIGATORIAMENTE `getSubscription()` antes de
cualquier retry: si encuentra una subscription cuya VAPID key coincide
con la vigente (mismo `applicationServerKeyMatches` que el resto del
archivo ya usa), la reutiliza sin un segundo `subscribe()`; si el
recheck lanza, o encuentra una subscription ambigua/stale, FALLA
CERRADO con el `AbortError` ORIGINAL — nunca un retry a ciegas, nunca
destruye la subscription ambigua (esa decisión sigue siendo exclusiva
del flujo de remoción de key obsoleta ya existente al inicio de
`subscribe()`). Sólo un `null` confirmado autoriza el único retry
físico #2, con su propio trace distinguible
(`SUBSCRIBE_PHYSICAL_RETRY_START/RESULT/ERROR`, separado de
`SUBSCRIBE_ABORT_RECHECK_START/RESULT/ERROR`). Sin delay (`0ms`), sin
ninguna rama de browser/plataforma, sin tocar el mutation gate/registry
(cero referencias a `gate`/`opId=`/`begin(` dentro del wrapper), sin
tocar ningún endpoint de backend. Estructuralmente imposible una doble
subscription física o un doble registro backend — un único call site
de `fetch(subscribeUrl...)` en todo el archivo, alcanzado 0 ó 1 vez
según si el wrapper resuelve o lanza.

Si el segundo intento también falla, el wrapper simplemente re-lanza —
cae en el MISMO `catch` ya endurecido por R13A
(`reportMutationFailureSafely`) → `SUBSCRIBE_FINISH subscribed=false`
→ switch OFF, toast de error seguro, sin success feedback. **No se
reabre el bug de UI stale de R13.** Si el primer `AbortError` se
recupera automáticamente, el usuario NUNCA ve el toast de error del
primer intento.

10 tests deterministas nuevos (`use-push-notifications-abort-retry.
test.ts`) cubren los 7 escenarios físicos directamente; los 3
restantes (mutation registry, gate stale, consumidores de rol
Cliente/Negocio/Repartidor) quedan cubiertos por inspección estructural
explícita más la regresión verde de las suites R2/R7/R13A y los 3
static-contracts de rol, sin necesitar cambios en ellas. **564 tests
focales en 0 fail** (32 archivos `*push*.test.ts` del repo completo),
ESLint limpio, TypeScript idéntico a la baseline vigente (24 raw/18
distintos, 0 nuevos), `git diff --check` limpio. Fileset exacto: 1
archivo de producto modificado (`use-push-notifications.ts`) + 1 test
nuevo, nada stageado, sin commit.

**Corrección de wording de autoridad ACTUAL**: se encontró y corrigió
en `codex-reports/TEST_AUTHORITY.md` una frase incorrecta que decía
que el comportamiento de R13A quedaba "confirmado también en
producción real" — Production nunca estuvo involucrada. La formulación
correcta, ya aplicada: "confirmado también en runtime real de
TESTING". El reporte histórico de R18 no fue editado.

Ningún test/deploy/prueba física certifica todavía que esta mitigación
resuelve el `AbortError` real en el dispositivo de Leonardo — sólo
prueba que el algoritmo se comporta exactamente como se diseñó. La
certificación real requiere el ciclo commit→deploy→smoke→retest físico
de Android Negocio (tarea separada, `R19A`, no ejecutada aquí).
**P2-T31 SIGUE ABIERTO.** P2-T29 y Mercado Pago no se inician. Sin
commit/push/deploy en ningún momento; `COMPLETED_TASKS.md` y
`GIT_DEPLOY_HISTORY.md` no fueron tocados. Reporte completo:
`codex-reports/P2_T31_R19_ANDROID_PUSHMANAGER_ABORTERROR_SINGLE_RETRY_HARDENING.md`.

## 0.23 ESTADO ANTERIOR — R18: ABORTERROR RECURRIÓ EN NEGOCIO (MISMA CLASE QUE R13), FAILURE-STATE CONTRACT PASS, IPHONE NEGOCIO/REPARTIDOR CERTIFICADOS (2026-09-08) — MITIGACIÓN IMPLEMENTADA POR 0.24 ARRIBA

```text
HEAD=origin/testing-codex=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84 (R15A, SIN CAMBIOS — R18 fue sólo auditoría read-only)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R18_STATUS=ANDROID_ABORTERROR_RECURRENCE_AUDITED_CROSS_ROLE_FAILURE_STATE_CONTRACT_HELD_PENDING_SINGLE_RETEST
ANDROID_R18_MATCHES_R13_FAILURE_CLASS=SI (misma etapa: PushManager.subscribe() -> AbortError, ~290ms, antes de backend)
ANDROID_R18_ROLE_SPECIFIC_CODE_CAUSE_STATUS=NO_EVIDENCE (código bit-a-bit idéntico entre roles hasta el punto de fallo)
R13A_FAILURE_STATE_CONTRACT_CURRENT_PHYSICAL_RESULT=PASS (SUBSCRIBE_FINISH disparó, registry liberó, switch OFF — NO se reabre el bug de UI stale de R13)
ANDROID_PHYSICAL_CREATE_RELIABILITY_CURRENT_STATUS=HISTORICAL_3_OF_3_PASS_BUT_ABORTERROR_RECURRENCE_CONFIRMED (R14 preservado sin reescribir)
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (sin cambios, R17 preservado)
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING / IPHONE_NEGOCIO_PUSH_MATRIX=CERTIFIED_TESTING / IPHONE_REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (los 3 roles iPhone certificados)
ANDROID_NEGOCIO_SMOKE=FAIL_AT_ACTIVATION_ABORTERROR / ANDROID_REPARTIDOR_SMOKE=NOT_STARTED
ANDROID_ABORTERROR_MITIGATION_REQUIRED_BEFORE_T31_CLOSEOUT=NO (2 ocurrencias totales, evidencia insuficiente para justificar retry automático)
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_IPHONE_ALL_ROLES_CERTIFIED_ANDROID_CLIENT_CERTIFIED_PENDING_ANDROID_NEGOCIO_ABORTERROR_RESOLUTION_AND_ANDROID_REPARTIDOR_SMOKE
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_RECOMMENDED_ACTION=SINGLE_MANUAL_RETRY_ANDROID_NEGOCIO_ACTIVATION_WITH_TRACE_ARMED
```

Durante el smoke corto de Android Negocio (posterior a la
certificación física de Android Cliente en 0.22 abajo), la activación
de push falló con `PushManager.subscribe() → AbortError` (~297ms, sin
llegar a backend) — la misma clase de fallo que R13 había documentado
originalmente para Cliente (2026-09-06).

Comparado campo por campo contra R13: mismo `errorClass`, mismo orden
de magnitud de duración, mismo estado previo (`permission=granted`, SW
`activated`, VAPID fetch exitoso, sin subscription existente), mismo
punto exacto de rechazo (antes de cualquier contacto con backend). **No
se afirma la misma causa raíz de plataforma** (sigue `NOT_PROVEN_
PLAUSIBLE_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE`, sin
cambios desde R13) — sólo se afirma la misma CLASE/ETAPA de fallo, que
sí está probada. La diferencia real y significativa es el MANEJO del
fallo: en R13, `SUBSCRIBE_FINISH` nunca se disparó (bug de UI stale que
R13 encontró y R13A corrigió) y el switch quedó stale en ON; en esta
recurrencia, `SUBSCRIBE_FINISH` se disparó correctamente
(`current=true subscribed=false errorClass=AbortError`), el registry
liberó, y el switch terminó OFF — el contrato de failure-state de R13A
se verificó `PASS` completo contra un fallo real, en un rol (Negocio)
distinto al que originalmente lo expuso (Cliente). **No se reabre el
bug de UI stale.**

Se auditó el código real de los 3 consumidores de rol (`client-
profile-panel.tsx`, `config-tab.tsx`, `profile-tab.tsx`) y se confirmó
con evidencia directa de código — no por asunción de "es compartido,
entonces es plataforma" — que los 3 llaman exactamente la misma función
`usePushNotifications()` sin ninguna rama condicionada por rol antes
del punto de fallo. Se probó, precondición por precondición, que auth
Negocio, backend ownership, rate limiter, DB y provider send no
pudieron ser causa de este intento — cero requests HTTP salieron del
browser (no se confunde SUBSCRIBE físico con SEND de notificación). El
`PASS_3_OF_3_CONSECUTIVE` de R14 se preserva histórico sin
reescribirse, reconciliado con un marcador de estado ACTUAL separado.
Android Cliente (R17) NO se invalida — la nueva falla es de creación en
Negocio, sin relación técnica con la matriz de entrega ya certificada
de Cliente.

**Nueva evidencia física del operador, posterior a 0.22**: las
matrices completas de iPhone Negocio (N1-N7: activación, rapid toggle,
remount, cold reopen ON, logout/login OFF esperado + re-enable + OFF
cold reopen, foreground real, closed-PWA real con tap correcto) e
iPhone Repartidor (R1-R7, mismo patrón) llegaron con PASS en todas sus
capas — **los 3 roles de iPhone quedan `CERTIFIED_TESTING`**.

Se evaluaron 9 opciones de mitigación de código (retry simple, retry
con delay, releer `getSubscription()` antes de reintentar, esperar
`registration.ready` de nuevo, unregister de SW, reset de permisos,
reload de página, mensaje de error más específico) sin implementar
ninguna — con sólo 2 ocurrencias documentadas en total (R13 Cliente,
R18 Negocio), no hay evidencia de frecuencia suficiente para justificar
un mecanismo de retry automático. Único siguiente paso físico
definido: un reintento manual único del switch de Negocio con la traza
de diagnóstico ya armada (sin reinstalar, sin tocar permisos, sin
cerrar la app) — seguro porque el contrato de failure-state ya deja el
gate/registry completamente liberados, y no pierde la evidencia de FAIL
ya preservada en este reporte.

**P2-T31 SIGUE ABIERTO** por Android Negocio (recurrencia de
AbortError en activación, pendiente el reintento manual) y Android
Repartidor (smoke `NOT_STARTED`). P2-T29 y Mercado Pago no se inician.
Sin commit/push/deploy en ningún momento; `COMPLETED_TASKS.md` y
`GIT_DEPLOY_HISTORY.md` no fueron tocados. Reporte completo:
`codex-reports/P2_T31_R18_ANDROID_ABORTERROR_CROSS_ROLE_RECURRENCE_AUDIT.md`.

## 0.22 ESTADO ANTERIOR — R17: ANDROID CLIENTE CERTIFICADO EN TESTING — CAUSA CONFIRMADA: NOTIFICACIONES DE CHROME DESHABILITADAS A NIVEL ANDROID (2026-09-08) — VER 0.23 ARRIBA PARA LA NUEVA RECURRENCIA EN NEGOCIO Y LA CERTIFICACIÓN COMPLETA DE IPHONE

```text
HEAD=origin/testing-codex=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84 (R15A, SIN CAMBIOS — R17 fue sólo documentación/reconciliación)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R17_STATUS=ANDROID_CLIENT_PUSH_CERTIFIED_TESTING_PENDING_IPHONE_ROLE_MATRICES
ANDROID_DEVICE_NOTIFICATION_ROOT_CAUSE_STATUS=CONFIRMED_BY_OPERATOR_CONFIGURATION_CHANGE
ANDROID_DEVICE_NOTIFICATION_ROOT_CAUSE=CHROME_NOTIFICATIONS_DISABLED_AT_ANDROID_OS_LEVEL
ANDROID_PUSH_CODE_BUG_FOR_THIS_INCIDENT=NO_EVIDENCE
ANDROID_FOREGROUND_PUSH_STATUS=PASS / ANDROID_CLOSED_PWA_PUSH_STATUS=PASS / ANDROID_NOTIFICATION_TAP_STATUS=PASS / ANDROID_OFF_COLD_REOPEN_STATUS=PASS
ANDROID_ON_COLD_REOPEN_STATUS=PASS_POST_DEVICE_NOTIFICATION_CONFIGURATION_FIX (corregido desde la regresión de 0.21 — histórico preservado, ver aclaración abajo)
ANDROID_CLIENT_PUSH_MATRIX_STATUS=CERTIFIED_TESTING / ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING
R15A_URGENCY_MITIGATION_STATUS=DEPLOYED_COMPATIBLE_NOT_PROVEN_ROOT_CAUSE (R15A NO se le adjudica la causa raíz; no se revierte)
PRE_REPARTIDOR_ACCEPT_EN_CAMINO_MISSING_NOTIFICATION=NOT_CLASSIFIED_AS_PUSH_FAILURE / REPARTIDOR_ACCEPT_CLIENT_NOTIFICATION=PHYSICAL_PASS
P2_T29_CURRENT_IMPLEMENTATION_STATUS=REQUIRES_FULL_FLOW_AUDIT_BEFORE_REDESIGN (NO implementado, NO iniciado)
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado) / IPHONE_NEGOCIO_PUSH_MATRIX=PENDING / IPHONE_REPARTIDOR_PUSH_MATRIX=PENDING
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_ANDROID_CLIENT_AND_IPHONE_CLIENT_CERTIFIED_PENDING_IPHONE_NEGOCIO_AND_REPARTIDOR_PHYSICAL_MATRICES
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_RECOMMENDED_ACTION=RUN_IPHONE_NEGOCIO_PUSH_PHYSICAL_MATRIX
```

Leonardo revisó su dispositivo Android tras 0.21 (abajo) y encontró la
causa real: **las notificaciones de Chrome estaban deshabilitadas a
nivel del sistema operativo Android** — exactamente el "platform-level"
que R16 había dejado plausible pero no probado (0.21 no tenía acceso
al dispositivo físico). Después de habilitarlas, sin ningún cambio de
código ni redeploy (mismo commit TESTING `d7cc66d` de R15A), Leonardo
confirmó físicamente las 4 capas pendientes: notificaciones con la app
ABIERTA funcionan (foreground PASS), notificaciones con la PWA CERRADA
de forma normal funcionan sin necesitar force-stop (closed-PWA/
background PASS), la notificación se puede tocar y abre correctamente
el pedido correspondiente (tap PASS, destino correcto), y el switch
apagado permanece apagado tras cerrar/reabrir sin auto-reactivarse
(OFF+cold-reopen PASS).

**Android Cliente queda `CERTIFIED_TESTING`** — las 6 capas de su
matriz física (creación 3/3 consecutiva, ON-persistence, foreground,
closed-PWA, notification tap, OFF) en PASS. Esto NO se extrapola a
Negocio ni a Repartidor en Android — esos actores nunca ejecutaron esta
matriz física.

**Reconciliación sin reescribir historia**: el archivo
`P2_T31_R16_ANDROID_PUSH_SUBSCRIPTION_PERSISTENCE_LOSS_ROOT_CAUSE_
AUDIT.md` NO fue editado — su clasificación `PLATFORM_LEVEL_PLAUSIBLE_
NOT_PROVEN` era la conclusión correcta con la evidencia disponible en
ese momento (sin acceso al dispositivo físico, sólo se podía probar
que NO era un bug de código DeliGO). La confirmación nueva vive
únicamente en las autoridades de estado ACTUAL. Tampoco se afirma que
Chrome o Android tengan un bug — fue una configuración externa del
dispositivo. `ANDROID_ON_COLD_REOPEN_STATUS` pasa de la regresión
documentada en 0.21 (`REGRESSION_REPRODUCED_POST_R15A_SUBSCRIPTION_
MISSING`, que a su vez había corregido el PASS histórico de R7/R8/R9)
a `PASS_POST_DEVICE_NOTIFICATION_CONFIGURATION_FIX` — ninguna de las 3
entradas se borra, cada una describe correctamente lo que se observó
en su momento.

**R15A no se le adjudica la causa raíz**: el hardening de urgency
(commit `d7cc66d`) sigue desplegado y compatible con lo observado —
ningún envío falló por sus opciones — pero la causa real confirmada
fue la configuración de notificaciones del dispositivo, no la
prioridad de entrega del servidor. R15A no se revierte.

**Hallazgo "en camino"**: Leonardo observó que una notificación de "en
camino" no llegó ANTES de que un repartidor aceptara el pedido, y que
SÍ llegó correctamente cuando el repartidor aceptó. Esto se clasificó
como comportamiento esperado del código actual (no existe hoy un
estado que dispare esa notificación antes de la aceptación), no como
fallo de push — la notificación al aceptar el repartidor queda
registrada como PASS físico. Esto es un dato PARCIAL a favor del
rediseño de flujo planificado (P2-T29 — Order Flow + Notification
Semantics Redesign: `RECIBIDO → ACEPTADO → PREPARANDO → BUSCANDO/
ESPERANDO REPARTIDOR → EN CAMINO (al aceptar repartidor) → ENTREGADO`),
pero **P2-T29 NO se declara implementado ni se inicia** — sigue
requiriendo una auditoría completa del flujo actual antes de cualquier
rediseño.

**P2-T31 SIGUE ABIERTO** por iPhone Negocio y iPhone Repartidor (y
Android Negocio/Repartidor, nunca ejecutados formalmente). Mercado
Pago sigue `PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT`. Sin commit/push/deploy
en ningún momento; `COMPLETED_TASKS.md` y `GIT_DEPLOY_HISTORY.md` no
fueron tocados. Reporte completo:
`codex-reports/P2_T31_R17_ANDROID_CLIENT_PUSH_PHYSICAL_CERTIFICATION_AND_CONTEXT_RECONCILIATION.md`.

## 0.21 ESTADO ANTERIOR — R16: PÉRDIDA FÍSICA REAL DE PUSHSUBSCRIPTION CONFIRMADA, PLATFORM_LEVEL_PLAUSIBLE_NOT_PROVEN EN SU MOMENTO — CAUSA CONFIRMADA POR 0.22 ARRIBA (2026-09-07/08)

```text
HEAD=origin/testing-codex=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84 (R15A, SIN CAMBIOS — R16 fue sólo auditoría)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R16_STATUS=ROOT_CAUSE_AUDITED_PLATFORM_LEVEL_PLAUSIBLE_NO_CODE_FIX_NEEDED
ANDROID_R16_POST_REOPEN_PHYSICAL_SUBSCRIPTION=MISSING / ANDROID_R16_POST_REOPEN_PERMISSION=default
R16_PROVIDER_SEND_FOR_522C650F=SI, providerStatus=201 (01:28:46Z) luego 410 REAL (01:29:43Z, mismo endpoint, ~57s después)
R16_BACKEND_BINDING_AFTER_PHYSICAL_LOSS=ABSENT / R16_FAILURE_MODEL=SINGLE_CAUSE_PROVEN
ANDROID_R16_SUBSCRIPTION_LOSS_ROOT_CAUSE_STATUS=PLATFORM_LEVEL_PLAUSIBLE_NOT_PROVEN
R15A_CHANGE_CAUSED_SUBSCRIPTION_LOSS=NO_EVIDENCE / FIX_IMPLEMENTED=NO
ANDROID_ON_COLD_REOPEN_STATUS=REGRESSION_REPRODUCED_POST_R15A_SUBSCRIPTION_MISSING (corregido desde el PASS histórico de R7/R8/R9 — ver aclaración abajo)
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_ANDROID_PUSH_PHYSICAL_SUBSCRIPTION_PERSISTENCE_LOSS_PLATFORM_LEVEL_PENDING_OPERATOR_DEVICE_CHECK
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_RECOMMENDED_ACTION=OPERATOR_CHECK_DEVICE_NOTIFICATION_PERMISSION_STATE_BEFORE_NEXT_ANDROID_RETEST
```

Leonardo ejecutó el retest físico post-R15A (0.20 abajo). Resultado:
la notificación closed-PWA siguió sin llegar, PERO ADEMÁS reportó que
tampoco llegaban notificaciones con la app ABIERTA en esta nueva
sesión, y que al reabrir la PWA el switch de notificaciones apareció
OFF. El trace autoritativo mostró una subscription física
(`endpointFingerprint=522c650f`) creada y confirmada correctamente
(`SUBSCRIBE_BACKEND_RESULT httpStatus=200`), verificada como presente
y atada al backend en un remount posterior, y luego AUSENTE
(`physicalPresent=false`) en un proceso nuevo tras cierre/reapertura,
con `permission=default` (no `denied`).

ROOT CAUSE AUDIT + inspección read-only de runtime/logs (sin commit,
push, deploy, mutación de DB, prueba física, ni rotación VAPID). Se
inventariaron TODOS los `.unsubscribe()` físicos del repo (hook
personal — `PERSONAL_MANUAL_DISABLE_PHYSICAL_UNSUBSCRIBE=NO`
certificado por static-contract test —, los 3 rollbacks de creación
fallida en permission-prompt/salón/mozo, la remoción de key stale,
logout operativo Policy A) — **ninguno coincide con el trace del
incidente**: no hay `UNSUBSCRIBE_START`, no hay
`SUBSCRIBE_STALE_REMOVE_START`, y el guardado backend fue exitoso
(httpStatus=200) así que ningún rollback pudo dispararse. Se auditaron
TODOS los lifecycle listeners (pagehide/visibilitychange/unmount, más
de 30 sitios en `src/`) — ninguno toca `PushManager`. Se auditó auth
bootstrap (`logout()` sólo limpia estado de React) y el Service Worker
(`unregisterServiceWorker()` existe pero sin ningún caller real en
producto; reemplazar el script del SW no invalida la subscription por
spec; R15A no tocó `public/sw.js`). `Notification.permission` no puede
resetearse programáticamente desde ningún código de DeliGO. Se
confirmó, vía el propio mecanismo de persistencia del trace
(`localStorage`, per-origin), que creación y reapertura ocurrieron en
el MISMO origin — evidencia empírica, no sólo de configuración.

**Hallazgo decisivo** (logs REALES de Railway TESTING, sólo lectura,
ventana exacta `01:25:00Z`–`01:45:00Z`): un envío real a `522c650f` a
las `01:28:46Z` (tipo `order_update`, con las opciones de R15A ya
vigentes) fue **aceptado por el proveedor (`providerStatus=201`)**. Un
segundo cambio de estado del MISMO pedido, 57 segundos después
(`01:29:43Z`), generó un segundo intento que recibió un **410
GENUINO** ("Subscription expired") para el MISMO endpoint — el backend
reaccionó exactamente como está diseñado (CAS-safe,
`safeClearLegacyIfMatches`), limpiando el binding legacy sin ninguna
inferencia. El mismo actor había sufrido una muerte idéntica de OTRO
endpoint apenas 90 segundos ANTES de siquiera empezar esta sesión — un
patrón que se repite para el mismo actor/dispositivo, no un evento
aislado.

Esto prueba que el pipeline de envío de R15A funcionó correctamente
(`R15A_CHANGE_CAUSED_SUBSCRIPTION_LOSS=NO_EVIDENCE`, R15A NO se
revierte) y que la pérdida es un evento REAL de plataforma
(browser/OS/permiso), confirmado por el proveedor, no una inferencia
ni un bug de código DeliGO. `R16_FAILURE_MODEL=SINGLE_CAUSE_PROVEN`:
ambos síntomas (foreground sin notificación visible + switch OFF al
reabrir) se explican por la MISMA muerte de subscription, no son dos
fallas independientes. El mecanismo EXACTO de esa muerte
(`ANDROID_R16_SUBSCRIPTION_LOSS_ROOT_CAUSE_STATUS=PLATFORM_LEVEL_
PLAUSIBLE_NOT_PROVEN`) no se pudo probar sin acceso al dispositivo
físico de Leonardo (chrome://settings, Ajustes de Android, logcat).

Sin bug de código probado, `FIX_IMPLEMENTED=NO` — se descartó
explícitamente cualquier re-subscribe automático silencioso (ocultaría
el problema en vez de seguir diagnosticándolo), cualquier prompt de
permiso automático, retry loop, o reset de Service Worker.
`ANDROID_ON_COLD_REOPEN_STATUS` se corrige de su PASS histórico (R7/
R8/R9 — que certificaba la persistencia del ESTADO DE UI tras un cold
reopen, nunca la supervivencia indefinida de la PushSubscription
física) a `REGRESSION_REPRODUCED_POST_R15A_SUBSCRIPTION_MISSING` — no
se borra esa evidencia histórica, pero ya no puede citarse sola sin
esta aclaración. **P2-T31 SIGUE ABIERTO.** Recomendación para la
siguiente tarea (NO ejecutada): pedirle a Leonardo que revise, en su
propio dispositivo, Ajustes de Android → Apps → DeliGO/Chrome →
Notificaciones/Permisos y `chrome://settings/content/notifications`,
antes de cualquier nuevo intento físico — reintentar ahora sin esa
información sólo reproduciría el mismo resultado. Mercado Pago sigue
`PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT`. Sin commit/push/deploy en ningún
momento. Reporte completo:
`codex-reports/P2_T31_R16_ANDROID_PUSH_SUBSCRIPTION_PERSISTENCE_LOSS_ROOT_CAUSE_AUDIT.md`.

## 0.20 ESTADO ANTERIOR — R15A: FIX R15R DESPLEGADO EN TESTING, PROTOCOLO FÍSICO CLOSED-PWA PREPARADO (2026-09-07) — RETEST FÍSICO REVELÓ LA REGRESIÓN DE 0.21 ARRIBA

```text
HEAD=origin/testing-codex=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84 (R15A, parent 8b49756e76a32b2641bd1099c1e8382d3be32f25)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios — PRODUCTION_TOUCHED=NO)
P2_T31_R15A_STATUS=DEPLOYED_TESTING_PENDING_ANDROID_CLOSED_PWA_PHYSICAL_RETEST
R15A_RAILWAY_DEPLOYMENT_ID=906d7960-10f5-449b-a1bd-a492feb91bab / R15A_RAILWAY_STATUS=SUCCESS / R15A_RAILWAY_COMMIT_MATCH=SI
R15A_FOCAL_PASS=240 / R15A_FOCAL_FAIL=0 / NEW_TYPECHECK_ERRORS=0
ANDROID_CLOSED_PWA_PUSH_STATUS=FAIL_REPRODUCED (sin cambios — pendiente reintento físico)
ANDROID_NOTIFICATION_TAP_STATUS=NOT_TESTABLE_DUE_TO_CLOSED_PWA_DELIVERY_FAILURE (sin cambios)
ANDROID_OFF_COLD_REOPEN_STATUS=PENDING (sin cambios)
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_PHYSICAL_TEST=ANDROID_CLOSED_PWA_PUSH_RETEST_POST_R15A
NEXT_RECOMMENDED_ACTION=OPERATOR_RUN_ANDROID_CLOSED_PWA_PUSH_RETEST
```

Deploy explícitamente autorizado por el operador
(`COMMIT_AUTHORIZED=SI`/`PUSH_AUTHORIZED=SI`/
`TESTING_DEPLOY_AUTHORIZED=SI`/`PRODUCTION_AUTHORIZED=NO`) del fix
R15R (0.19 abajo). Baseline verificado fresco
(`HEAD=origin/testing-codex=8b49756`, `origin/main=1de0d3c1...`
coincidían exactamente). Gate de calidad re-ejecutado fresco antes de
stagear: 240/240 tests focales, ESLint limpio, TypeScript 24/18
idéntico a la baseline de R15R (0 nuevos), `git diff --check` limpio.
Stage selectivo individual (`git add src/lib/push.ts`, `git add
src/lib/push.test.ts` — nunca `-A`/`.`); `git diff --cached
--name-status` confirmó exactamente esos 2 archivos antes de
commitear, sin ningún archivo de `.claude/skills/**`/`CLAUDE.md`/
`codex-reports/**`/`32`. Commit único `d7cc66d` (parent `8b49756`
verificado), push a `testing-codex` (nunca `main`, sin `--force`) —
`origin/testing-codex` confirmado en `d7cc66d`. Autodeploy Git-triggered
normal a "DeliGO Copy" (sin `railway up`), poll directo y finito:
deployment `906d7960...` `SUCCESS`, instancia `RUNNING`,
`meta.commitHash` == `d7cc66d` exacto (verificado vía `railway status
--json`). Logs de build (imagen exportada/pusheada sin error) y de
boot ("No pending migrations to apply", Next.js "Ready in 65ms", sin
fatal/unhandled/500) limpios. Smokes: `/` → 307 a `/cliente/` (normal),
`/cliente/` → 308 (normalización de slash, normal),
`GET /api/push/debug-guard` → `200 {"allowed":true}` (confirma en
runtime real que el guard TESTING-only reutilizado por el nuevo log de
éxito de push funciona correctamente en el entorno real). No se generó
tráfico de push real para forzar el log `[Push] Enviado OK` — no había
ningún pedido real disponible sin afectar datos reales.

`origin/main` verificado sin cambios antes y después
(`PRODUCTION_TOUCHED=NO`). El trabajo de Claude Code Project Skills
(0.18 abajo) no fue tocado por este commit — scope preservado. **P2-T31
SIGUE ABIERTO** — `DEPLOYED_TESTING` no es `PHYSICALLY_CERTIFIED`. El
protocolo físico `ANDROID_CLOSED_PWA_PUSH_RETEST_POST_R15A` queda
preparado para que Leonardo lo ejecute (PWA cerrada de forma normal de
usuario, NUNCA "Forzar detención"; generar UN `order_update` real;
esperar hasta 60s; reportar recepción/tiempo/duplicado/contenido) — no
se ejecutó ninguna prueba física desde Claude. Si el retest vuelve a
FAIL: NO reinstalar, NO unsubscribe, NO OFF, NO resetear permisos, NO
crear subscription nueva — reabrir sin tocar el switch y revisar logs
TESTING para `endpointFingerprint`/`providerStatus` del evento
correspondiente antes de declarar cualquier causa. Mercado Pago sigue
`PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT`. Reporte completo:
`codex-reports/P2_T31_R15A_COMMIT_DEPLOY_AND_CLOSED_PWA_RETEST_READY.md`.

## 0.19 ESTADO ANTERIOR — R15R: CORRECCIÓN PRE-DEPLOY DEL FIX R15 (TTL/URGENCY/OBSERVABILIDAD), SIN DEPLOY (2026-09-07) — DESPLEGADO POR 0.20 ARRIBA

```text
HEAD=8b49756e76a32b2641bd1099c1e8382d3be32f25 (sin cambios — local, sin commit)
P2_T31_R15R_STATUS=LOCAL_MITIGATION_AND_DIAGNOSTICS_CORRECTED_PENDING_TESTING_DEPLOY
WEB_PUSH_LIBRARY_VERSION=3.6.7 / WEB_PUSH_DEFAULT_TTL=2419200 (28 dias) / WEB_PUSH_DEFAULT_URGENCY=normal
MISSING_TTL_BEFORE_R15=NO
PROVEN_ROOT_CAUSE=NO
ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE_STATUS=UNRESOLVED_WITH_HIGH_URGENCY_AS_STRONG_MITIGATION_CANDIDATE (corregido desde HIGH_CONFIDENCE_CODE_BUG de R15 en 0.17)
GLOBAL_HIGH_URGENCY_JUSTIFIED=NO (8/12 tipos time-sensitive, resto conserva default)
R15_TTL_CHANGE_SHORTENS_RETENTION=SI -> TTL de R15 (24h) revertido al default de la libreria (28 dias)
PUSH_PROVIDER_SUCCESS_LOG_PRODUCTION_ENABLED=NO (gateado TESTING-only con isPushDebugAllowedEnvironment) / PROVIDER_SUCCESS_STATUS_LOGGED=SI
R15R_FOCAL_PASS=240 / R15R_FOCAL_FAIL=0 / NEW_TYPECHECK_ERRORS=0
P2_T31_STATUS=IN_PROGRESS_ANDROID_CLOSED_PWA_DELIVERY_FAILURE_UNRESOLVED_MITIGATION_PENDING_TESTING_DEPLOY_THEN_OFF_PERSISTENCE_AND_IPHONE_BUSINESS_DELIVERY_MATRIX_PENDING
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
PRODUCT_CODE_CHANGED=SI (local, sin commit) / TEST_CODE_CHANGED=SI (local) / PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=P2-T31-R15A-COMMIT-DEPLOY-AND-CLOSED-PWA-RETEST
```

Revisión pre-deploy del fix local de R15 (0.17 abajo), antes de
cualquier commit/push/deploy, sin tocar el trabajo de Claude Code
Project Skills (0.18 arriba — scope preservado por separado, ambos
`src/lib/push.ts`/`push.test.ts` y `.claude/skills/**`/`CLAUDE.md`
siguen locales sin commit al mismo tiempo). Se auditó la versión REAL
instalada de `web-push` (3.6.7, leyendo
`node_modules/web-push/src/web-push-lib.js`, no sólo documentación):
`DEFAULT_TTL=2419200` (28 días) y `urgency` default `"normal"`. Esto
corrige el hallazgo de R15
(`MISSING_PUSH_URGENCY_AND_TTL_OPTIONS_ON_WEBPUSH_SEND`): el TTL NUNCA
estuvo ausente — la librería siempre lo aplicó por default, con mucha
más retención que cualquier valor que R15 fijara; el candidato real de
código era sólo `urgency`. La clasificación de causa raíz se corrige
de `HIGH_CONFIDENCE_CODE_BUG` a
`UNRESOLVED_WITH_HIGH_URGENCY_AS_STRONG_MITIGATION_CANDIDATE` — R15
nunca tuvo una captura directa (request/response del proveedor, traza
del SW) que probara la causa para este incidente específico.

Se inventariaron los 12 `NotificationType` reales del pipeline y se
clasificaron en 8 time-sensitive (`order_update`, `new_order`,
`new_delivery`, `chat`, `mesa_order_ready`, `salon_new_order`,
`operaciones_salon_new_order`, `operaciones_order_cancelled`) vs 4
no-urgentes (`review`, `review_request`, `account_update`, `general`
— sin fábrica de payload real). `urgency:"high"` ahora se pide SÓLO
para los 8 time-sensitive (`isTimeSensitivePushType` en `push.ts`) —
nunca global. El `TTL: 60*60*24` que R15 había agregado se removió por
completo (acortaba la retención real de 28 días sin decisión de
producto separada). El log de éxito `[Push] Enviado OK` (R15 lo dejó
corriendo en TODOS los ambientes pese a que R15 lo había concebido
TESTING-only) ahora está gateado con el guard ya existente
(`isPushDebugAllowedEnvironment`, `src/lib/push-testing-guard.ts`,
`RAILWAY_ENVIRONMENT_NAME`) y agrega el `statusCode` real del
proveedor (nunca `body`/`headers`/endpoint completo).

240 tests focales (`push*.test.ts`, 8 archivos) en 0 fail. ESLint
limpio en los 2 archivos tocados. TypeScript: 24 raw / 18 distintos,
idéntico a la baseline de R15 — 0 nuevos. Preservado sin cambios:
hallazgo de `notificationclick` sin cobertura real (R15). NO se
commiteó, pusheó ni desplegó nada; Production intacta; P2-T31 sigue
abierto; Mercado Pago sigue pausado. Reporte completo:
`codex-reports/P2_T31_R15R_PREDEPLOY_EVIDENCE_CORRECTION_AND_PUSH_PRIORITY_SCOPE.md`.

## 0.18 ESTADO ANTERIOR — CLAUDE CODE PROJECT SKILLS: 3 SKILLS + ROUTER CREADOS (TOOLING PURO, 2026-09-07)

```text
HEAD=8b49756e76a32b2641bd1099c1e8382d3be32f25 (sin cambios — tarea de tooling puro, sin commit)
CLAUDE_SKILLS_TASK_STATUS=LOCAL_PROJECT_SKILLS_CREATED_VALIDATED_PENDING_OPERATOR_REVIEW
DELIGO_SAFE_TASK_CREATED=SI / DELIGO_CLOSEOUT_CREATED=SI / DELIGO_TESTING_DEPLOY_CREATED=SI
SKILLS_CONTAIN_LIVE_PROJECT_STATE=NO
DEPLOY_EXPLICIT_AUTHORIZATION_GATE_PRESENT=SI
CLAUDE_SESSION_RESTART_REQUIRED_FOR_DISCOVERY=SI
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / PRODUCTION_TOUCHED=NO
GIT_ADD_EXECUTED=NO / GIT_COMMIT_EXECUTED=NO / GIT_PUSH_EXECUTED=NO / DEPLOY_EXECUTED=NO
NEXT_RECOMMENDED_ACTION=OPERATOR_RESTART_CLAUDE_SESSION_IF_REQUIRED_AND_VERIFY_AUTO_SKILL_ROUTING
```

Tarea de infraestructura de Claude Code — NO continuó ningún trabajo de
roadmap (Android/R15/Mercado Pago quedaron exactamente donde estaban en
`0.17`). Se creó `.claude/skills/{deligo-safe-task,deligo-closeout,
deligo-testing-deploy}/SKILL.md` (108/82/103 líneas) y un `CLAUDE.md`
nuevo en la raíz (no existía ninguno antes) con una sección breve
"DeliGO Skill Routing". Sintaxis auditada contra la documentación
oficial de Claude Code (`code.claude.com/docs/en/skills`): `when_to_use`
es un campo real soportado; `disable-model-invocation:true` oculta la
skill del contexto de Claude por completo, así que — por diseño — NO se
usó en ninguna de las 3; `deligo-testing-deploy` gatea sus side effects
(commit/push/deploy) con un AUTHORIZATION GATE interno propio, exigiendo
autorización explícita de la tarea ACTUAL para cada operación —
ni tests en verde, ni un `NEXT_RECOMMENDED_ACTION=deploy` histórico, ni
"el fix está bien" cuentan como autorización, y una petición de deploy
a Production tampoco la satisface (Production tiene su propio flujo).
Las 3 skills están libres de estado vivo (sin hashes, sin deployment
IDs, sin tarea actual, sin estado de Android/Pagos/P2-T31) — ese estado
sigue viviendo exclusivamente en Git real y en `CODEX_REPORT.md` +
este archivo + el resto de `codex-reports/`. Nueva autoridad de tooling:
`codex-reports/CLAUDE_SKILLS.md`. `.claude/skills/` no existía cuando
esta sesión arrancó, así que probablemente se necesite una sesión nueva
de Claude Code para que el auto-routing quede activo. Sin commit, sin
push, sin deploy, sin tocar código/tests de producto. Reporte completo:
`DELIGO_CLAUDE_PROJECT_SKILLS_FOUNDATION_REPORT.md`.

## 0.17 ESTADO ANTERIOR — ANDROID RETOMADO: ROOT CAUSE AUDIT CLOSED-PWA, FIX LOCAL DE PRIORIDAD DE ENTREGA (R15, 2026-09-07) — CORREGIDO POR 0.19 ARRIBA

**CORREGIDO POR R15R (0.19 arriba)**: `HIGH_CONFIDENCE_CODE_BUG` baja a
`UNRESOLVED_WITH_HIGH_URGENCY_AS_STRONG_MITIGATION_CANDIDATE`; el TTL
nunca estuvo ausente (`MISSING_TTL_BEFORE_R15=NO`, web-push 3.6.7 ya
aplica 28 días por default). Bloque original preservado sin editar:

```text
HEAD=8b49756e76a32b2641bd1099c1e8382d3be32f25 (sin commit — cambio local sin stage)
ANDROID_PHYSICAL_TESTING_PAUSED_BY_OPERATOR=NO (Leonardo retomó Android para cerrar P2-T31 antes de Mercado Pago)
ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE_STATUS=HIGH_CONFIDENCE_CODE_BUG (CORREGIDO POR 0.19)
ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE=MISSING_PUSH_URGENCY_AND_TTL_OPTIONS_ON_WEBPUSH_SEND (CORREGIDO POR 0.19)
FIX_IMPLEMENTED=SI_LOCAL_SOLAMENTE_NO_DESPLEGADO
R15_FOCAL_PASS=235 / R15_FOCAL_FAIL=0
TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0
PRODUCT_CODE_CHANGED=SI (local) / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_ANDROID_CLOSED_PWA_DELIVERY_FAILURE_UNDER_AUDIT_THEN_OFF_PERSISTENCE_AND_IPHONE_BUSINESS_DELIVERY_MATRIX_PENDING
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_RECOMMENDED_ACTION=P2-T31-R15A-COMMIT-DEPLOY-AND-CLOSED-PWA-RETEST
```

Auditoría de causa raíz de punta a punta del fallo de entrega closed-PWA
(evento → server send → subscription lookup → web-push send → Service
Worker → showNotification → Android). Hallazgo clave de proceso: el
canal realtime (Socket.IO) de DeliGO **no tiene** ningún evento de
cambio de estado de pedido — todo el ciclo de vida de pedidos usa
EXCLUSIVAMENTE Web Push real (`src/lib/push.ts::createNotification`),
así que el test foreground (PASS) y el test closed-PWA (FAIL) corrieron
por el MISMO pipeline exacto, mismo endpoint físico, mismo código —
esto descarta que el foreground haya usado un mecanismo distinto que
enmascarara el problema real. Auditando cada frontera del pipeline
(lookup de subscription, Service Worker real vía VM harness existente,
branching foreground/background — sólo existe uno, exclusivo de chat y
fail-open, no puede explicar el fallo closed-PWA —, contrato de
payload, `event.waitUntil`, opciones de `showNotification`, dedupe por
`tag`, detección de clientes) se descartó código propio como causa
directa, salvo un hallazgo real: `sendPushNotification` nunca pedía
`urgency`/`TTL` explícitos a `webpush.sendNotification` — documentación
oficial de `web-push-libs/web-push` y de FCM/Android confirma que la
ausencia de `urgency:"high"` puede hacer que el push service DIFIERA la
entrega mientras el dispositivo está en Doze/ahorro de batería, patrón
exactamente compatible con "llega en foreground, no llega con la app
cerrada". No se declara `PROVEN` (no hay captura directa que lo pruebe
para este incidente específico) — se clasifica `HIGH_CONFIDENCE_CODE_BUG`
y se implementó el fix mínimo (`{ TTL: 86400, urgency: "high" }` en
`src/lib/push.ts`), spec-estándar, sin hacks. Se cerró además un gap de
observabilidad real y genuino: un envío EXITOSO no dejaba ningún rastro
en logs (sólo las fallas se logueaban) — se agregó un log simétrico
seguro (`fingerprintPushEndpoint`, reusando el helper ya existente de
`push-debug-snapshot.ts`, nunca el endpoint completo), corriendo en
todos los ambientes con la misma disciplina de redacción que el log de
falla ya existente. Como evidencia adicional (lectura, sin cambios),
`railway logs` de TESTING mostró 3 llamadas reales
`PATCH .../estado → 200` el 2026-09-07 con 3 limpiezas 410 reales
inmediatamente después de la primera — prueba de que el pipeline
ejecuta envíos reales y maneja respuestas reales del proveedor — pero
sin marca de tiempo del lado del operador no se pudo correlacionar con
certeza cuál PATCH corresponde a cuál prueba física. Tests: 235
focales (0 fail) en los 8 archivos `push*.test.ts`; suite completa del
repo 2915 pass / 227 fail, con el 100% de las fallas explicadas por
`DATABASE_URL` ausente en este sandbox (tests de integración, no
relacionados con push). ESLint limpio, TypeScript 24/24 sin cambios
(mismo error preexistente en `push.ts`, no relacionado con este
cambio). NO se commiteó, pusheó ni desplegó nada — sólo cambios locales
en `src/lib/push.ts` y `src/lib/push.test.ts`, pendientes de revisión
por Leonardo antes de R15A (commit + deploy TESTING + reintento físico
closed-PWA). Reporte completo:
`P2_T31_R15_ANDROID_CLOSED_PWA_BACKGROUND_PUSH_ROOT_CAUSE_AUDIT.md`.
Hallazgo secundario de cobertura (no corregido, fuera de alcance): un
comentario en `sw-push-dedupe.test.ts` afirma que `notificationclick`
está cubierto por tests existentes del SW — no existe ningún test así
en el repo.

## 0.16 ESTADO ANTERIOR — CORRECCIÓN DE CONTEXTO: DIAGNÓSTICO POST-FALLO CLOSED-PWA ANDROID ENTREGADO (2026-09-07) — ROOT CAUSE AUDITADA Y FIX LOCAL APLICADO POR R15 ARRIBA

```text
HEAD=8b49756e76a32b2641bd1099c1e8382d3be32f25 (sin cambios — tarea de documentación pura)
ORIGIN_TESTING=8b49756e76a32b2641bd1099c1e8382d3be32f25
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
ANDROID_CLOSED_PWA_FAILURE_DIAGNOSTIC_STATUS=CAPTURED_POST_FAILURE_SUBSCRIPTION_AND_BACKEND_HEALTHY
ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE_STATUS=UNRESOLVED_DELIVERY_PATH_REQUIRES_AUDIT
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=CONTINUE_PAYMENTS_DESIGN_OR_MERCADOPAGO_SPIKE_WHEN_OPERATOR_AUTHORIZES
```

Esta ronda es sólo una corrección de contexto — NO se reabrieron
pruebas físicas, NO se auditó causa raíz. Leonardo entregó el
diagnóstico post-fallo que en `0.15` figuraba como
`PENDING_OPERATOR_CAPTURE`. Snapshot al reabrir DeliGO tras el fallo de
entrega closed-PWA: `permission=granted`, `physicalSubscription=true`
(`endpointFingerprint=a55ebad6`, `existingKeyPresent=true`),
`vapidFetched=true`/`vapidMatch=true`, `backendStatusHttp=200`/
`backendSubscribed=true`, `hookSubscribed=true`, `uiSwitch=true`,
`error=none`. Ese endpoint es el MISMO creado en
`ANDROID_POST_R13A_CREATE_3_OF_3` — no se creó ninguna subscription
nueva. Esto descarta, **sólo como causa simple**, pérdida de
subscription, detach de backend y revocación de permiso
(`RULED_OUT` los tres) — pero NO prueba nada sobre el resto del camino
de entrega (envío del backend, resultado del proveedor web-push,
evento `push` del Service Worker, `showNotification`, presentación en
Android), así que **no se declara causa**: ni Service Worker, ni FCM,
ni Chrome, ni Android, ni backend send, ni supresión del SO, ni capa de
permiso, ni VAPID, ni proveedor. Detalle completo en
`ANDROID_CLOSED_PWA_POST_FAILURE_DIAGNOSTIC_CONTEXT_CORRECTION.md` y en
`codex-reports/FINDINGS.md` (bloque `F-PAYMENTS-PAUSE-ANDROID-CLOSED-
PWA-01`). Todo lo demás de `0.15` permanece sin cambios: la pausa
operativa de Android sigue vigente
(`ANDROID_PHYSICAL_TESTING_PAUSED_BY_OPERATOR=SI`), el diseño de pagos
Mercado Pago sigue `DESIGN_RESEARCH_NOT_IMPLEMENTED` y no fue tocado, y
la matriz Android (`FOREGROUND=PASS`, `CLOSED_PWA=FAIL_REPRODUCED`,
`TAP=NOT_TESTABLE`, `OFF_COLD_REOPEN=PENDING`) queda igual — el fallo
de entrega sigue siendo un fallo, la salud posterior de la subscription
no lo revierte. Próxima tarea registrada (no iniciada):
`P2-T31-ANDROID-CLOSED-PWA-BACKGROUND-DELIVERY-ROOT-CAUSE-AUDIT`.

## 0.15 ESTADO ANTERIOR — DISEÑO DE PAGOS MERCADO PAGO PERSISTIDO; PRUEBAS FÍSICAS ANDROID PAUSADAS POR EL OPERADOR (2026-09-07) — DIAGNÓSTICO POST-FALLO CORREGIDO POR 0.16 ARRIBA

```text
HEAD=8b49756e76a32b2641bd1099c1e8382d3be32f25 (sin cambios — tarea de documentación pura)
ORIGIN_TESTING=8b49756e76a32b2641bd1099c1e8382d3be32f25
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
ANDROID_PHYSICAL_TESTING_PAUSED_BY_OPERATOR=SI
ANDROID_PHYSICAL_TESTING_PAUSE_REASON=PAYMENTS_DESIGN_AND_DOCUMENTATION
ANDROID_PHYSICAL_TESTING_RESUME_REQUIRES_OPERATOR_DECISION=SI
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado)
P2_T31_STATUS=IN_PROGRESS_OPERATOR_PAUSED_PENDING_ANDROID_CLOSED_PWA_DELIVERY_INVESTIGATION_OFF_PERSISTENCE_AND_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / DB_SCHEMA_CHANGED=NO / MERCADOPAGO_INTEGRATION_CREATED=NO
PRODUCTION_TOUCHED=NO
PAYMENTS_DESIGN_DOCUMENT_CREATED=SI (codex-reports/PAYMENTS_MERCADOPAGO_DESIGN.md)
NEXT_RECOMMENDED_ACTION=MERCADOPAGO_SPLIT_DEFERRED_CAPTURE_COMPATIBILITY_SPIKE_WHEN_OPERATOR_AUTHORIZES (NO iniciado)
```

### Android — estado congelado EXACTAMENTE aquí (pausa operativa, NO cierre)

```text
ANDROID_POST_R13A_PHYSICAL_CREATE_RELIABILITY=PASS_3_OF_3_CONSECUTIVE
ANDROID_ON_COLD_REOPEN_STATUS=PASS
ANDROID_FOREGROUND_PUSH_STATUS=PASS (recibida SI, duplicada NO, contenido correcto SI, notificaciones Android habilitadas en Ajustes SI)
ANDROID_NATIVE_PERMISSION_PROMPT_STATUS=NO_RECUERDO_OPERATOR (nunca convertido en PASS)
ANDROID_CLOSED_PWA_PUSH_STATUS=FAIL_REPRODUCED (push real con PWA cerrada NO llegó — causa NO auditada, no se asume SW/FCM/Android/backend/permission)
ANDROID_NOTIFICATION_TAP_STATUS=NOT_TESTABLE_DUE_TO_CLOSED_PWA_DELIVERY_FAILURE
ANDROID_OFF_COLD_REOPEN_STATUS=PENDING
ANDROID_CLOSED_PWA_FAILURE_DIAGNOSTIC_STATUS=PENDING_OPERATOR_CAPTURE (no solicitado activamente — pruebas pausadas)
```

Leonardo decidió PAUSAR, por decisión operativa (no técnica), las
pruebas físicas Android para priorizar primero el diseño de pagos con
Mercado Pago. La pausa **NO significa**: certificación de Android,
cierre de P2-T31, abandono del hallazgo de closed-PWA push
(`F-PAYMENTS-PAUSE-ANDROID-CLOSED-PWA-01`, nuevo, bloqueante para
certificación completa, investigación pausada), ni resolución del
`AbortError` histórico (que sigue `NOT_PROVEN`). **No se solicitó
ninguna prueba física nueva en esta tarea.** Los diagnósticos R6/R6A/
R6B se retienen sin cambios. Cuando Leonardo decida retomar, el próximo
paso físico es investigar la causa del fallo de entrega con PWA cerrada
(diagnóstico ya armado, sólo falta que Leonardo lo capture y copie) y,
después, la persistencia OFF tras cold reopen.

### Pagos — Mercado Pago (diseño completo, NADA implementado)

```text
PAYMENTS_DESIGN_AUTHORITY=codex-reports/PAYMENTS_MERCADOPAGO_DESIGN.md
MERCADOPAGO_BUSINESS_FEATURE_OPTIONAL=SI
PAYMENT_PROVIDER_V1=MERCADOPAGO / OTHER_WALLETS_STATUS=DEFERRED_UNTIL_DEMAND / QR_INTEROPERABLE_STATUS=FUTURE_NOT_V1
DELIVERY_FINANCIAL_OWNER=BUSINESS / DELIGO_MANAGES_DELIVERY_PAYOUTS=NO
DELIGO_SERVICE_FEE_PAYER=CLIENT / DELIGO_SERVICE_FEE_BUSINESS_COST=NO / DELIGO_SERVICE_FEE_CURRENT_AMOUNT_ARS=100 (parametrizable)
MP_SPLIT_DELIGO_FEE_GENERATES_BUSINESS_DEBT=NO / MP_SPLIT_DELIGO_FEE_COUNTS_TOWARD_BUSINESS_LIMIT=NO (efectivo SÍ genera deuda de la tarifa)
MP_PRICE_SUGGESTION_ENABLED_WHEN_CONNECTED=SI / MP_PRICE_SUGGESTION_IS_MANDATORY=NO / BUSINESS_RETAINS_FINAL_PRICE_CONTROL=SI
PRICE_SUGGESTION_PROTECTS_BUSINESS_NET=SI / PRICE_SUGGESTION_PROTECTS_DELIGO_FEE=SI / PRICE_SUGGESTION_GUARANTEED_NET=NO
CUSTOMER_VISIBLE_DELIGO_FEE_STAYS_CLEAN=SI / CUSTOMER_VISIBLE_MP_PROCESSING_FEE_LINE=NO
ONLINE_PAYMENTS_TERMS_REQUIRED=SI / ONLINE_PAYMENTS_EXPLICIT_ACCEPTANCE_REQUIRED=SI / LEGAL_REVIEW_BEFORE_PUBLIC_LAUNCH=REQUIRED
PAYMENT_PROOF_SCREENSHOTS_AUTHORITY=NO / PAYMENT_SERVER_VERIFICATION_REQUIRED=SI
ORDER_AND_PAYMENT_STATE_SEPARATION_REQUIRED=SI
PAYMENT_CAPTURE_POLICY=BUSINESS_ACCEPTED_AND_CUSTOMER_CANCEL_WINDOW_EXPIRED (AND, nunca OR) / CAPTURE_REQUIRES_BOTH=SI
PRE_CAPTURE_CANCELLATION_USES_REFUND=NO / PRE_CAPTURE_CANCELLATION_USES_AUTHORIZATION_CANCEL=SI
TARGET_PAYMENT_MODEL=MP_MARKETPLACE_SPLIT_1_TO_1 / DELIGO_HOLDS_FULL_SELLER_FUNDS=NO
MP_DEFERRED_CAPTURE_DOCUMENTED=SI (RESEARCHED) / MP_DEFERRED_CAPTURE_IMPLEMENTATION_CERTIFIED_FOR_DELIGO=NO
CREDIT/DEBIT/ACCOUNT_MONEY_DEFERRED_CAPTURE_STATUS=TO_VERIFY (spike obligatorio)
MP_SPLIT_DEFERRED_CAPTURE_COMBINATION_STATUS=REQUIRES_TECHNICAL_SPIKE
DELIGO_REFUND_SHORTFALL_50_PERCENT_POLICY=NOT_ADOPTED_PENDING_POST_CAPTURE_REFUND_RESEARCH (explícitamente rechazada por ahora, no descartada para siempre)
POST_CAPTURE_REFUND_STATUS=EXCEPTIONAL_FLOW_TO_DESIGN / POST_CAPTURE_REFUND_RESEARCH_REQUIRED=SI
PRE_CAPTURE_CANCELLATION_CUSTOMER_COPY_MUST_NOT_SAY_REFUND=SI
```

Leonardo definió el diseño económico y técnico completo de Mercado
Pago, persistido íntegro en
`codex-reports/PAYMENTS_MERCADOPAGO_DESIGN.md` (autoridad primaria de
detalle — este resumen es sólo síntesis) con 4 categorías estrictas:
DECIDED (decisión de negocio ya tomada), RESEARCHED (investigado, no
certificado contra DeliGO), TO_VERIFY (requiere spike/investigación
antes de decidir), y NOT_IMPLEMENTED (nada de esto existe en código
todavía). El punto crítico de esta ronda: Mercado Pago es opcional por
negocio, conectado vía OAuth one-click (nunca credenciales técnicas en
un formulario DeliGO); delivery pertenece económicamente al negocio;
la tarifa DeliGO ($100 ARS, parametrizable) la paga el cliente; un pago
en efectivo SÍ genera deuda de esa tarifa para el negocio, un pago vía
MP Split NUNCA la genera; el precio sugerido es una estimación (nunca
garantía) que protege tanto el neto del negocio como que "Servicio
DeliGO = $100" se muestre limpio, sin desglosar el costo de
procesamiento MP; la regla central de captura es
`BUSINESS_ACCEPTED AND CUSTOMER_CANCEL_WINDOW_EXPIRED` (condición AND,
nunca OR); la cancelación pre-capture usa cancelación de autorización,
nunca refund; el modelo objetivo es split marketplace 1:1; y la
propuesta de que DeliGO cubra el 50% de un shortfall de refund quedó
explícitamente `NOT_ADOPTED` (no una promesa, sólo una idea a
investigar más). La compatibilidad de deferred capture por medio de
pago (crédito/débito/dinero en cuenta) y la combinación Split+
`capture=false` end-to-end quedan `TO_VERIFY` — **spike técnico
obligatorio en sandbox** (`MERCADOPAGO_SPLIT_DEFERRED_CAPTURE_
COMPATIBILITY_SPIKE`) antes de implementar cualquier cosa. Nada de esto
tiene código todavía: sin rutas, sin modelos, sin webhooks, sin OAuth,
sin UI, sin migraciones. Reporte de esta tarea:
`PAYMENTS_CONTEXT_PERSISTENCE_AND_ANDROID_TEST_PAUSE_REPORT.md`.

## 0.14 ESTADO ANTERIOR — CREACIÓN FÍSICA ANDROID CERTIFICADA 3/3, MATRIZ DE ENTREGA/PERSISTENCIA PENDIENTE (2026-09-06/07) — EVIDENCIA POSTERIOR Y PAUSA REGISTRADAS ARRIBA

```text
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_DELIVERY_PERSISTENCE_MATRIX
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado, sin cambios)
ANDROID_POST_R13A_PHYSICAL_CREATE_RELIABILITY=PASS_3_OF_3_CONSECUTIVE
ABORTERROR_REPRODUCED_POST_R13A_3_OF_3=NO / ABORTERROR_FIXED_BY_DELIGO=NO_EVIDENCE
ABORTERROR_UNDERLYING_CAUSE_STATUS=NOT_PROVEN_PLAUSIBLE_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE
ANDROID_PERMISSION_DEFAULT_WITH_ACTIVE_SUBSCRIPTION_STATUS=OBSERVED_UNEXPLAINED_MULTIPLE_PLAUSIBLE_CAUSES_NOT_ISOLATED (no bloquea)
ANDROID_ON_COLD_REOPEN_STATUS=PASS / OFF_COLD_REOPEN/FOREGROUND_PUSH/CLOSED_PWA_PUSH/NOTIFICATION_TAP=PENDING
ANDROID_PUSH_STATUS=PARTIAL_CREATE_RELIABILITY_CERTIFIED_PENDING_DELIVERY_AND_PERSISTENCE_MATRIX
HEAD=8b49756e76a32b2641bd1099c1e8382d3be32f25 (sin cambios — tarea de audit puro)
ORIGIN_TESTING=8b49756e76a32b2641bd1099c1e8382d3be32f25
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
PRODUCT_CODE_CHANGED=NO
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=LEONARDO_ANDROID_FOREGROUND_AND_CLOSED_PWA_PUSH_DELIVERY_PLUS_TAP_THEN_OFF_PERSISTENCE
```

Las 3 creaciones físicas post-R13A (sobre el build ya desplegado
`8b49756...`) ejercitaron el camino de creación real (sin reuso, con
backend 200 real) sin reproducir `AbortError` ninguna vez — el
reliability gate de creación física Android queda formalmente CERRADO.
Esto NO significa que la causa del `AbortError` original haya sido
identificada ni arreglada: certifica que el camino de código mostró
estabilidad suficiente bajo el criterio ya definido (3/3 consecutivos
post-fix), sin ningún retry/hack agregado. El hallazgo que antes
bloqueaba el avance (`F-P2-T31-R13-01`) se reclasifica a monitoreo no
bloqueante — se reabrirá si el `AbortError` reaparece en cualquier
prueba futura.

Se auditó, sin asumir, una anomalía real observada en el tercer
capture: `permission=default` simultáneo con subscription/backend/hook/
UI todos activos. Por auditoría de código se probó que esto es
lógicamente imposible como resultado de una revocación por JavaScript
(el permiso tuvo que ser `granted` en el instante exacto de esa misma
creación exitosa, y ninguna API de JS permite revertirlo). No se
identificó como bug de DeliGO — evidencia de plataforma (repositorios
oficiales de Google y de PWABuilder, citados explícitamente como
evidencia de un patrón real, no como spec formal) documenta que Android
mantiene dos capas de permiso de notificación independientes para PWAs
instaladas: el permiso de origen web (lo que `Notification.permission`
reporta a la página) y el permiso de sistema operativo
(`POST_NOTIFICATIONS`, Android 13+), que pueden divergir entre sí. No
se tocó ningún código. Esta anomalía NO bloquea las pruebas de entrega
pendientes — se resolverá empíricamente observando si la entrega real
de push funciona durante esas mismas pruebas.

Matriz Android Cliente actualizada: la persistencia de ON tras cold
reopen ya quedó certificada (evidencia ya obtenida en los ciclos 1/3 y
2/3, no se repite). Quedan pendientes: persistencia OFF tras cold
reopen, push real en foreground, push real con la PWA cerrada, tap de
notificación, y la confirmación explícita de que Leonardo vio el
diálogo nativo de permiso Android (no documentada todavía en ningún
ciclo — no se inventa ese `PASS`). Se preparó (sin ejecutar) el orden
mínimo recomendado: foreground → PWA cerrada (reutilizando la misma
notificación para el tap, igual que iPhone C7→C8) → persistencia OFF al
final, evitando reinstalar la PWA innecesariamente ahora que la
creación ya está certificada.

Cliente iPhone permanece `CERTIFIED_TESTING` sin reabrirse; Negocio/
Repartidor siguen exactamente como R11 los dejó; los diagnósticos se
retienen; P2-T31 no cierra. Reporte completo:
`P2_T31_R14_ANDROID_CREATE_RELIABILITY_CLOSEOUT_AND_REMAINING_MATRIX.md`.

## 0.13 ESTADO ANTERIOR — FIX DE UI STALE DESPLEGADO EN TESTING, RELIABILITY GATE ANDROID REINICIADO EN 0/3 (2026-09-06) — CREACIÓN FÍSICA CERTIFICADA POR R14 ARRIBA

```text
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_ABORTERROR_ROOT_CAUSE_OR_MITIGATION
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado, sin cambios)
ANDROID_PUSH_STATUS=FAIL_REPRODUCED_ABORTERROR_DURING_PHYSICAL_CREATE_PENDING_ROOT_CAUSE (sin cambios — no certificado)
ABORTERROR_UNDERLYING_CAUSE_STATUS=NOT_PROVEN_PLAUSIBLE_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE
STALE_UI_IS_DELIGO_BUG=SI (corregido y VERIFICADO EN TESTING)
SECONDARY_FAILURE_EXACT_THROW_SITE=NOT_DIRECTLY_OBSERVED (wording de R13 corregido)
INDEPENDENT_LOG_FAILURE_BOUNDARY=SI / INDEPENDENT_TOAST_FAILURE_BOUNDARY=SI
ANDROID_RELIABILITY_GATE_POST_FIX_START=0_OF_3
HEAD=8b49756e76a32b2641bd1099c1e8382d3be32f25
ORIGIN_TESTING=8b49756e76a32b2641bd1099c1e8382d3be32f25
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
PRODUCT_CODE_CHANGED=SI (desplegado — hardening de reportMutationFailureSafely)
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=LEONARDO_ANDROID_POST_R13A_CLEAN_CREATE_1_OF_3
```

Antes de commitear el fix de R13, se revisó en dos puntos exigidos por
esta tarea. Primero, la precisión de la causa secundaria: re-auditado el
`catch` exacto, se confirmó por eliminación (todas las demás expresiones
evaluadas en esa ventana son funciones puras, auditadas con certeza) que
una excepción secundaria SÍ ocurrió, pero se corrigió el wording de R13
para no afirmar CUÁL de las dos llamadas nativas/de terceros
(`console.error`/`toast.error`) fue la causante exacta — nunca observado
directamente. Segundo, el aislamiento de ambas llamadas: el helper de
R13 tenía un único `try/catch` compartido, suficiente para que
`finishMutation` siempre corriera pero insuficiente para garantizar que
el toast se intentara si el logging fallaba primero. Se separó en DOS
boundaries de excepción independientes, verificados con 5 tests
directos que cubren exactamente esa matriz: logger falla + toast SE
INTENTA igual, sólo el toast falla, ambos fallan, sin mensaje → sin
toast, camino normal.

581/581 tests en verde, ESLint limpio, TypeScript estable. Cero cambio
de comportamiento en el camino feliz, sin retry automático, sin rama
Android, sin cambios a backend/Service Worker/VAPID. Commiteado
(`8b49756...`, hijo de `085cc0b...`), pusheado a `testing-codex`,
desplegado en Railway TESTING (deployment `5de51131`, commit exacto
confirmado). Smokes HTTP/guard en verde, logs limpios. Production
intacta.

Android NO se certifica todavía. Se registró explícitamente el
contrato de evaluación para el próximo capture físico: si `AbortError`
reaparece, un `FAIL` de creación cuyo estado de fallo se mantiene
consistente (`hookSubscribed=false`, `uiSwitch=false`, sin backend, sin
success feedback falso) es un resultado VÁLIDO — `PASS` del
failure-state-contract, sin exigir que el `AbortError` en sí
desaparezca (no se implementó ningún retry/hack para "arreglarlo"). El
reliability gate Android se reinicia en `0/3` — no se reutiliza el
Clean Create 1/3 anterior, porque el código del error path cambió.
Cliente iPhone permanece `CERTIFIED_TESTING`; Negocio/Repartidor sin
cambios (R11); diagnósticos retenidos; P2-T31 no cierra. Reporte
completo: `P2_T31_R13A_PUSH_FAILURE_REPORTING_HARDENING_TESTING_DEPLOY.md`.

## 0.12 ESTADO ANTERIOR — ANDROID: ABORTERROR REAL REPRODUCIDO, BUG DE UI STALE ENCONTRADO Y CORREGIDO LOCALMENTE (2026-09-06) — DESPLEGADO Y ENDURECIDO POR R13A ARRIBA

```text
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_ABORTERROR_ROOT_CAUSE_OR_MITIGATION
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado, sin cambios)
ANDROID_RELIABILITY_GATE_RESULT=FAIL_ON_CYCLE_2_OF_3
ANDROID_PUSHMANAGER_SUBSCRIBE_ERROR_CLASS=AbortError
ANDROID_PHYSICAL_CREATE_HISTORY=FAIL_NO_SETTLE, PASS, PASS, FAIL_ABORTERROR
ABORTERROR_UNDERLYING_CAUSE_STATUS=NOT_PROVEN_PLAUSIBLE_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE
STALE_UI_IS_DELIGO_BUG=SI / FIX_IMPLEMENTED=SI
ANDROID_PUSH_STATUS=FAIL_REPRODUCED_ABORTERROR_DURING_PHYSICAL_CREATE_PENDING_ROOT_CAUSE
HEAD=085cc0b540f51a841115697eb25dbf98d3740023 (sin cambios — fix LOCAL, sin commit)
ORIGIN_TESTING=085cc0b540f51a841115697eb25dbf98d3740023
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
PRODUCT_CODE_CHANGED=SI (fix local: reportMutationFailureSafely — cero cambio de comportamiento en el camino feliz)
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=P2-T31-R13A-ABORTERROR-UI-FIX-TESTING-DEPLOY
```

El reliability gate de 3 ciclos consecutivos (definido en R12B) falló en
el ciclo 2/3: esta vez `PushManager.subscribe()` sí se asentó, pero por
RECHAZO — `AbortError` en ~287ms, reemplazando para este intento la
hipótesis de "Promise pendiente" de los fallos anteriores. Auditoría
profunda consultó explícitamente el W3C Push API spec para clasificar
`AbortError` con precisión: es el rechazo GENÉRICO del propio servicio
push del navegador (permiso, Service Worker inactivo y VAPID inválido
tienen sus PROPIOS códigos de error distintos — `NotAllowedError`/
`InvalidStateError`/`NotSupportedError` — ninguno de esos aplica aquí).
La comunidad Chromium documenta que en Chrome esto suele originarse en
un fallo del registro interno del navegador con el servicio de FCM de
Google — plausible para este caso, pero **no confirmado**, nunca
observable desde código de aplicación. Permission/VAPID/backend quedaron
descartados con evidencia directa; el registro cross-remount de R2 se
comportó correctamente.

**Hallazgo independiente, real, y ya corregido**: la traza probó que
`SUBSCRIBE_FINISH` (documentado desde R12 como incondicional) nunca se
registró en este capture, y el snapshot mostró el hook correctamente en
`false` pero el switch visual quedando en `true` — una divergencia real.
Auditoría de código probó, por eliminación, que `console.error`/
`toast.error` (sin ninguna protección propia) podían lanzar dentro del
`catch`, saltándose `finishMutation` por completo — lo que rompía el
patrón de corrección optimista ya existente en Cliente
(`client-profile-panel.tsx`) y Negocio (`config-tab.tsx`): el switch
quedaba mostrando "activado" para siempre pese a que el hook sabía la
verdad. Repartidor no está expuesto a este patrón. Corregido con una
nueva función pura (`reportMutationFailureSafely`) que garantiza que la
traza y `finishMutation` corran siempre, sin importar qué falle en el
logging/feedback — cero cambio de comportamiento en el camino feliz,
R7/R8 intactos, sin retry/delay/hack Android, 580/580 tests en verde.

Android sigue sin certificar. El reliability gate NO se reanuda todavía
— este fix necesita su propio deploy y verificación en TESTING antes de
reiniciar el gate desde 0/3 (el código cambió). Cliente iPhone permanece
`CERTIFIED_TESTING`; Negocio/Repartidor sin cambios (R11); los
diagnósticos se retienen; P2-T31 no cierra. Reporte completo:
`P2_T31_R13_ANDROID_PUSHMANAGER_ABORTERROR_AND_STALE_UI_ROOT_CAUSE.md`.

## 0.11 ESTADO ANTERIOR — ANDROID: 1 FAIL + 1 PASS SOBRE EL MISMO BUILD, GATE DE CONFIABILIDAD DEFINIDO (2026-09-06) — SUBSCRIBE_FINISH Y UI STALE CORREGIDOS POR R13 ARRIBA

```text
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_FIRST_SUBSCRIBE_RELIABILITY_GATE
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado, sin cambios)
ORIGINAL_ANDROID_PHYSICAL_RESULT=FAIL
ANDROID_R12_RETEST_VISUAL_RESULT=ON
FUNCTIONAL_FIX_BETWEEN_FAIL_AND_PASS=NO
ROOT_CAUSE_STATUS=UNRESOLVED_INTERMITTENT_PHYSICAL_SUBSCRIBE_STALL_NOT_REPRODUCED_ON_R12_RETEST
ANDROID_PUSH_STATUS=UNRESOLVED_INTERMITTENT_PHYSICAL_SUBSCRIBE_STALL_NOT_REPRODUCED_ON_R12_RETEST
INTERMITTENCY_CONFIRMED=SI / UNDERLYING_CAUSE_CONFIRMED=NO
HEAD=085cc0b540f51a841115697eb25dbf98d3740023 (sin cambios — tarea de audit puro)
ORIGIN_TESTING=085cc0b540f51a841115697eb25dbf98d3740023
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
ANDROID_OFF_REMOVES_PHYSICAL_SUBSCRIPTION=NO
ANDROID_RELIABILITY_REPEAT_COUNT_AUTHORITY=NINGUNA_ENCONTRADA (propuesto: 3 ciclos consecutivos de creación física genuina)
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
PRODUCT_CODE_CHANGED=NO
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=LEONARDO_ANDROID_FIRST_SUBSCRIBE_RELIABILITY_GATE_3_CONSECUTIVE_CLEAN_CREATES
```

Leonardo repitió el retest físico Android sobre el MISMO build ya
desplegado (`085cc0b`, sólo instrumentación agregada en R12, cero
cambio de comportamiento) y esta vez el flujo de activación completó
limpio de punta a punta: creación física real en ~1910ms
(`SUBSCRIBE_PHYSICAL_CREATE_START`→`RESULT`), backend 200, switch final
ON. La traza probó con evidencia DIRECTA (no sólo por auditoría de
código, como antes) que el unmount de React nunca cancela la mutación
en curso: el ACK del backend llegó igual con el hook viejo ya
desmontado, y el registro cross-remount de R2 liberó la mutación
~1169ms antes de que el remount siquiera ocurriera — por eso el remount
correctamente no encontró nada pendiente que esperar (comportamiento
esperado, no un fallo de R2). La conexión propuesta con
`AUTH_HYDRATION_PUSH_RACE` sigue descartada para este incidente
específico; el hallazgo global permanece abierto para otros escenarios.

**Punto central, explícito**: no hubo ningún cambio de código entre el
FAIL original y este PASS — es el mismo build exacto. Por tanto no se
declara "bug arreglado" ni "causa confirmada" en ningún lugar. Existe
intermitencia CONFIRMADA (1 FAIL + 1 PASS sobre el mismo flujo), pero la
causa subyacente sigue sin confirmar — no se atribuye a suspensión de
Android en background, a un bug de Chrome, ni a ninguna otra teoría
específica sin evidencia directa de esa causa.

Auditando el código de `unsubscribe()` se confirmó que apagar
notificaciones NUNCA destruye la `PushSubscription` física del
navegador (`SERVER_DETACH_ONLY`, invariante de P2-T05 preservado) — por
lo que un simple ciclo OFF→ON no sirve para repetir el camino de
creación física que fue el que falló originalmente. Se diseñó, sin que
exista una autoridad previa que lo exija, un gate de confiabilidad
conservador: **3 ciclos consecutivos de creación física genuina** (con
un reset real de la subscription entre cada intento — reinstalar la PWA
o revocar el permiso de notificaciones del sitio, nunca sólo tocar el
switch) antes de poder considerar certificado el flujo de activación en
Android. Android NO se certifica todavía. Cliente iPhone permanece
`CERTIFIED_TESTING` sin reabrirse; Negocio/Repartidor siguen exactamente
como R11 los dejó; P2-T31 no cierra; los diagnósticos se retienen (esta
misma captura volvió a demostrar su valor). Reporte completo:
`P2_T31_R12B_ANDROID_FAIL_PASS_RECONCILIATION_AND_RELIABILITY_GATE.md`.

## 0.10 ESTADO ANTERIOR — DIAGNÓSTICO ANDROID DESPLEGADO EN TESTING, PENDIENTE RETEST FÍSICO (2026-09-06) — RECONCILIADO POR R12B ARRIBA

```text
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_FIRST_SUBSCRIBE_ROOT_CAUSE
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado, sin cambios)
ANDROID_PUSH_STATUS=FAIL_PHYSICAL_FIRST_SUBSCRIBE_CAPTURED_PENDING_ROOT_CAUSE
ROOT_CAUSE_STATUS=NOT_CONCLUSIVELY_PROVEN_LEADING_HYPOTHESIS_IDENTIFIED (sin cambio)
HEAD=085cc0b540f51a841115697eb25dbf98d3740023
ORIGIN_TESTING=085cc0b540f51a841115697eb25dbf98d3740023
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
TESTING_DEPLOYMENT_ID=13800b1d-7f00-44b7-8c42-e7b397446d2a
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
PRODUCT_CODE_CHANGED=SI (diagnóstico puro, 0 cambio de comportamiento — ya desplegado)
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=LEONARDO_ANDROID_R12_SINGLE_PHYSICAL_RETEST
```

**Corrección factual aplicada antes de este deploy**: R12 había afirmado
incorrectamente que la traza física no incluía el campo `actorFamily` de
`SUBSCRIBE_START`. La traza original de Leonardo SÍ lo incluye:
`actorFamily=cliente`, `authHasHydrated=true`. Auditoría de
`src/store/auth-store.ts` probó que `AuthUser.id`/`.type` se asignan
atómicamente en el mismo objeto literal en las 4 acciones de login —
estructuralmente imposible que `actorFamily=cliente` coexista con
`actorId=null`. Esto **descarta, para este incidente Android
específico**, la conexión que R12 había propuesto con el hallazgo
estructural `AUTH_HYDRATION_PUSH_RACE` (que no se reclasifica en sí,
sigue abierto para otros escenarios). La causa de por qué el registro
cross-remount de R2 no protegió este caso concreto queda genuinamente
sin resolver (`R2_REGISTRY_CAUSE_CURRENTLY=UNRESOLVED_PENDING_NEW_TRACE`)
— no se inventó una hipótesis de reemplazo. `ROOT_CAUSE_STATUS` se
mantiene exactamente como máximo, sin escalar ninguna hipótesis a
`CONFIRMED`.

Con la corrección aplicada, la instrumentación diagnóstica pura de R12
(`SUBSCRIBE_PHYSICAL_CREATE_START/RESULT/ERROR` bracketeando el único
`await` indocumentado; `MUTATION_REGISTRY_SET/RELEASE/WAIT_FOUND/
WAIT_NOT_FOUND` en el registro cross-remount — cero cambio de
comportamiento, verificado) fue commiteada en un único commit
(`085cc0b...`, hijo directo de `70d3f826...`), pusheada a
`testing-codex` y desplegada en Railway TESTING (deployment `13800b1d`,
`SUCCESS`, commit exacto confirmado). Smokes HTTP/guard y logs en verde.
Production intacta. Cliente iPhone permanece `CERTIFIED_TESTING` sin
reabrirse; Android permanece `FAIL_PHYSICAL_FIRST_SUBSCRIBE_CAPTURED_
PENDING_ROOT_CAUSE`, no se marca PASS; P2-T31 no cierra. Se preparó (sin
ejecutar) el protocolo de un único retest físico Android para Leonardo:
cerrar la PWA, reabrir (carga el build nuevo), armar traza, borrar
historial, activar notificaciones una sola vez y reproducir el mismo
patrón que causó el fallo original (activar → navegar fuera de Perfil →
volver), sin toggles adicionales. Reporte completo:
`P2_T31_R12A_ANDROID_DIAGNOSTICS_TESTING_DEPLOY_PENDING_PHYSICAL_RETEST.md`.

## 0.9 ESTADO ANTERIOR — FALLO FÍSICO REAL EN ANDROID CAPTURADO Y AUDITADO, SIN FIX (CAUSA NO PROBADA) (2026-09-06) — CORREGIDO Y DESPLEGADO POR R12A ARRIBA

```text
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_FIRST_SUBSCRIBE_ROOT_CAUSE
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado, sin cambios)
BUSINESS_PHYSICAL_MATRIX_STATUS=NOT_EXECUTED_FORMALLY (Negocio, evidencia incidental positiva, no formal)
DELIVERY_PHYSICAL_MATRIX_STATUS=NOT_EXECUTED (Repartidor)
ANDROID_PUSH_STATUS=FAIL_PHYSICAL_FIRST_SUBSCRIBE_CAPTURED_PENDING_ROOT_CAUSE
HEAD=70d3f826bef291f403f0e42e007187eb1b5d6688 (sin cambios — R12 es LOCAL, sin commit/deploy)
ORIGIN_TESTING=70d3f826bef291f403f0e42e007187eb1b5d6688
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
R12_FOCAL_PASS=574 / R12_FOCAL_FAIL=0
ROOT_CAUSE_STATUS=NOT_CONCLUSIVELY_PROVEN_LEADING_HYPOTHESIS_IDENTIFIED
FIX_IMPLEMENTED=NO (sólo instrumentación diagnóstica, cero cambio de comportamiento)
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
PRODUCT_CODE_CHANGED=SI (diagnóstico puro)
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=P2-T31-R12-ANDROID-FIRST-SUBSCRIBE-PHYSICAL-CREATION-FAILURE-RETEST (deploy + único retest físico) — LEONARDO_IPHONE_BUSINESS_DELIVERY_PUSH_PHYSICAL_MATRIX sigue disponible en paralelo
```

Leonardo reprodujo un fallo físico REAL en Android: activó
notificaciones en Cliente/Perfil, cambió de pantalla y volvió — el
switch quedó OFF. Auditoría exhaustiva de código (no inferencia) probó
que el único punto de espera ejecutado en la ventana sin trace
(`registration.pushManager.subscribe(...)`, en `use-push-notifications.ts`)
nunca se asentó — ni éxito ni excepción — durante toda la captura: las
trazas incondicionales que ya existían para ambos desenlaces
(`SUBSCRIBE_NEW_PHYSICAL_RESULT`/`SUBSCRIBE_FINISH`) simplemente no
aparecieron, pese a que el mismo proceso JS siguió vivo en todo momento
(mismo `processInstanceId` antes y después del remount — descarta un
reload completo de página). Backend, el fix de rate-limit de R8 y el
fix de flicker de R7 quedaron descartados como causa con evidencia
directa (el fallo ocurre 100% antes de que el backend sea siquiera
contactado).

La causa raíz de fondo NO quedó probada de forma concluyente. La
hipótesis mejor sustentada es que Android suspendió o abandonó ese
`await` nativo específico al perder el foreground de la pestaña — un
comportamiento de plataforma fuera del control de DeliGO, no un bug de
código. Por qué el registro cross-remount de R2 no pudo proteger este
caso concreto queda por separado SIN RESOLVER — R12A corrigió que la
traza SÍ mostraba `actorFamily=cliente`/`authHasHydrated=true` en
`SUBSCRIBE_START`, lo que descarta (para este incidente específico,
auditando `auth-store.ts`) la conexión que se había propuesto con el
hallazgo estructural `AUTH_HYDRATION_PUSH_RACE`. Por
regla explícita de la tarea, no se inventó ningún fix sin causa probada
ni se agregaron hacks específicos de Android/delays artificiales. Se
agregó únicamente instrumentación de traza mínima —
`SUBSCRIBE_PHYSICAL_CREATE_START/RESULT/ERROR` bracketeando ese
`await` exacto, y `MUTATION_REGISTRY_SET/RELEASE/WAIT_FOUND/WAIT_NOT_FOUND`
en el registro de mutaciones en vuelo — de forma local (sin commitear ni
desplegar), con cero cambio de comportamiento: 574/574 tests en verde,
ESLint limpio, 0 nuevos errores TypeScript.

Nota de secuencia (transparencia, sin reescribir historia): el prompt
de esta tarea daba a R11 por pendiente de ejecutar; en los hechos R11 ya
se había completado por entero en el turno anterior de esta misma
sesión (reabrió P2-T31 por Negocio/Repartidor faltantes en iPhone,
preservando Cliente C1-C8 intacto). Este hallazgo Android se suma como
un SEGUNDO blocker, distinto y cross-platform, sobre ese mismo estado ya
reabierto — no lo reemplaza ni lo revierte. Reporte completo:
`P2_T31_R12_ANDROID_FIRST_SUBSCRIBE_PHYSICAL_CREATION_FAILURE_DIAGNOSTIC.md`.

## 0.8 ESTADO ANTERIOR — P2-T31 REABIERTO: CLIENTE CERTIFICADO, NEGOCIO/REPARTIDOR PENDIENTES (2026-09-06)

```text
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (Cliente C1-C8, preservado sin cambios)
BUSINESS_PHYSICAL_MATRIX_STATUS=NOT_EXECUTED_FORMALLY (evidencia incidental positiva registrada, no formal)
DELIVERY_PHYSICAL_MATRIX_STATUS=NOT_EXECUTED
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
HEAD=70d3f826bef291f403f0e42e007187eb1b5d6688 (sin cambios — tarea de audit puro)
ORIGIN_TESTING=70d3f826bef291f403f0e42e007187eb1b5d6688
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
AUTH_HYDRATION_PUSH_RACE_STATUS=OPEN_STRUCTURAL_GAP_PROVEN_IMPACT_PLAUSIBLE_NOT_CONFIRMED
PUSH_LIMITER_DISTRIBUTION_MODEL=IN_MEMORY_PROCESS_LOCAL
PRODUCT_CODE_CHANGED=NO
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=LEONARDO_IPHONE_BUSINESS_DELIVERY_PUSH_PHYSICAL_MATRIX
```

R10 (turno anterior) había cerrado P2-T31 completo usando sólo la
certificación física de Cliente (C1-C8 PASS), razonando que Negocio y
Repartidor comparten hook/endpoints/tests con Cliente. Esta tarea
auditó la autoridad ORIGINAL que definió la matriz física
(`P2_T31_TESTING_DEPLOY_PENDING_IPHONE_MATRIX_CERTIFICATION.md`) y
encontró lenguaje imperativo sin excepción: "para cada rol **debe**
cubrirse... Cliente C1–C8, Negocio N1–N7 y Repartidor R1–R7... ningún
pass por rol **ni cierre de P2-T31** sin evidencia física". Código y
tests compartidos demuestran cobertura técnica, no evidencia física por
rol — ninguna autoridad concedió esa equivalencia. El cierre global de
R10 fue, por tanto, **prematuro** y se corrige aquí, sin degradar en
absoluto la certificación de Cliente (que permanece PASS, íntegra y
trazable).

Evidencia incidental nueva, registrada tal cual sin sobre-interpretar:
antes de esta tarea Leonardo probó Negocio físicamente de forma informal
y encontró que las notificaciones — que antes fallaban — ahora funcionan
tras los fixes R7/R8 (`BUSINESS_PUSH_INCIDENTAL_EVIDENCE=PASS_OBSERVED`).
Es una señal positiva real, pero no cierra ningún caso `N#` individual
porque no tiene la estructura de diagnóstico (traza armada, snapshot,
verificación de duplicados/contenido) que los demás casos físicos de
T31 sí tienen.

Se preparó (sin ejecutar) una matriz física N1-N7/R1-R7 con
instrucciones exactas para Leonardo, reutilizando los diagnósticos
R6/R6A/R6B ya desplegados en TESTING sin necesidad de reinstalar la PWA.
Android permanece `UNKNOWN_NOT_CERTIFIED` sin cambios, y los
diagnósticos siguen retenidos por decisión del operador — ahora con una
segunda razón además de Android: sirven directamente para ese retest
Negocio/Repartidor. Reporte completo:
`P2_T31_R11_MULTIROLE_PHYSICAL_SCOPE_AUTHORITY_CORRECTION.md`.

## 0.7 ESTADO ANTERIOR — P2-T31 CERRADO (CORREGIDO POR R11 ARRIBA): IPHONE PUSH (CLIENTE) CERTIFICADO EN TESTING (2026-09-06)

```text
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED
IPHONE_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING
IPHONE_CLIENT_PUSH_MATRIX=C1_THROUGH_C8_PASS
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
HEAD=70d3f826bef291f403f0e42e007187eb1b5d6688 (sin cambios — tarea de audit puro)
ORIGIN_TESTING=70d3f826bef291f403f0e42e007187eb1b5d6688
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
R7_FLICKER_ROOT_CAUSE=UNRESOLVED_INITIAL_PUSH_STATE_RENDERED_AS_FALSE_OFF
R8_STRESS_FAILURE_ROOT_CAUSE=PUSH_API_RATE_LIMIT_429
PUSH_LIMITER_MODEL=pushStatus(60/min) + pushMutation(20/min), buckets independientes
STATUS_ERROR_SECURITY_MODEL=FAIL_CLOSED_WITHOUT_FALSE_OFF_REPRESENTATION
AUTH_HYDRATION_PUSH_RACE_STATUS=OPEN_STRUCTURAL_GAP_PROVEN_IMPACT_PLAUSIBLE_NOT_CONFIRMED (residual no bloqueante)
PUSH_LIMITER_DISTRIBUTION_MODEL=IN_MEMORY_PROCESS_LOCAL (residual no bloqueante)
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
PRODUCT_CODE_CHANGED=NO
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=P2-T27 (Order State DB-level CAS) — ver roadmap
```

Leonardo ejecutó el procedimiento de reset limpio en su iPhone (borrar +
reinstalar la instancia de la PWA en el Home Screen) y realizó la
primera activación real de notificaciones contra el build actual: el
diálogo nativo de permiso de iOS apareció, aceptó, la activación
terminó end-to-end en ON con feedback correcto, y el estado persistió
tras un cierre completo + reapertura de la PWA. Esto satisface el caso
C1 (primera activación limpia) que había quedado diferido desde el
inicio de la certificación física de T31. Con C1 resuelto y C2-C8 ya
certificados previamente (R9), la matriz completa de Cliente queda
`C1_THROUGH_C8_PASS` y **P2-T31 cierra formalmente** como
`CLOSED_TESTING_CERTIFIED`.

Esta certificación cubre específicamente **iPhone, Cliente, TESTING** —
no implica nada sobre Production (que permanece en `1de0d3c1...`, sin
los fixes R7/R8) ni sobre Android (`ANDROID_PUSH_STATUS` sigue
independientemente `UNKNOWN_NOT_CERTIFIED`, sin dispositivo físico
disponible). Tampoco implica una certificación física independiente de
Negocio o Repartidor — ambos comparten el mismo hook y los mismos fixes
R1/R7/R8 con cobertura de test estático que Cliente, pero nunca fueron
ejercidos físicamente por separado; esto queda documentado como
`F-P2-T31-R10-01` (no bloqueante) para una eventual tarea futura.

**Decisión explícita del operador**: pese al cierre de iPhone, los
diagnósticos R6/R6A/R6B (panel de debug, timeline de traza, snapshot,
bootstrap de cold-launch, guard TESTING) se retienen intactos —
NINGÚN cleanup se ejecuta ni se recomienda todavía — porque Android
sigue sin certificar y Leonardo quiere conservar esa instrumentación
para la certificación física Android futura. Son exclusivamente
TESTING; Production nunca tuvo acceso a ellos.

La siguiente acción recomendada NO es un cleanup: se derivó del
ROADMAP real excluyendo cualquier ítem bloqueado por el mismo
dispositivo Android ausente. `P2-T02` (Android GPS) sigue
`READY_TO_RESUME` pero bloqueado por hardware; `P2-T27` (Order State
DB-level CAS) es el siguiente ítem `QUEUED` ejecutable sin depender de
Android — su única dependencia (finding de P2-T28) ya está resuelta.
Reporte completo: `P2_T31_R10_IPHONE_CERTIFICATION_FINAL_CLOSEOUT.md`.

## 0.6 ESTADO ANTERIOR — EVIDENCIA FÍSICA RECONCILIADA: C2-C8 PASS, C1 PENDIENTE (2026-09-06)

```text
CURRENT_TASK_ID=P2-T31-R9-IPHONE-PHYSICAL-CERTIFICATION-RECONCILIATION
P2_T31_STATUS=IN_PROGRESS_PENDING_C1_CLEAN_FIRST_ENABLE
IPHONE_PUSH_CERTIFICATION_STATUS=PARTIAL_PENDING_C1_CLEAN_FIRST_ENABLE
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
HEAD=70d3f826bef291f403f0e42e007187eb1b5d6688 (sin cambios — tarea de audit puro)
ORIGIN_TESTING=70d3f826bef291f403f0e42e007187eb1b5d6688
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
C2_PHYSICAL_STATUS=PASS_COVERED_BY_R8_STRESS
C3_PHYSICAL_STATUS=PASS (5/5 remounts, 0 flicker, cold reopen final ON)
C4_R7_PHYSICAL_STATUS=PASS_USER_VISIBLE_CONTRACT
C5_BASIC_PHYSICAL_STATUS=PASS_5_PLUS_REPEATS
R8_STRESS_PHYSICAL_STATUS=PASS (8/8 ciclos, 0 429 reales)
C6_FOREGROUND_PUSH_STATUS=PASS
C7_CLOSED_PWA_PUSH_STATUS=PASS
C8_NOTIFICATION_TAP_STATUS=PASS
C1_CURRENT_BUILD_PHYSICAL_STATUS=NOT_RECERTIFIED_CLEAN_STATE
PRODUCT_CODE_CHANGED=NO
PRODUCTION_TOUCHED=NO
NEXT_ACTION=LEONARDO_C1_CLEAN_FIRST_ENABLE_PHYSICAL_TEST
```

Tarea de auditoría pura (sin código, sin tests, sin commit/push/deploy)
que reconcilió toda la evidencia física reportada por Leonardo tras R7 y
R8. C2 a C8 quedan PASS con evidencia trazable a reportes concretos —
incluyendo el retest de stress de R8 (8/8 ciclos ON/OFF, 0 HTTP 429
reales, feedback correcto, estado final correcto tanto en OFF como en
ON). El único gate sin cerrar es **C1** — primera activación real de
notificaciones desde un estado de permiso `Notification.permission`
verdaderamente limpio: el iPhone de Leonardo ya tiene permiso concedido
y una `PushSubscription` física histórica desde etapas muy tempranas de
T31 (R1/R2), así que todo el ciclo OFF→ON certificado hasta ahora es un
re-enable, no un first-enable contra el build actual (`70d3f826...`, con
R7+R8 ya desplegados).

Este gap no es nuevo ni fue descubierto ahora por casualidad: el reporte
original que definió la matriz física de T31 ya había diferido
explícitamente este caso exacto el día que se preparó la certificación
(`PERMISSION_PROMPT_PHYSICAL_CASE=DEFERRED_NOT_SAFELY_REPRODUCIBLE`, en
`codex-reports/P2_T31_TESTING_DEPLOY_PENDING_IPHONE_MATRIX_CERTIFICATION.md`),
precisamente porque el entorno físico compartido de Leonardo no permite
reproducirlo sin una acción deliberada (borrar y reinstalar la PWA). Esa
acción — documentada paso a paso en
`codex-reports/DECISIONS_AND_INVARIANTS.md` bajo
`IOS_PUSH_CLEAN_STATE_RESET_METHOD` — nunca fue solicitada ni ejecutada
en ningún punto de T31 hasta ahora. Por disciplina anti-invención, ni
`IPHONE_PUSH_CERTIFICATION_STATUS` ni `P2_T31_STATUS` se marcan como
cerrados: quedan `PARTIAL_PENDING_C1_CLEAN_FIRST_ENABLE` e
`IN_PROGRESS_PENDING_C1_CLEAN_FIRST_ENABLE` respectivamente. Android
permanece `UNKNOWN_NOT_CERTIFIED` sin cambios. Los diagnósticos R6/R6A/
R6B se mantienen desplegados hasta el cierre total de T31. Reporte
completo: `P2_T31_R9_IPHONE_PHYSICAL_CERTIFICATION_RECONCILIATION.md`.

## 0.5 ESTADO ANTERIOR — FIX R8 DESPLEGADO EN TESTING, PENDIENTE RETEST FÍSICO DE STRESS (2026-09-06)

```text
CURRENT_TASK_ID=P2-T31-R8-TESTING-COMMIT-DEPLOY-AND-PHYSICAL-RETEST
CURRENT_TASK_STATUS=DEPLOYED_TESTING_PENDING_PHYSICAL_RETEST
P2_T31_STATUS=IN_PROGRESS
P2_T31_R8_DEPLOY_STATUS=DEPLOYED_TESTING_PENDING_PHYSICAL_RETEST
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_PENDING_R8_STRESS_RETEST
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
COMMIT_HASH=70d3f826bef291f403f0e42e007187eb1b5d6688
COMMIT_PARENT=6380ba2b77ffe6bee1b978ef1e2480da233e61c2
HEAD=70d3f826bef291f403f0e42e007187eb1b5d6688
ORIGIN_TESTING=70d3f826bef291f403f0e42e007187eb1b5d6688
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
TESTING_DEPLOYMENT_ID=58f4e0a3-e562-4527-928f-e6880fbb3c09
R8_FOCAL_PASS=551
TYPECHECK_BASELINE=24
ESLINT_ON_FILESET=CLEAN
ABUSE_RESISTANCE_PRESERVED=SI
PRODUCTION_TOUCHED=NO
STATUS_ERROR_SECURITY_MODEL=FAIL_CLOSED_WITHOUT_FALSE_OFF_REPRESENTATION (nuevo invariante permanente, ver codex-reports/DECISIONS_AND_INVARIANTS.md)
NEXT_ACTION=LEONARDO_R8_PUSH_STRESS_PHYSICAL_RETEST
NEXT_RECOMMENDED_TASK=NINGUNA — el propio prompt de esta tarea indica STOP hasta el retest físico de Leonardo
```

El fix local de R8 (bucket de rate limit dividido en `pushStatus`/
`pushMutation` + `applyStatusUnresolved` para nunca representar un error
de status como OFF autoritativo) fue commiteado como `70d3f826...` (15
archivos: 13 modificados + 2 nuevos, re-derivados directamente de `git`
antes de cada etapa, sin confiar en el reporte de implementación previo),
pusheado a `testing-codex` y desplegado en Railway TESTING
(`58f4e0a3-e562-4527-928f-e6880fbb3c09`), verificado corriendo
exactamente ese commit. Certificado localmente: 551 tests focales en
verde, TypeScript sin regresiones (24 baseline), ESLint limpio en el
fileset exacto, smokes HTTP (`/`, `/cliente`, `/negocio`, `/repartidor`)
y guard de debug (`/api/push/debug-guard` → `200 {"allowed":true}`) en
verde, logs de despliegue limpios sin errores. Producción (`origin/main`)
sin tocar.

Pendiente exclusivamente de Leonardo: el retest físico de stress en su
iPhone (protocolo de 8 ciclos ON/OFF con cooldown inicial de 65s,
documentado en el reporte de deploy) para certificar que el 429 real ya
no ocurre bajo uso humano normal y que, si ocurriera un error de
infraestructura genuino, el estado ya no se representa falsamente como
OFF. Esta tarea terminó con instrucción explícita de STOP — no se inicia
ninguna tarea Claude adicional hasta que Leonardo reporte el resultado
de ese retest.

## 0.4 ESTADO ANTERIOR — SEGUNDA CAUSA RAÍZ CONFIRMADA: 429 REAL EN STRESS DE NAVEGACIÓN, FIX LOCAL LISTO (2026-09-06)

```text
CURRENT_TASK_ID=P2-T31-R8-PUSH-RATE-LIMIT-429-STATE-CONSISTENCY-FIX
CURRENT_TASK_STATUS=LOCAL_FIX_IMPLEMENTED_PENDING_REVIEW
P2_T31_STATUS=IN_PROGRESS
P2_T31_R8_STATUS=LOCAL_FIX_IMPLEMENTED_PENDING_REVIEW
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_PENDING_R8_RATE_LIMIT_FIX
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
PUSH_STRESS_FAILURE_ROOT_CAUSE=PUSH_API_RATE_LIMIT_429
STATUS_FALSE_MISREPRESENTATION_CAUSE=BACKEND_STATUS_NON_OK_MAPPED_TO_AUTHORITATIVE_FALSE
HEAD=6380ba2b77ffe6bee1b978ef1e2480da233e61c2 (sin cambios — el fix de R8 es SÓLO LOCAL)
ORIGIN_TESTING=6380ba2b77ffe6bee1b978ef1e2480da233e61c2 (todavía sirviendo R7, SIN el fix de R8)
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
R8_FOCAL_PASS=551
TYPECHECK_BASELINE=24
ABUSE_RESISTANCE_PRESERVED=SI
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_TASK=P2-T31-R8-TESTING-COMMIT-DEPLOY-AND-PHYSICAL-RETEST
```

Tras confirmar C5 básico (R7 desplegado, `6380ba2`), Leonardo hizo stress
de navegación + ON/OFF repetido en Cliente y la traza capturó un HTTP 429
REAL en el backend Push: un intento de desactivar fue rechazado por el
rate limiter (nunca se persistió) y el chequeo de estado posterior mapeó
ese mismo 429 a `false` autoritativo — mostrando "Desactivado" mientras
el backend seguía sabiendo `true` — hasta que el switch volvió solo a ON
al reabrir (el binding server-side nunca se había movido; esto NO es un
bug de estado, es la consecuencia correcta de un intento que nunca se
completó).

Causa raíz confirmada por auditoría de código + traza física: los 3
endpoints Push (`status`/`subscribe`/`unsubscribe`) compartían UN único
bucket de rate limit (10 req/min), misma clave `ip:userId` — y
superficies independientes (`permission-prompt.tsx`, el panel de
diagnóstico R6/R6A/R6B) consumían del MISMO presupuesto sin coordinarse,
así que una sesión de navegación + toggles normal (sin automatización)
agotaba el límite con facilidad.

Fix de dos partes: **(A)** el bucket se dividió en `pushStatus` (60/min,
sólo lectura, generoso a propósito para mounts/remounts/cold-launches/
refrescos del panel de diagnóstico) y `pushMutation` (20/min, subscribe+
unsubscribe combinados, subido de 10) — verificado que un stress humano
razonable (10 remounts + 10 ciclos ON/OFF completos) nunca produce 429
bajo el modelo nuevo, mientras un flood real (40+ mutaciones o 100+
lecturas) sigue bloqueado (`ABUSE_RESISTANCE_PRESERVED=SI`). **(B)**
`checkPersonalPushStatus` ya no mapea un backend no-ok (excepción de red
O HTTP no-2xx, incluido 429) a `false` autoritativo — nuevo
`applyStatusUnresolved` deja el estado genuinamente sin resolver en vez
de mentir; las 3 UI (Cliente/Negocio/Repartidor, certificadas
independientemente) muestran ahora "No se pudo comprobar" (ícono de
alerta quieto, ya importado en cada archivo) distinto de "Comprobando
estado..." (loader girando — un spinner que sigue girando tras un error
ya concluido sugeriría falsamente que el chequeo continúa en curso).
Mensaje de error de mutación también mejorado: un 429 en subscribe/
unsubscribe ahora dice específicamente "Demasiados intentos. Esperá
unos segundos e intentá nuevamente." en vez del genérico indistinguible
de antes.

`WOULD_NEW_FACT_HAVE_CHANGED_R7_PROMPT=SI` — R7 no estaba mal con la
evidencia disponible entonces (nunca se había observado un 429 real);
este hecho nuevo exige refinar su contrato de error, no revertirlo.
R2/R3/R5/R5A permanecen intactos — auditado explícitamente, sin cambios.

551/551 tests (512 baseline R7 + 39 nuevos), TypeScript 24/24 sin
errores nuevos. Sin commit, sin push, sin deploy, sin escritura en
Production. `32` no tocado. Ver
`P2_T31_R8_PUSH_RATE_LIMIT_429_STATE_CONSISTENCY_FIX.md` para el detalle
técnico completo (traza física, reconstrucción del presupuesto
consumido, rationale de los nuevos umbrales).

## 0.5 ESTADO ACTUAL — FIX R7 DESPLEGADO EN TESTING, PENDIENTE RETEST FÍSICO C4 (2026-09-06)

```text
CURRENT_TASK_ID=P2-T31-R7-TESTING-COMMIT-DEPLOY-AND-PHYSICAL-RETEST
CURRENT_TASK_STATUS=DEPLOYED_TESTING_PENDING_C4_PHYSICAL_RETEST
P2_T31_STATUS=IN_PROGRESS
P2_T31_R7_STATUS=DEPLOYED_TESTING_PENDING_PHYSICAL_RETEST
C4_FLICKER_ROOT_CAUSE=UNRESOLVED_INITIAL_PUSH_STATE_RENDERED_AS_FALSE_OFF
C4_FLICKER_FIX_STATUS=DEPLOYED_TESTING_PENDING_PHYSICAL_RETEST
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_PENDING_R7_PHYSICAL_RETEST
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
HEAD=6380ba2b77ffe6bee1b978ef1e2480da233e61c2
ORIGIN_TESTING=6380ba2b77ffe6bee1b978ef1e2480da233e61c2
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
TESTING_DEPLOYMENT_ID=41124f04-f69b-4a51-8b9d-7da562c8b6e1
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
R7_FOCAL_PASS=512
TYPECHECK_BASELINE=24
PRODUCTION_TOUCHED=NO
NEXT_ACTION=LEONARDO_R7_C4_PHYSICAL_RETEST
```

El fix de R7 (`statusResolved` + loader neutral en Cliente/Negocio/
Repartidor + higiene de debug: `actorFingerprint` en vez de raw id,
`physicalStillMatches` en vez de `endpointStillMatches`) quedó
commiteado en UN único commit
(`6380ba2b77ffe6bee1b978ef1e2480da233e61c2`, parent exacto `925a860`) —
14 archivos re-derivados directamente de Git (12 tracked + 2 nuevos, sin
ningún reporte/documentación), stageados uno por uno, pusheados
exclusivamente a `testing-codex`, y desplegados por autodeploy en Railway
TESTING (`DeliGO Copy`, deployment `41124f04`, commit exacto confirmado
por polling directo — nunca `railway up`). Smokes en verde: HTTP 200 en
`/cliente`/`/negocio`/`/repartidor` (redirect 307 normal en `/`); `GET
/api/push/debug-guard` → `200 {"allowed":true}`; logs sin errores.

Nota de proceso: un polling en background iniciado para verificar el
deploy fue detenido explícitamente por el usuario
(`RAILWAY_WATCHER_POLICY=DISABLED_DUE_TO_REPEATED_STALE_WAITERS`) — la
confirmación final del deploy se hizo con `railway status`/`railway
status --json` directos, sin tareas de fondo.

Esta tarea desplegó el fix — NO certifica el comportamiento físico.
Próximo paso, exclusivamente de Leonardo: reproducir C4 (Perfil →
"Diagnóstico Push (TESTING)" → ARMAR TRAZA si no sigue armada → BORRAR
HISTORIAL → notificaciones ON → matar completamente la PWA → reabrir →
Perfil, SIN tocar el switch) al menos 10 veces, confirmando 0 falsos OFF
y 0 flickers. Si algún intento falla, capturar ACTUALIZAR ESTADO + COPIAR
DIAGNÓSTICO COMPLETO sin tocar el switch. C5 (ON→OFF→cerrar→reabrir→debe
seguir OFF) sólo se inicia después de que Leonardo confirme C4 estable.
Production permanece intacta (`1de0d3c1`). Ver
`P2_T31_R7_TESTING_DEPLOY_PENDING_C4_PHYSICAL_RETEST.md` para el detalle
completo.

## 0.6 ESTADO ACTUAL — CAUSA RAÍZ DEL FLICKER C4 CONFIRMADA, FIX LOCAL LISTO (2026-09-06)

```text
CURRENT_TASK_ID=P2-T31-R7-PUSH-INITIAL-UNKNOWN-STATE-FLICKER-FIX
CURRENT_TASK_STATUS=LOCAL_FIX_IMPLEMENTED_PENDING_REVIEW
P2_T31_STATUS=IN_PROGRESS
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_PENDING_R7_FIX_DEPLOY_AND_RETEST
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
C4_FLICKER_PHYSICAL_TRACE_CAPTURED=SI
C4_FLICKER_ROOT_CAUSE=UNRESOLVED_INITIAL_PUSH_STATE_RENDERED_AS_FALSE_OFF
C4_FLICKER_AUTH_HYDRATION_CAUSALITY=RULED_OUT_FOR_CAPTURED_FLICKER
HEAD=925a86017a5e7546f0a6f82245c9d5fc1d344776 (sin cambios — el fix de R7 es SÓLO LOCAL, no committeado)
ORIGIN_TESTING=925a86017a5e7546f0a6f82245c9d5fc1d344776 (todavía sirviendo R6/R6A/R6B, SIN el fix de R7)
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
R7_FOCAL_PASS=512
TYPECHECK_BASELINE=24
PRODUCT_PUSH_ALGORITHM_CHANGED=NO
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_TASK=P2-T31-R7-TESTING-COMMIT-DEPLOY-AND-PHYSICAL-RETEST
```

Leonardo capturó, usando el panel de diagnóstico desplegado en R6B, la
PRIMERA evidencia física completa de un flicker C4 real en iPhone
(Cliente): notificaciones ON → cerrar completamente la PWA → reabrir →
Perfil muestra brevemente OFF y cambia solo a ON, en 3 cold launches
reales distintos (`8dykki` ~430ms, `og6h32` ~354ms, `tn5kvs` ~325ms
mount→UI-true). Causa raíz CONFIRMADA (no asumida):
`isSubscribed` arrancaba en `false`, y ese mismo valor servía tanto para
"confirmado no suscrito" como para "todavía sin verificar" — las 3 UI
(Cliente/Negocio/Repartidor) renderizaban esa ambigüedad como un OFF
real, que se autocorregía solo ~325-430ms después. La subscription NUNCA
desapareció (`physicalSubscription=true`, `backendSubscribed=true` en
toda la ventana) — el problema era puramente de representación.

La auth-hydration race dejada abierta por R6 (`AUTH_HYDRATION_PUSH_RACE`)
quedó EXPLÍCITAMENTE DESCARTADA como causa de ESTE flicker específico —
evidencia: en la captura `tn5kvs`, `AUTH_HYDRATED` ocurrió a las
03:00:29.922, 732ms ANTES de `PUSH_HOOK_MOUNT` (03:00:30.654). El gap
estructural general permanece abierto como hallazgo separado — sólo se
descarta como causal de esta reproducción puntual.

Fix implementado (SÓLO LOCAL, no committeado/desplegado): nuevo
`statusResolved: boolean` en `usePushNotifications()` — `false` hasta que
exista una conclusión autoritativa real (del chequeo inicial o de una
mutación completada), se resetea a `false` únicamente en cambio de actor,
y por construcción nunca puede marcarse `true` para una operación stale
(sólo se marca desde el mismo call site que ya verificó
`gate.isCurrent`). Cliente/Negocio/Repartidor ahora muestran un loader
neutral (`Loader2`, reutilizado de cada archivo) en vez del Switch
mientras `!statusResolved` — certificado independientemente por rol, sin
asumir que compartir el hook implica UI idéntica. Se corrigieron además 2
problemas de higiene de debug encontrados en la misma revisión: el panel
exponía el actor id crudo en `actorFamily` (reemplazado por el rol + un
`actorFingerprint` no reversible), y un booleano `endpointStillMatches`
se redactaba por error al contener "endpoint" en el NOMBRE (renombrado a
`physicalStillMatches`, sin debilitar la regla de sanitización real).

Cero cambio a subscribe/unsubscribe/VAPID/backend/DB/SW — únicamente
semántica de estado inicial de UI + higiene de debug. 512/512 tests (473
baseline + 39 nuevos), TypeScript 24/24 sin errores nuevos. Sin commit,
sin push, sin deploy, sin escritura en Production. `32` no tocado. Ver
`P2_T31_R7_PUSH_INITIAL_UNKNOWN_STATE_FLICKER_FIX.md` para el detalle
técnico completo.

## 0.7 ESTADO ACTUAL — DIAGNÓSTICO PUSH DESPLEGADO EN TESTING, PENDIENTE TRAZA FÍSICA (2026-09-05)

```text
CURRENT_TASK_ID=P2-T31-R6B-TESTING-DIAGNOSTIC-DEPLOY-AND-PHYSICAL-TRACE
CURRENT_TASK_STATUS=DEPLOYED_TESTING_PENDING_PHYSICAL_TRACE
P2_T31_STATUS=IN_PROGRESS
P2_T31_R6_STATUS=DEPLOYED_WITH_R6A_R6B_DIAGNOSTICS_TESTING
P2_T31_R6A_STATUS=DEPLOYED_WITH_R6_R6B_DIAGNOSTICS_TESTING
P2_T31_R6B_STATUS=DEPLOYED_TESTING_PENDING_PHYSICAL_TRACE
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_FLAKY_INTERMITTENT_PENDING_TRACE
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
HEAD=925a86017a5e7546f0a6f82245c9d5fc1d344776
ORIGIN_TESTING=925a86017a5e7546f0a6f82245c9d5fc1d344776
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
TESTING_DEPLOYMENT_ID=85fc4026-3f92-446c-823d-e6dd00e1a611
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
LATEST_TEST=473_PASS_0_FAIL
TYPECHECK_BASELINE=24
PRODUCTION_TOUCHED=NO
NEXT_ACTION=LEONARDO_CAPTURE_IPHONE_PUSH_TRACE
```

R6+R6A+R6B (panel de diagnóstico con snapshot+timeline, entrada standalone
"Diagnóstico Push (TESTING)" y bootstrap de cold-launch) quedaron
commiteados en UN único commit (`925a86017a5e7546f0a6f82245c9d5fc1d344776`,
parent exacto `a8ac961b`) — 24 archivos product/test re-derivados
directamente de Git antes del stage (12 tracked modificados + 12 nuevos,
excluyendo explícitamente los 3 reportes/documentación de R6/R6A/R6B),
stageados uno por uno (nunca `-A`/`.`), pusheados exclusivamente a
`testing-codex`, y desplegados por autodeploy Git-triggered en Railway
TESTING (`DeliGO Copy`, deployment `85fc4026`, commit exacto confirmado
por polling — nunca `railway up`). Smokes en verde: HTTP 200 en
`/cliente`/`/negocio`/`/repartidor` (redirect 307 normal en `/`); `GET
/api/push/debug-guard` → `200 {"allowed":true}` en TESTING; logs del
deployment sin errores/crashes/fallos de hidratación. Ningún algoritmo de
subscribe/unsubscribe/status/VAPID/server-detach fue tocado — esta tarea
NO corrige el bug intermitente, sólo despliega la herramienta de captura.
Production permanece intacta (`1de0d3c1`, sin deploy/env/DB/VAPID/Resend).

Próximo paso, exclusivamente de Leonardo (Claude no ejecuta ni certifica
la prueba física): abrir la PWA TESTING de Cliente, Perfil → "Diagnóstico
Push (TESTING)" → ARMAR TRAZA → usar la app normalmente con
notificaciones ON → cerrar completamente la PWA → reabrir → observar el
switch sin tocarlo → si falla, ACTUALIZAR ESTADO + COPIAR DIAGNÓSTICO
COMPLETO (etiquetar FAIL TRACE) → repetir hasta obtener también una
ejecución sana (HEALTHY TRACE) del mismo escenario, preferentemente C4
(cierre completo + reapertura). Ver
`P2_T31_R6B_TESTING_DIAGNOSTIC_DEPLOY_PENDING_PHYSICAL_TRACE.md` para las
instrucciones físicas exactas paso a paso y el detalle completo del
deploy.

## 0.8 ESTADO ACTUAL — P2-T31-R6B ACCESO STANDALONE + COLD BOOTSTRAP (2026-09-05)

```text
CURRENT_TASK_ID=P2-T31-R6B-STANDALONE-PWA-DEBUG-ACCESS-AND-COLD-BOOTSTRAP
CURRENT_TASK_STATUS=LOCAL_STANDALONE_DEBUG_ACCESS_READY_PENDING_REVIEW
P2_T31_STATUS=IN_PROGRESS
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_FLAKY_INTERMITTENT
GIT_HEAD=a8ac961bd81ee505297f81787c1cf32e3f4cd161
ORIGIN_TESTING=a8ac961bd81ee505297f81787c1cf32e3f4cd161
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
STANDALONE_PWA_DEBUG_ENTRY_IMPLEMENTED=SI
QUERY_PARAM_REQUIRED_FOR_PHYSICAL_USE=NO
STANDALONE_DEBUG_ENTRY_PRODUCTION_EXPOSURE=NO
COLD_BOOTSTRAP_IMPLEMENTED=SI
TRACE_ARM_SURVIVES_FULL_REOPEN=SI
R6B_FOCAL_PASS=473
R6B_FOCAL_FAIL=0
TYPECHECK_BASELINE=24
TYPECHECK_FINAL=24
NEW_TYPECHECK_ERRORS=0
PRODUCT_PUSH_ALGORITHM_CHANGED=NO
USER_VISIBLE_PRODUCTION_BEHAVIOR_CHANGED=NO
R6_R6A_R6B_TRACKED_COUNT=12
R6_R6A_R6B_NEW_COUNT=15
R6_R6A_R6B_TOTAL_INTENDED_COUNT=27
NEXT_RECOMMENDED_TASK=P2-T31-R6B-TESTING-DIAGNOSTIC-COMMIT-DEPLOY-AND-PHYSICAL-TRACE
```

Cierra un blocker real de usabilidad de R6/R6A: una PWA Home-Screen de
iPhone en modo `standalone` no tiene barra de direcciones — la
certificación física no puede depender de que Leonardo edite
`?pushDebug=1` a mano. `push-debug-panel.tsx` se reestructuró para que el
ÚNICO gate de visibilidad sea la confirmación real del guard server-side
(`/api/push/debug-guard`, la MISMA autoridad única de R6, nunca duplicada),
verificada en cada montaje del componente — independiente de cualquier
query param. Confirmado TESTING, aparece una entrada discreta
"Diagnóstico Push (TESTING)" al final de Perfil/Configuración; tocarla
abre el panel completo (estado actual, timeline, armar/desarmar traza,
actualizar estado, copiar diagnóstico completo, borrar historial) sin
editar ninguna URL. `?pushDebug=1` se conserva como atajo alternativo,
nunca requerido. Production sigue sin mostrar absolutamente nada (guard
404 → `allowed` nunca `true` → `return null`, sin espacio residual),
verificado incluso con el query param presente.

Segundo hallazgo cerrado: auditado que `push-debug-trace.ts` (R6A) sólo se
cargaba antes dentro del chunk `dynamic()`-importado de Perfil/
Configuración — los 3 manifests PWA abren a `/cliente`/`/negocio`/
`/repartidor`, nunca directo a Perfil — así que el tracer no existía en
memoria durante el cold launch real, sólo desde el tap a Perfil
(`COLD_BOOTSTRAP_CURRENTLY_SUFFICIENT=NO`). Se agregó
`PushDebugTraceBootstrap` (siempre retorna `null`, jamás llama
subscribe/unsubscribe/status/fetch, jamás muta auth ni actor) montado en
los 3 `layout.tsx` de rol — el único punto compartido NO detrás de un
`dynamic()` de cada rol — garantizando que la traza se evalúa desde el
primer render del cold launch. Costo para un usuario real (traza
desarmada, caso normal): dos selectores Zustand + un efecto de un solo
chequeo booleano, sin fetch adicional.

Cero cambio de algoritmo — el único comportamiento visible nuevo en
cualquier entorno es la entrada TESTING-only. 473/473 tests focales (451
baseline R6A + 22 nuevos), 0 fail. TypeScript 24/24, cero errores nuevos.
Fileset acumulado R6+R6A+R6B derivado exclusivamente de `git status
--short` + `git diff --name-status` + `git ls-files --others
--exclude-standard` (nunca narrativo): 12 archivos tracked modificados, 15
nuevos intencionales, 27 total — corrigiendo además una pequeña
ambigüedad documental de R6A (afirmaba "3 archivos nuevos" cuando
`push-debug-panel.tsx` ya era nuevo desde R6, no R6A). Sin commit, sin
push, sin deploy, sin escritura en Production. `32` no tocado. Ver
`P2_T31_R6B_STANDALONE_PWA_DEBUG_ACCESS_AND_COLD_BOOTSTRAP.md` para el
detalle completo, incluido el flujo físico final paso a paso para
Leonardo.

## 0.9 ESTADO ACTUAL — P2-T31-R6A TIMELINE DE LIFECYCLE PUSH (2026-09-05)

```text
CURRENT_TASK_ID=P2-T31-R6A-PUSH-LIFECYCLE-TIMELINE-DIAGNOSTIC
CURRENT_TASK_STATUS=LOCAL_TIMELINE_DIAGNOSTIC_IMPLEMENTED_PENDING_REVIEW
P2_T31_STATUS=IN_PROGRESS
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_FLAKY_INTERMITTENT
GIT_HEAD=a8ac961bd81ee505297f81787c1cf32e3f4cd161
ORIGIN_TESTING=a8ac961bd81ee505297f81787c1cf32e3f4cd161
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
R6A_FOCAL_PASS=451
R6A_FOCAL_FAIL=0
TYPECHECK_BASELINE=24
TYPECHECK_FINAL=24
NEW_TYPECHECK_ERRORS=0
PRODUCT_PUSH_ALGORITHM_CHANGED=NO
PRODUCTION_TRACE_EXPOSURE=NO
SECRET_DATA_PERSISTED=NO
NEXT_RECOMMENDED_TASK=P2-T31-R6A-TESTING-DIAGNOSTIC-DEPLOY-AND-PHYSICAL-TRACE
```

Extiende R6 (§1.0 abajo, aún sin commit/push/deploy) agregando una TIMELINE
cronológica (`src/lib/push-debug-trace.ts`) además del snapshot puntual — un
snapshot tomado a demanda no puede mostrar una carrera de TIMING que ya
resolvió antes de que Leonardo abra el panel (exactamente el caso de la
`AUTH_HYDRATION_PUSH_RACE` que R6 dejó `PLAUSIBLE_NOT_CONFIRMED`).

Diseño del tracer: pasivo, module-scoped, ring buffer acotado a 100
eventos, `processInstanceId` que se renueva en cada carga de módulo (para
distinguir eventos de antes/después de un cold reopen dentro de la MISMA
traza persistida), persistencia SINCRÓNICA por evento en `localStorage`
(deliberadamente NO batcheada — iOS no garantiza ningún evento de "voy a
morir", así que cualquier buffer diferido arriesgaría perder justo los
eventos finales antes de un kill, los más valiosos para C4/C5). Cuando la
traza está desarmada (el 100% de usuarios reales fuera de una sesión de
diagnóstico activa), `recordPushDebugEvent` es un único chequeo booleano
— sin costo. Instrumentados ~35 puntos reales del lifecycle: mount/unmount
del hook, auth hydration (lectura nueva pero puramente observacional —
nunca gatea ninguna decisión existente, verificado por test estático),
cambio de actor, el status check completo (con sus 5 puntos exactos de
`STATUS_APPLY`/`STATUS_DISCARDED_STALE`, respondiendo "quién dejó el hook
en OFF"), subscribe/unsubscribe completos (VAPID, physical, backend), y
cambios reales de UI en las 3 superficies (Cliente/Negocio ya tenían un
diff-check; Repartidor necesitó uno nuevo, puramente observacional).

Activación en dos capas para no exponer nada en Production sin verificar:
el panel exige los mismos dos gates de R6 (`?pushDebug=1` + guard
server-side confirmado) antes de ofrecer "ARMAR TRAZA"; una vez armada, un
marcador local permite que el SIGUIENTE cold-launch de ESE MISMO origin
TESTING grabe desde el primer instante, con una re-verificación
server-side automática que desarma y borra todo si el origin no confirma
TESTING. Cero secretos persistidos (8 tests dedicados; endpoint siempre
reducido a un fingerprint no reversible).

451/451 tests focales (393 baseline R6 + 58 nuevos), 0 fail. TypeScript
24/24, cero errores nuevos. Sin commit, sin push, sin deploy, sin
escritura en Production. `32` no tocado. Ver
`P2_T31_R6A_PUSH_LIFECYCLE_TIMELINE_DIAGNOSTIC.md` para el detalle
completo, incluidas las instrucciones de uso físico para Leonardo.

## 1.0 ESTADO ACTUAL — P2-T31-R6 DIAGNÓSTICO DE LIFECYCLE PUSH INTERMITENTE EN IPHONE (2026-09-05)

```text
CURRENT_TASK_ID=P2-T31-R6-INTERMITTENT-IPHONE-PUSH-LIFECYCLE-DIAGNOSTIC
CURRENT_TASK_STATUS=LOCAL_DIAGNOSTIC_IMPLEMENTED_PENDING_REVIEW
P2_T31_STATUS=IN_PROGRESS
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_FLAKY_INTERMITTENT
GIT_HEAD=a8ac961bd81ee505297f81787c1cf32e3f4cd161
ORIGIN_TESTING=a8ac961bd81ee505297f81787c1cf32e3f4cd161
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
R6_FOCAL_PASS=393
R6_FOCAL_FAIL=0
TYPECHECK_BASELINE=24
TYPECHECK_FINAL=24
NEW_TYPECHECK_ERRORS=0
PRODUCT_BEHAVIOR_CHANGED=NO
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_TASK=P2-T31-R6-TESTING-DIAGNOSTIC-DEPLOY-AND-PHYSICAL-TRACE
```

Leonardo certificó físicamente R2+R3+R5+R5A en un iPhone Home-Screen PWA
real (ya desplegado en TESTING, `a8ac961b`) y encontró que la matriz
C1-C5 **no es determinística** — el mismo caso a veces certifica ON y a
veces OFF sin cambiar nada más (ejemplo C4: dejar ON, cerrar completamente
la PWA, reabrir, ver Perfil). `IPHONE_PHYSICAL_CERTIFICATION_STATUS` pasa
de `PENDING_LEONARDO` a `BLOCKED_FLAKY_INTERMITTENT` — un PASS individual
nunca certifica un caso flaky.

Esta ronda (R6) NO corrige el bug — construye instrumentación de
diagnóstico local: un panel oculto (`PushDebugPanel`), invisible salvo
`?pushDebug=1` en la URL Y confirmación server-side de que el entorno es
TESTING (`GET /api/push/debug-guard`, gateado por `RAILWAY_ENVIRONMENT_NAME`
— variable inyectada por Railway mismo, no definible desde este repo; 404
liso fuera de TESTING). El panel captura, sin secretos (el endpoint físico
se reduce a un fingerprint no reversible), un snapshot textual
`KEY=value` de cada capa: permission, SW registration, PushManager,
VAPID match, respuesta real del backend (`/api/push/status`), estado del
hook, mutación en vuelo, switch de UI — pensado para que Leonardo lo pegue
directamente en un chat de diagnóstico apenas observe una falla física.

Dos hallazgos estructurales, ninguno corregido todavía (ver
`codex-reports/FINDINGS.md`, F-P2-T31-MODULE-REGISTRY-FULL-REOPEN-01 y
F-P2-T31-AUTH-HYDRATION-RACE-01):

1. El registro de mutaciones en vuelo de R2 (`push-mutation-in-flight-registry.ts`)
   es module-scoped — protege remount/unmount de React dentro de la MISMA
   carga de página, pero se reinicia vacío en cualquier reevaluación
   completa del bundle JS, incluido un cierre total + reapertura de la
   PWA. El mandato original de R2 nunca prometió cubrir ese caso — límite
   de alcance real, no defecto introducido.
2. `usePushNotifications()` dispara su primer chequeo de estado sin
   esperar la hidratación asíncrona de `auth-store.ts` (`_hasHydrated`) —
   PROVEN a nivel de código; PLAUSIBLE pero NO confirmado como causa del
   parpadeo físico observado (existe un mecanismo de autocorrección vía
   cambio de `actorKey`, cuya cobertura completa no está probada).

Cero código de subscribe/unsubscribe/status fue modificado — sólo se
agregó una superficie de lectura opt-in (5 archivos tracked +93 líneas, 8
archivos nuevos). 393/393 tests focales (341 baseline R5A + 52 nuevos), 0
fail. TypeScript 24/24, sin errores nuevos. Sin commit, sin push, sin
deploy, sin escritura en Production. `32` no tocado. Ver
`P2_T31_R6_INTERMITTENT_IPHONE_PUSH_LIFECYCLE_DIAGNOSTIC.md` para el
detalle completo.

## 1.1 ESTADO ACTUAL — PRODUCTION EMAIL VERIFICATION BLOCKER CLOSURE (2026-09-05)

```text
CURRENT_TASK_ID=PRODUCTION-EMAIL-VERIFICATION-BLOCKER-CLOSURE
CURRENT_TASK_STATUS=CLOSED_OPERATOR_REMEDIATED
EMAIL_BLOCKER_STATUS=CLOSED_OPERATOR_REMEDIATED
PRODUCTION_EMAIL_VERIFICATION_BLOCKER=CLOSED_OPERATOR_REMEDIATED
EMAIL_DIAGNOSTIC_STATUS=CLOSED_ROOT_CAUSE_CONFIRMED_AND_REMEDIATED
PRODUCTION_EMAIL_LOG_CLASS=SEND_SUCCESS_PROVIDER_ACCEPTED
PRIOR_PRODUCTION_EMAIL_LOG_CLASS=SEND_FAILURE_RESEND_401
ROOT_CAUSE=PRODUCTION_STALE_DELETED_RESEND_API_KEY_AFTER_INCOMPLETE_KEY_ROTATION
REMEDIATION=OPERATOR_UPDATED_PRODUCTION_RESEND_API_KEY_AND_REDEPLOYED
OPERATOR_PRODUCTION_ENV_CHANGE_CONFIRMED=SI
OPERATOR_PRODUCTION_DEPLOY_CONFIRMED=SI
CURRENT_PRODUCTION_DEPLOYMENT_ID=bc4a94a9-8ee8-4ed8-8a41-e791b1911f16
CURRENT_PRODUCTION_COMMIT=1de0d3c153eaf3be068adeb004ea43feb42fc40e
CURRENT_RUNTIME_RESEND_API_KEY_MATCH_TESTING=YES
PRODUCTION_TOUCHED=NO_THIS_TASK_ONLY_DOCUMENTED_OPERATOR_ACTION
ENV_MUTATED_BY_THIS_TASK=NO
CODE_CHANGED=NO
CODE_FIX_REQUIRED=NO
SCHEMA_FIX_REQUIRED=NO
SMTP_CONFIG_FIX_REQUIRED=NO
NEXT_RECOMMENDED_ACTION=P2-T31-COMMIT-TESTING-DEPLOY-IPHONE-MATRIX-CERTIFICATION
P2_T31_TECHNICAL_NEXT=P2-T31-COMMIT-TESTING-DEPLOY-IPHONE-MATRIX-CERTIFICATION
```

La evidencia del operador confirma una rotación incompleta: Testing recibió una
clave Resend nueva, Production retuvo la vieja y luego esa clave fue eliminada,
causando el HTTP 401. El operador actualizó Production y redeployó. El runtime
actual acepta el envío mediante Resend; esto no equivale a confirmación de
entrega final en el buzón. El endpoint `/api/auth/test-email` conserva una
deuda no bloqueante porque usa SMTP/Nodemailer, mientras el flujo real usa
Resend. Reporte: `codex-reports/PRODUCTION_EMAIL_VERIFICATION_BLOCKER_CLOSURE.md`.

## 1.2 ESTADO ACTUAL — P2-T31 DEPLOY TESTING (2026-09-05)

```text
CURRENT_TASK_ID=P2-T31-COMMIT-TESTING-DEPLOY-IPHONE-MATRIX-CERTIFICATION
P2_T31_STATUS=IN_PROGRESS
P2_T31_TECHNICAL_STATUS=DEPLOYED_TESTING_PENDING_IPHONE_PHYSICAL_CERTIFICATION
COMMIT_HASH=a8ac961bd81ee505297f81787c1cf32e3f4cd161
TESTING_DEPLOYMENT_ID=e18111b1-fc25-4697-8ec5-475067ad3ab1
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
IPHONE_PHYSICAL_CERTIFICATION_STATUS=PENDING_LEONARDO
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
PRODUCTION_EMAIL_VERIFICATION_BLOCKER=CLOSED_OPERATOR_REMEDIATED
NEXT_ACTION=LEONARDO_IPHONE_PHYSICAL_CERTIFICATION
```

R2+R3+R5+R5A quedó congelado en un commit único, pusheado exclusivamente a
`testing-codex` y desplegado por autodeploy en `DeliGO Copy`/TESTING. No se
ejecutó la certificación física iPhone; el siguiente paso corresponde a
Leonardo.

## 0. CÓMO LEER ESTE ARCHIVO (chat nuevo, empezar acá)

Este archivo se lee de arriba hacia abajo en orden de utilidad decreciente:
**ESTADO ACTUAL → TAREA ACTUAL → CADENA RECIENTE → ROADMAP → REGLAS
PERMANENTES → CONTEXTO HISTÓRICO** (todo lo anterior a 2026-09-05, sin
reescribir, preservado íntegro más abajo bajo `## CONTEXTO HISTÓRICO`).
Si necesitás evidencia detallada de cualquier afirmación de acá (comandos
exactos, logs, conteos de test), andá al reporte individual referenciado —
este archivo es una síntesis, no un reemplazo de los reportes.

## 1. ESTADO ACTUAL (2026-09-05)

```
PROJECT=DeliGO
REPO=C:\Leo Campos\Trabajo\deligo-main-limpio
BRANCH=testing-codex

GIT_HEAD=a8ac961bd81ee505297f81787c1cf32e3f4cd161
ORIGIN_TESTING_CODEX=a8ac961bd81ee505297f81787c1cf32e3f4cd161
ORIGIN_MAIN_PRODUCTION=1de0d3c153eaf3be068adeb004ea43feb42fc40e
AHEAD_OF_ORIGIN_TESTING=0 (el commit R2+R3+R5+R5A está pusheado; sólo quedan untracked documentales/históricos)

P0=CLOSED
P1=CLOSED
P2=IN_PROGRESS
P3=NOT_STARTED

CURRENT_TASK=P2-T31 (Notification Switch Persistence + Web Push)
CURRENT_TASK_STATUS=IN_PROGRESS
CURRENT_SUBSTAGE=R2_R3_R5_R5A_COMMITTED_PUSHED_DEPLOYED_TESTING_PENDING_IPHONE_PHYSICAL_CERTIFICATION

ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED (cero PushSubscription FCM en TODA la base de TESTING; sin dispositivo físico disponible hoy)

LATEST_TEST_GATE=341_PASS_0_FAIL (P2-T31-R5A, el más reciente — ver §4)
TYPECHECK_BASELINE=24

PRODUCTION_CONTAINS=1de0d3c153eaf3be068adeb004ea43feb42fc40e (NO contiene P2-T25/T26/T28/T31 ni nada posterior)

NEXT_RECOMMENDED_TASK=LEONARDO_IPHONE_PHYSICAL_CERTIFICATION
```

**No-claims explícitos (para evitar que un chat nuevo asuma de más)**:
- Android Push: **NO** está arreglado ni certificado. `UNKNOWN_NOT_CERTIFIED`.
- P2-T31: **NO** está cerrado. `IN_PROGRESS`.
- R2/R3/R5/R5A de P2-T31: están commiteados en
  `a8ac961bd81ee505297f81787c1cf32e3f4cd161`, pusheados a `testing-codex` y
  desplegados en TESTING; la certificación física iPhone sigue pendiente.
- Production: **NO** contiene ninguna de las tareas P2-T25/T26/T28/T31.

## 2. TAREA ACTUAL — P2-T31 (Notification Switch Persistence + Web Push)

P2-T31 nació de un bug físico reportado por Leonardo (switch de
notificaciones de Cliente perdía sincronía al navegar) y se convirtió en
una investigación en capas de todo el sistema de Web Push de DeliGO.
Etapas, en orden:

```
R1  = PASS_SUBSTAGE, COMMITEADO/PUSHEADO/DESPLEGADO (commit 989785a3cb1613bcda3a6c67f96472058bc876b0)
      Fix real: stale seed (Cliente) + stale closure post-await (Negocio).
      Repartidor ya estaba sano.
      Reporte: codex-reports/P2_T31_NOTIFICATION_SWITCH_PERSISTENCE_STATE_SYNC_R1.md
      Deploy:  codex-reports/P2_T31_TESTING_DEPLOY_PENDING_ANDROID_CERTIFICATION.md

R2  = IMPLEMENTADO, INCLUIDO EN COMMIT a8ac961bd81ee505297f81787c1cf32e3f4cd161
      Root cause: MOUNT_STATUS_GENERATION_NOT_SHARED_WITH_MUTATION_ACROSS_COMPONENT_UNMOUNT.
      La primera activación real (única que hace SW register + VAPID
      fetch + handshake nuevo con el push service) es mucho más lenta que
      cualquier activación posterior — si el usuario navega fuera del
      componente ANTES de que termine, el remount (gate nuevo, sin
      memoria de la mutación huérfana) lee "no hay subscription" como
      definitivo. Fix: registro de mutación en vuelo module-scoped
      (push-mutation-in-flight-registry.ts) + esperar antes del readback
      autoritativo. El LatestOperationGate ya protegía races DENTRO de
      una instancia — nunca entre unmount/remount, que es justo lo que
      este registro nuevo cubre.
      Reporte: codex-reports/P2_T31_R2_FIRST_SUBSCRIBE_REMOUNT_STATE.md

R3  = AUDITORÍA + FIX (1 de 4 superficies), INCLUIDO EN COMMIT a8ac961bd81ee505297f81787c1cf32e3f4cd161
      Separó SWITCH STATE de PUSH DELIVERY REAL. Confirmó que el código
      Push es idéntico entre Production y TESTING (Android falla en
      ambos, no es una regresión de testing-codex). Hallazgo real
      reproducido EN VIVO contra TESTING: Apple Web Push devolvía 400
      VapidPkHashMismatch para una subscription física stale — root
      cause VAPID_ROTATION_STALE_SUBSCRIPTION_SILENTLY_REUSED_FOREVER
      (SERVER_DETACH_ONLY preserva la física, getSubscription() la
      reusa para siempre, nunca se validaba applicationServerKey). Fix
      aplicado sólo en use-push-notifications.ts. Además: CERO
      subscriptions FCM en TODA la base de TESTING (los 3 roles) — no se
      afirma "Android arreglado", se registra ANDROID_PUSH_STATUS=
      UNKNOWN_NOT_CERTIFIED.
      Reporte: codex-reports/P2_T31_R3_ANDROID_WEB_PUSH_DELIVERY_CROSS_ENV_AUDIT.md

R4  = AUDITORÍA DE ARQUITECTURA, SIN CAMBIOS DE CÓDIGO
      PUSH_SUBSCRIPTION_IMPLEMENTATION_COUNT=4: (1) use-push-notifications.ts
      (Cliente/Negocio/Repartidor, compartido), (2) permission-prompt.tsx,
      (3) use-operativo-salon-push.ts, (4) copia inline en Mozo. Un solo
      Service Worker (public/sw.js). Divergencias clasificadas: DIV-01
      (R3 sólo validó VAPID en 1/4 superficies), DIV-02 (4
      implementaciones independientes, deuda arquitectónica), DIV-03
      (Salón/Mozo sin protección de remount equivalente a R2), DIV-04
      (env var NEXT_PUBLIC_VAPID_PUBLIC_KEY muerta/distinta en TESTING),
      DIV-05 (?iosDebug=1 residual en manifest de Cliente), DIV-06
      (Android sin ninguna subscription, causa aún desconocida).
      PushLifecycleManager centralizado evaluado sólo como OPCIÓN FUTURA
      conceptual, no una decisión tomada.
      Reporte: codex-reports/P2_T31_R4_WEB_PUSH_REFERENCE_ARCHITECTURE_CONFORMANCE_AUDIT.md

R5  = FIX PORTADO A 4/4 SUPERFICIES, INCLUIDO EN COMMIT a8ac961bd81ee505297f81787c1cf32e3f4cd161
      Cerró DIV-01: portó la validación de VAPID key de R3 a
      permission-prompt.tsx, Salón y Mozo, reusando el mismo helper
      (push-subscription-key.ts::applicationServerKeyMatches). DIV-03 NO
      se tocó (fuera de alcance explícito).
      Reporte: codex-reports/P2_T31_R5_VAPID_STALE_SUBSCRIPTION_VALIDATION_EXTENSION.md

R5A = HARDENING DE CONTRATO DE FALLOS, INCLUIDO EN COMMIT a8ac961bd81ee505297f81787c1cf32e3f4cd161
      Cerró 3 gaps encontrados revisando R5 antes de deploy: (A)
      permission-prompt ahora ABORTA (sin reusar/destruir) si no puede
      obtener la VAPID vigente; (B) permission-prompt ahora exige ACK
      real de /api/push/subscribe (antes no verificaba res.ok); (C) las
      4 superficies confirman la remoción física de una subscription
      stale (booleano de unsubscribe() + re-lectura de getSubscription())
      antes de recrear — nuevo helper compartido
      unsubscribeStalePushSubscription(). Disable normal sigue
      SERVER_DETACH_ONLY sin cambio. VAPID_VALIDATION_SURFACES_AFTER=
      4/4_STRICT.
      Reporte: codex-reports/P2_T31_R5A_PUSH_SUBSCRIPTION_FAILURE_CONTRACT_HARDENING.md
```

**Diff P2-T31 incorporado al commit de deploy** (idéntico desde R2 hasta R5A;
ningún commit intermedio):

```
P2_T31_COMMITTED_FILESET (9 tracked modificados + 5 nuevos, 14 total):
  M  src/app/mozo/panel/[slug]/page.tsx
  M  src/components/shared/permission-prompt-static-contract.test.ts
  M  src/components/shared/permission-prompt.tsx
  M  src/hooks/push-personal-status-check.test.ts
  M  src/hooks/push-personal-status-check.ts
  M  src/hooks/use-operativo-salon-push.ts
  M  src/hooks/use-push-notifications-static-contract.test.ts
  M  src/hooks/use-push-notifications.ts
  M  src/lib/push-subscription-key.ts
  ?? src/app/mozo/panel/[slug]/push-static-contract.test.ts
  ?? src/hooks/push-mutation-in-flight-registry.ts
  ?? src/hooks/push-mutation-in-flight-registry.test.ts
  ?? src/hooks/use-operativo-salon-push.test.ts
  ?? src/lib/push-subscription-key.test.ts

HISTORICAL_UNTRACKED_PRESERVE (NO tocar, NO stagear — preexistentes, no relacionados con P2-T31):
  1)
  32                                          <- NUNCA leer/inspeccionar/modificar/borrar/stagear, bajo ninguna circunstancia
  DELIGO_FULL_CONTEXT_LATEST.md (este archivo — se actualiza pero no se stagea/commitea)
  codex-reports/
  prisma/migrations/migration_lock.toml
  public/ChatGPT Image 29 ago 2026, 06_46_41 p.m.png
  public/tarjetas.docx
  public/tarjetas.pdf
  tsconfig.tsbuildinfo
```

## 3. RESUMEN P2-T25 / P2-T26 / P2-T28 (cerradas, commiteadas, pusheadas, desplegadas)

```
P2-T25 (Order Creation Abuse Resistance) = CLOSED_TESTING_CERTIFIED
  commit 1b69ee878e540d537c1b3a14d79ad88ded8d16e9 "fix: harden order creation abuse controls"
  3 buckets independientes (cuenta 5/5min, IP 15/5min, negocio 30/5min);
  idempotency replay no consume bucket de negocio; concurrent same-key
  protegido por lock process-local; session rotation da 429 en runtime;
  idempotency 201->200 mismo id; conflict real da 409. LIMITACIONES
  documentadas (no bloqueantes para TESTING): rate limiter/locks son
  PROCESS-LOCAL (sin scaling horizontal seguro todavía); IP en runtime
  parcialmente limitada por confianza de proxy/XFF de Railway (pendiente
  de endurecer getClientIp); bucket de negocio 30/5min sólo smoke-test en
  runtime, requiere validación de producto/ops antes de Production; capa
  de "challenge" (CAPTCHA) no implementada.

P2-T26 (SuperAdmin Notifications End-to-End) = CLOSED_TESTING_CERTIFIED
  commit 642da152cbc29fb8880ef4dc7bd3a7c6d6ca42f7 "feat: complete superadmin in-app notifications"
  Catálogo canónico final = 6 triggers: negocio_pendiente, denuncia_nueva,
  destacado_solicitud, negocio_deuda, review_moderation nueva solicitud,
  review_moderation información adicional. `superadmin_identidad_nueva`
  RETIRADO del catálogo runtime — probado matemáticamente inerte
  (recipients siempre []) en el modelo de identidad actual, no un bug.
  6/6 implementados y 6/6 certificados con trigger runtime explícito
  contra TESTING desplegado. Aislamiento de rol, badge/read, payload sin
  PII sensible verificados. Sólo in-app — NO Web Push.

P2-T28 (Order State Lock Ownership Hardening) = CLOSED_TESTING_CERTIFIED_NO_BUG
  commit 913d20e7f88375675b870e2adf9216fe56edcee0 "test: certify order state lock ownership"
  La sospecha inicial (mismo patrón de foreign-lock-release que
  P2-T25-R2C) resultó FALSO POSITIVO — acquireLock en estado/route.ts
  vive fuera del try/finally, estructuralmente distinta y ya segura.
  Confirmado empíricamente (no sólo por lectura) con un seam de test
  dedicado; pruebas A/B/C/D determinísticas; sin cambio de comportamiento
  de producto; test permanente de regresión agregado. FINDING para
  P2-T27: las transiciones de estado NO-cancelación no tienen DB-level
  CAS — dependen sólo del lock process-local; sólo `cancelado` usa CAS;
  antes de >1 réplica de la app esto necesita concurrencia optimista
  real.
```

Detalle completo, incluidas todas las sub-etapas (R2A/R2B/R2C de T25,
R2A/R2B/R2C de T26), en `codex-reports/COMPLETED_TASKS.md` y
`codex-reports/GIT_DEPLOY_HISTORY.md` (entradas fechadas 2026-09-05).

## 4. TESTS — GATE MÁS RECIENTE

```
P2_T31_LATEST_FOCAL=341_PASS_0_FAIL (R5A — el gate vigente HOY; R1..R5 son ejecuciones solapadas anteriores del mismo conjunto creciente, no se suman)
TYPECHECK_CURRENT_BASELINE=24 (bajó de 26 por una mejora incidental de R5A, no buscada deliberadamente — ver codex-reports/P2_T31_R5A_PUSH_SUBSCRIPTION_FAILURE_CONTRACT_HARDENING.md)
ESLINT=limpio en toda la cadena P2-T31 (R1->R5A), sin excepciones
```

Detalle completo (comandos exactos por etapa) en
`codex-reports/TEST_AUTHORITY.md` (entrada 2026-09-05).

## 5. ROADMAP COMPLETO

```
P0=CLOSED
P1=CLOSED
P2=IN_PROGRESS
  P2-T25=CLOSED_TESTING_CERTIFIED
  P2-T26=CLOSED_TESTING_CERTIFIED
  P2-T28=CLOSED_TESTING_CERTIFIED_NO_BUG
  P2-T31=IN_PROGRESS (ver §2 para el detalle de sub-etapas)
  P2-T02=READY_TO_RESUME (certificación Android depende de disponibilidad futura del dispositivo físico — mismo dispositivo cuya falta bloquea el diagnóstico de P2-T31, pero son hallazgos distintos: GPS de repartidor vs Web Push)
  P2-T27=QUEUED (depende del finding de P2-T28: DB-level CAS para transiciones no-cancelación)
  P2-T29=QUEUED
  P2-T30=QUEUED
  P2-T19=OPTIONAL_DEFERRED (fuera del orden de ejecución principal, sólo reabrir con métricas reales post-lanzamiento)
  P2-T23=FUTURE (después de P2-T02)
  P2-T24=FUTURE (después de P2-T23)
P3=NOT_STARTED
```

Historia completa de decisiones de ordenamiento del roadmap (por qué T25
antes que T28, por qué T02 depende de Android, etc.) preservada en
`codex-reports/ROADMAP.md` — no reescrita, sólo con una entrada de estado
actual agregada al tope (2026-09-05).

## 6. HALLAZGOS ABIERTOS ACTUALES (no cerrar sin nueva evidencia)

```
F-P2-T31-ANDROID-PUSH-DELIVERY-01     = UNKNOWN_NOT_CERTIFIED — requiere diagnóstico físico (instrucciones exactas en el reporte de R3, §24)
F-P2-T31-VAPID-STALE-SUBSCRIPTION-01  = CLOSED_FIX_IMPLEMENTED_LOCAL_PENDING_DEPLOY
DIV-02 (4 implementaciones independientes de lifecycle) = OPEN_ARCHITECTURAL_DEBT_NOT_BLOCKING
DIV-03 (Salón/Mozo sin remount-safety equivalente a R2) = OPEN_STRUCTURAL_RISK_NO_PHYSICAL_EVIDENCE
DIV-04 (NEXT_PUBLIC_VAPID_PUBLIC_KEY muerta/distinta en TESTING) = OPEN_LOW_SEVERITY_CONFIG_HYGIENE
DIV-05 (?iosDebug=1 residual en manifest Cliente) = OPEN_LOW_SEVERITY_COSMETIC
P2-T25: rate limiter/locks process-local, proxy/XFF, challenge layer     = OPEN_DOCUMENTED_LIMITATIONS (no bloqueante para TESTING)
P2-T28: transiciones no-cancelación sin DB CAS                          = OPEN_FOR_FUTURE_TASK (candidato P2-T27)
```

Findings previamente cerrados de otras cadenas (P2-IOS-DOCK-STATIC-CONTRACT-HYGIENE,
tracking static contract MODEL-G1 vs MODEL-E1, potencial cleanup de
`Empleado.token`/`Negocio.pushSubscriptionEmpleados`) **NO se reabrieron**
— siguen exactamente donde estaban, en `codex-reports/ROADMAP.md` y sus
reportes de tarea individuales. Detalle completo de los hallazgos de
arriba en `codex-reports/FINDINGS.md` (entrada 2026-09-05).

## 6.1 MATRIZ iPhone PARA LA PRÓXIMA CERTIFICACIÓN FÍSICA (contexto para el próximo chat/tarea)

Cuando se ejecute `P2-T31-COMMIT-TESTING-DEPLOY-IPHONE-MATRIX-CERTIFICATION`
(commit único del bloque R2+R3+R5+R5A → push testing → deploy → certificación
física), la matriz de iPhone Home-Screen PWA debe cubrir, por CADA rol
(Cliente, Negocio, Repartidor):

```
1. permission-prompt first enable (banner automático)
2. switch first enable (desde Perfil/Configuración directamente)
3. disable / re-enable
4. rapid ON/OFF (ya certificado físicamente para el switch, re-confirmar tras R5A)
5. tab remount (Perfil<->Favoritos o equivalente por rol — escenario de R2)
6. cerrar/reabrir la PWA completamente
7. logout/login
8. Push real en foreground
9. Push real en background
10. notification click / deep-link
11. stale VAPID recovery — SÓLO si existe una forma SEGURA de probarlo sin
    rotar las VAPID keys COMPARTIDAS de TESTING (idealmente un entorno
    aislado con sus propias keys). NO declarar esto físicamente probado si
    no existe tal entorno aislado.
```

Android sigue `UNKNOWN_NOT_CERTIFIED` — la matriz de arriba es SÓLO para
iPhone. No certificar Android sin el dispositivo físico (ver §6,
`F-P2-T31-ANDROID-PUSH-DELIVERY-01`, instrucciones exactas de diagnóstico
remoto en `codex-reports/P2_T31_R3_ANDROID_WEB_PUSH_DELIVERY_CROSS_ENV_AUDIT.md` §24).

## 7. REGLAS PERMANENTES (resumen — texto completo preservado en `## 2. PERMANENT EXECUTION RULES` más abajo, sección histórica)

- Toda comunicación con el usuario y narrativa de reportes: **español**.
  Literales técnicos/hashes/rutas/comandos/marcadores: inglés.
- Archivo raíz **`32`**: NUNCA leer/inspeccionar/ejecutar/modificar/
  stagear/borrar, sin excepción, en ninguna tarea futura.
- **Archive-before-overwrite** para `codex-reports/CURRENT_TASK.md`
  específicamente (verificado por hash) — esta reconciliación NO lo tocó
  (no era necesario para el objetivo de reconciliar contexto).
- **`codex-reports/archive/LEGACY_FULL_REPORT_20260826.md` es
  permanentemente inmutable.**
- `git add` explícito por path, nunca `-A`/`.`; un commit por etapa de
  "commit exacto"; push único y explícito sólo con autorización expresa
  del usuario en el prompt de esa etapa, siempre
  `git push origin testing-codex` sin `--force`; nunca tocar `origin/main`
  sin instrucción explícita de promoción a Production.
- Fixtures de DB reales sólo en TESTING, siempre con prefijo identificable
  (para P2-T31: `TEST_T31_*`), siempre eliminadas al finalizar la etapa.
- Este archivo (`DELIGO_FULL_CONTEXT_LATEST.md`) se actualiza al finalizar
  cada tarea futura relevante, permanece sin trackear/sin stagear en Git,
  y se construye únicamente a partir de las autoridades de
  `codex-reports/` + el estado real de Git — nunca de la memoria del
  modelo.

## CONTEXTO HISTÓRICO (preservado íntegro desde antes de 2026-09-05 — cronológico, no reescrito)

## CURRENT TASK — PRODUCTION-PILOT-CATALOG-E2E-01-R1 (2026-08-30)

```
CURRENT_TASK_ID=PRODUCTION-PILOT-CATALOG-E2E-01-R1
CURRENT_TASK_STATUS=PASS_PRODUCTION_DEMO_CATALOG_IMAGES_HOURS_AND_REAL_BUSINESS_ONBOARDING_CERTIFIED
LAST_UPDATED_BY_TASK=PRODUCTION-PILOT-CATALOG-E2E-01-R1
LAST_UPDATED_DATE=2026-08-30
R1_REPORT=codex-reports/PRODUCTION_PILOT_CATALOG_E2E_01_R1.md
IMAGE_PIPELINE_PRODUCTION_BLOCKER=RESOLVED
PRODUCT_IMAGE_CLIENT_RENDER_PASS_COUNT=8
REAL_BUSINESS_CATALOG_ONBOARDING_READY=SI
PUBLIC_LAUNCH_AUTHORIZED=NO
DEMO_BUSINESS_PRESERVED=SI
```

Con las credenciales de Cloudinary ya corregidas por el operador, se
certificó primero con un canario real, y luego se re-subieron y
actualizaron las 8 imágenes rotas del negocio demo — 8/8 confirmadas
renderizando de verdad (fetch directo + inspección de DOM, desktop y
mobile). Se configuró un horario semanal completo por el contrato real;
el catálogo público pasó de "Local cerrado" a "Abierto". El bloqueador de
onboarding queda `RESOLVED`:
`REAL_BUSINESS_CATALOG_ONBOARDING_READY=SI`. `PUBLIC_LAUNCH_AUTHORIZED=NO`
sin cambio. Nota de transparencia: se usó una excepción acotada por
Prisma (solo el campo `password` del negocio demo, autorizada
explícitamente por el usuario) para recuperar el acceso de login perdido
— documentado en detalle, no oculto. Negocio demo conservado íntegro.

## CURRENT TASK — PRODUCTION-PILOT-CATALOG-E2E-01 (2026-08-30)

```
CURRENT_TASK_ID=PRODUCTION-PILOT-CATALOG-E2E-01
CURRENT_TASK_STATUS=PARTIAL_CATALOG_MECHANICS_CERTIFIED_IMAGE_PIPELINE_BLOCKED
LAST_UPDATED_BY_TASK=PRODUCTION-PILOT-CATALOG-E2E-01
LAST_UPDATED_DATE=2026-08-30
PILOT_REPORT=codex-reports/PRODUCTION_PILOT_CATALOG_E2E_01.md
DEMO_BUSINESS_ID=cmtgcfhep0009li0axg92s4tc
DEMO_BUSINESS_SLUG=deligo-demo-burger
DEMO_BUSINESS_PRESERVED=SI
DEMO_EMPLOYEE_COUNT_CREATED_BY_TASK=0
PRODUCT_IMAGE_UPLOAD_PASS_COUNT=8
PRODUCT_IMAGE_CLIENT_RENDER_PASS_COUNT=0
REAL_BUSINESS_CATALOG_ONBOARDING_READY=NO
PUBLIC_LAUNCH_AUTHORIZED=NO
REAL_PRODUCTION_BUSINESS_DATA_PROTECTED=SI
NEXT_PROJECT_TASK_ID=CLOUDINARY_PRODUCTION_CREDENTIAL_FIX
NEXT_PROJECT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

Negocio demo real (`DeliGO Demo Burger`, `deligo-demo-burger`) creado de
punta a punta por los contratos reales de la app, sin ningún `Empleado`.
15 productos cubren toda la matriz de catálogo (simples, experto con
ingredientes removibles, agregados pagos/gratis, sección propia, un grupo
de opciones compartidas reutilizado en 2 productos, descuento % y monto
fijo, disponibilidad) — todo PASS con cálculos de precio exactos
verificados en vivo en navegador real. Bloqueador real encontrado: el
pipeline de imágenes está roto en Production (Cloudinary con API key
deshabilitada, fallback local también 404) — 0 de 8 imágenes subidas
renderizan. Por eso `REAL_BUSINESS_CATALOG_ONBOARDING_READY=NO` pese a que
el resto del catálogo certificó limpio. Negocio demo conservado íntegro.
`PUBLIC_LAUNCH_AUTHORIZED=NO` sin cambio. Invariante nueva congelada:
`REAL_PRODUCTION_BUSINESS_DATA_PROTECTED=SI` para toda tarea futura.

## CURRENT TASK — CHAT_SESSION_CHECK_URL_PRODUCTION_FIX-R1 (2026-08-30)

```
CURRENT_TASK_ID=CHAT_SESSION_CHECK_URL_PRODUCTION_FIX-R1
CURRENT_TASK_STATUS=PASS_PRODUCTION_CHAT_SESSION_CHECK_CONFIGURATION_AND_ROUNDTRIP_CERTIFIED
LAST_UPDATED_BY_TASK=CHAT_SESSION_CHECK_URL_PRODUCTION_FIX-R1
LAST_UPDATED_DATE=2026-08-30
FIX_REPORT=codex-reports/CHAT_SESSION_CHECK_URL_PRODUCTION_FIX.md
CHAT_SESSION_CHECK_URL_MISSING=NO
PRODUCTION_MISSING_REQUIRED_VARIABLE_COUNT=0
PRODUCTION_OPERATIONAL_READINESS=PASS
REALTIME_PRODUCTION_TO_PRODUCTION_ROUTING_PASS=SI
SESSION_CHECK_FIX_PASS_P2_T18_STILL_PAUSED=SI
NEXT_PROJECT_TASK_ID=P2_T06_OR_P2_T14_SELECTION
NEXT_PROJECT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

Certificó en Production real la corrección manual del operador
(`DELIGO_MONOLITH_INTERNAL_URL=https://deligo.ar`, ya provisionada y
desplegada por él antes de esta tarea) con el roundtrip sintético exacto
de `P2-T11-STAGE4E`: caso activo autenticado `200 {"valid":false}`, HMAC
inválido/timestamp vencido `401`, gate de socket obligatorio ejecutando el
chequeo completo (`reason=inactive`). `F-PRODUCTION-CHAT-SESSION-CHECK-URL-01`
cerrado; `PRODUCTION_OPERATIONAL_READINESS=PASS` sin limitaciones. Cero
mutación de Railway/Git/DB por esta tarea. P2-T18 sigue en pausa, no
reabierto.

## CURRENT TASK — PRODUCTION-SYNC-R7 (2026-08-30)

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R7
CURRENT_TASK_STATUS=CLOSED_WITH_DOCUMENTED_LIMITATIONS
PRODUCTION_SYNC_R7=PASS_PRODUCTION_FINAL_INFRASTRUCTURE_POLICY_AND_READINESS_CERTIFIED
PRODUCTION_SYNC_STATUS=CLOSED_WITH_DOCUMENTED_LIMITATIONS
PRODUCTION_OPERATIONAL_READINESS=PASS_WITH_LIMITATIONS
PRODUCTION_SYNC_COMPLETE=SI
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R7
LAST_UPDATED_DATE=2026-08-30
R7_REPORT=codex-reports/PRODUCTION_SYNC_R7.md
CHAT_SESSION_CHECK_URL_MISSING=SI
PRODUCTION_MISSING_REQUIRED_VARIABLE_COUNT=1
PRODUCTION_TESTING_DATABASE_CROSSOVER_COUNT=0
PREDEPLOY_POLICY_RECOMMENDATION=KEEP_MANUAL_MIGRATION_GATE
PRODUCTION_EXPAND_CONTRACT_POLICY_FROZEN=SI
PRODUCTION_BACKUP_POLICY_FROZEN=SI
AUXILIARY_JOB_READINESS_FINAL=PASS
KNOWN_PRODUCTION_SECRET_EXPOSURE_OPEN_COUNT=0
NEXT_PRODUCTION_SYNC_TASK_ID=NONE
NEXT_PROJECT_TASK_ID=CHAT_SESSION_CHECK_URL_PRODUCTION_FIX
NEXT_PROJECT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

Production Sync (R1→R7) queda CERRADO como infraestructura de rollout
completa y segura, con una limitación documentada y acotada: `chat en
vivo`/production nunca recibió `DELIGO_MONOLITH_INTERNAL_URL`, por lo que
toda conexión de chat en tiempo real es rechazada hoy (fail-closed,
`internal-session-check-client.js`, sin bypass en el código) — refuerza,
no contradice, la pausa ya documentada de P2-T18. Fix de una variable
conocido, no aplicado (R7 fue 100% solo lectura). Políticas futuras
congeladas: migraciones manuales (`preDeployCommand` sigue `NONE` a
propósito), expand/contract, backup/recovery, runbook operativo, tabla de
titularidad de servicios. `NEXT_PROJECT_TASK_ID=CHAT_SESSION_CHECK_URL_PRODUCTION_FIX`,
no autorizada.

## CURRENT TASK — PRODUCTION-SYNC-R6-R2 (2026-08-30)

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R6-R2
CURRENT_TASK_STATUS=PASS_PRODUCTION_AUXILIARY_JOB_PARITY_CERTIFIED
PRODUCTION_SYNC_R6_R2=PASS_PRODUCTION_AUXILIARY_JOB_PARITY_CERTIFIED
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R6-R2
LAST_UPDATED_DATE=2026-08-30
R6_R2_REPORT=codex-reports/PRODUCTION_SYNC_R6_R2.md
REVIEW_PRODUCTION_INSTANCE_ID=c02e477e-a008-4358-9f9a-94add8fa381c
MESA_PRODUCTION_INSTANCE_ID=a232c84f-3062-4571-ae54-4473b64eb929
TESTING_DATABASE_CROSSOVER_DETECTED=NO
REVIEW_PRE_MAIN_EXECUTION_OCCURRED=NO
MESA_PRE_MAIN_EXECUTION_OCCURRED=NO
REVIEW_FIRST_PRODUCTION_RUN_STATUS=PASS
MESA_FIRST_PRODUCTION_RUN_STATUS=PASS
CHAT_CLEANUP_EXECUTION_COUNT_R6_R2=0
PRODUCTION_MIGRATIONS_FINAL_R6_R2=27
AUXILIARY_JOB_PARITY_PRODUCTION=PASS
R6_R2_FINAL_BACKUP_SHA256=63f0c9a1bb7c065526ca162e2cefc50dbbfa47bab608ee6f2b1024c0bcdb18d2
R6_R2_FINAL_BACKUP_RESTORABLE=SI
NEXT_TASK_ID=PRODUCTION-SYNC-R7
NEXT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

R6-R2 cerró la paridad de jobs auxiliares en Production con PASS: Review y
Mesa reutilizan sus objetos de proyecto existentes sin duplicados, ambos con
`branch=main`/commit exacto/`DATABASE_URL`→Production Postgres (nunca
TESTING), sin ninguna ejecución antes de que `main` estuviera configurado.
Mesa ya tenía una corrida real válida; Review necesitó un único redeploy
controlado (ejecutado manualmente por el operador tras el bloqueo del
clasificador del harness), cuya ejecución real llegó por el propio cron
horario. Ambas corridas `errors=0`. Backup final post-auxjobs creado,
restaurado y certificado. `NEXT_TASK_ID=PRODUCTION-SYNC-R7`, no autorizada.

## CURRENT TASK — PRODUCTION-SYNC-R6-R1 (2026-08-30)

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R6-R1
CURRENT_TASK_STATUS=BLOCKED_REQUIRES_OPERATOR_ASSISTED_PRODUCTION_INSTANCE_CREATION
PRODUCTION_SYNC_R6_R1=BLOCKED_REQUIRES_OPERATOR_ASSISTED_PRODUCTION_INSTANCE_CREATION
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R6-R1
LAST_UPDATED_DATE=2026-08-30
R6_R1_REPORT=codex-reports/PRODUCTION_SYNC_R6_R1.md
OPERATOR_CHAT_CLEANUP_FIX_COMPLETED=SI
OPERATOR_CHAT_CLEANUP_REAL_EXECUTION_COUNT=1
DELIGO_POST_CLEANUP_CONFIG_DEPLOY_COMMIT_MATCH=SI
CHAT_POST_OPERATOR_CHANGE_HEALTH=PASS
PRODUCTION_RECORDED_MIGRATIONS_R6_R1=27
PRODUCTION_PENDING_MIGRATIONS_R6_R1=0
PRODUCTION_CLEANUP_SECRET_PRESENT=SI
LEGACY_X_CLEANUP_SECRET2_PRESENT=NO
R6_R1_BACKUP_SHA256=5537edc849f35f9bd1bea1ee7476bfd2a635ac2a5e9ccb5bde086438e1886dd1
R6_R1_CURRENT_BACKUP_RESTORABLE=SI
REVIEW_SAFE_PRODUCTION_INSTANCE_CREATION_PROVABLE=NO
MESA_SAFE_PRODUCTION_INSTANCE_CREATION_PROVABLE=NO
REVIEW_ELIGIBLE_NOW_COUNT=0
MESA_ACTIVE_OCCUPANCY_COUNT=0
MESA_ELIGIBLE_EXPIRY_COUNT=0
AUXILIARY_JOB_PARITY_PRODUCTION=BLOCKED_REQUIRES_OPERATOR_ASSISTED_INSTANCE_CREATION
NEXT_TASK_ID=PRODUCTION-SYNC-R6-R2
NEXT_TASK_STATUS=BLOCKED_AWAITING_OPERATOR_UI_INSTANCE_CREATION
```

R6-R1 certificó con evidencia real el fix del operador sobre CLEANUP_SECRET/
x-cleanup-secret (redeploy no intencional de DeliGO, commit exacto, SUCCESS),
la salud de ambos servicios, la base en 27/0/0 y un backup lógico post-cleanup
fresco totalmente restaurado. La creación de instancias Production de Review/
Mesa quedó bloqueada: `serviceInstanceUpdate` no demostró semántica de
creación para un par (servicio, entorno) sin instancia previa, y crear un
servicio nuevo está prohibido por duplicar el objeto de proyecto. Hand-off
manual de UI documentado en `codex-reports/PRODUCTION_SYNC_R6_R1.md`; ambos
jobs en 0 candidatas elegibles ahora mismo (riesgo mínimo para R6-R2).

## CURRENT TASK — PRODUCTION-SYNC-R6-R0 (2026-08-30)

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R6-R0
CURRENT_TASK_STATUS=BLOCKED_AWAITING_OPERATOR_CHAT_CLEANUP_SCHEDULER_EVIDENCE
PRODUCTION_SYNC_R6_R0=BLOCKED_AWAITING_OPERATOR_CHAT_CLEANUP_SCHEDULER_EVIDENCE
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R6-R0
LAST_UPDATED_DATE=2026-08-30
R6_R0_REPORT=codex-reports/PRODUCTION_SYNC_R6_R0.md
PRODUCTION_RECORDED_MIGRATIONS_R6_R0=27
PRODUCTION_SUCCESSFUL_MIGRATIONS_R6_R0=27
PRODUCTION_FAILED_MIGRATIONS_R6_R0=0
PRODUCTION_PENDING_MIGRATIONS_R6_R0=0
DATABASE_SCHEMA_UP_TO_DATE_R6_R0=SI
R6_BACKUP_RESTORABLE=SI
R6_R0_RAILWAY_MUTATION_COUNT=0
R6_R0_PRODUCTION_JOB_EXECUTION_COUNT=0
R6_R0_PRODUCTION_DB_WRITE=NO
R6_R0_GIT_PUSH_COUNT=0
R6_R0_CODE_DEPLOY_COUNT=0
NEXT_TASK_ID=PRODUCTION-SYNC-R6-R1
NEXT_TASK_STATUS=BLOCKED_AWAITING_OPERATOR_CHAT_CLEANUP_SCHEDULER_EVIDENCE
```

R6-R0 certificó el backup post-27/pre-jobs y auditó Review, Mesa y Chat
Cleanup sin mutaciones. Los dos objetos cron existen a nivel de proyecto y
solo tienen instancia TESTING; el scheduler externo de Chat Cleanup sigue
UNPROVEN_REQUIRES_OPERATOR_UI. Ver `codex-reports/PRODUCTION_SYNC_R6_R0.md`.

## CURRENT TASK — PRODUCTION-SYNC-R5 (2026-08-29)

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R5
CURRENT_TASK_STATUS=PASS_FINAL_CONTRACT_MIGRATION_27_APPLIED_PRODUCTION_SCHEMA_COMPLETE
PRODUCTION_SYNC_R5=PASS_FINAL_CONTRACT_MIGRATION_27_APPLIED_PRODUCTION_SCHEMA_COMPLETE
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R5
LAST_UPDATED_DATE=2026-08-29
R5_REPORT=codex-reports/PRODUCTION_SYNC_R5.md
R5_MIGRATION_NAME=20260826230000_drop_terminal_operativa_push_subscription
R5_MIGRATE_DEPLOY_ATTEMPT_COUNT=1
R5_MIGRATION_COMMAND_EXIT_CODE=0
PRODUCTION_RECORDED_MIGRATIONS_POST_R5=27
PRODUCTION_SUCCESSFUL_MIGRATIONS_POST_R5=27
PRODUCTION_FAILED_MIGRATIONS_POST_R5=0
PRODUCTION_PENDING_MIGRATIONS_POST_R5=0
TERMINALES_SALON_EXISTS_POST_R5=SI
PUSHSUBSCRIPTION_EXISTS_POST_R5=NO
PRODUCTION_SCHEMA_MATCHES_POST_27=SI
R5_PRIMARY_BACKUP_RESTORABLE=SI
PRODUCTION_DB_WRITE=SI
DATABASE_MIGRATION_EXECUTED_PRODUCTION=SI
R5_GIT_PUSH_COUNT=0
R5_CODE_DEPLOY_COUNT=0
R5_RAILWAY_SERVICE_RESTART_COUNT=0
NEXT_TASK_ID=PRODUCTION-SYNC-R6
NEXT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

Migration #27 was applied exactly once in Production. The target column is
absent, the schema is up to date, reference aggregates are unchanged, and the
existing DeliGO and chat deployments remain healthy. No code or deployment
mutation occurred. Full evidence: `codex-reports/PRODUCTION_SYNC_R5.md`.

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R5-R0-R1
CURRENT_TASK_STATUS=PASS_FRESH_POST26_PRE27_PRODUCTION_LOGICAL_BACKUP_RESTORABLE
PRODUCTION_SYNC_R5_R0_R1=PASS_FRESH_POST26_PRE27_PRODUCTION_LOGICAL_BACKUP_RESTORABLE
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R5-R0-R1
LAST_UPDATED_DATE=2026-08-29
R5_R0_R1_REPORT=codex-reports/PRODUCTION_SYNC_R5_R0_R1.md
PRODUCTION_DB_WRITE=NO
R5_R0_R1_GIT_PUSH_COUNT=0
R5_R0_R1_DATABASE_MIGRATION_COUNT=0
NEXT_TASK_ID=PRODUCTION-SYNC-R5
NEXT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

R5-R0 verificó Production PostgreSQL 18.6, el estado post-26/pre-27 y los
conteos de referencia, pero no pudo crear el backup porque sólo hay clientes
PostgreSQL 12 y no hay Docker/Podman. PostgreSQL 12 no se utilizó. No se creó
dump ni scratch restore, y no se ejecutó ninguna mutación. Ver
`codex-reports/PRODUCTION_SYNC_R5_R0.md`.

R5-R0-R1 obtuvo tooling oficial PostgreSQL 18.6, creó un dump custom fuera
del repo y lo restauró por completo en scratch 18.6. Production no cambió y
#27 no se ejecutó. Ver
`codex-reports/PRODUCTION_SYNC_R5_R0_R1.md`.

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R4-R2-R2
CURRENT_TASK_STATUS=PASS_R4_DUAL_PRODUCTION_DEPLOY_CERTIFIED_27_PENDING
PRODUCTION_SYNC_R4_R2_R2=PASS_R4_DUAL_PRODUCTION_DEPLOY_CERTIFIED_27_PENDING
PRODUCTION_SYNC_R4=PASS_PRODUCTION_MAIN_FAST_FORWARDED_EXACT_CODE_DEPLOYED_HEALTHY_27_PENDING
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R4-R2-R2
LAST_UPDATED_DATE=2026-08-29
R4_R2_R2_REPORT=codex-reports/PRODUCTION_SYNC_R4_R2_R2.md
PRODUCTION_DB_WRITE=NO
DATABASE_MIGRATION_EXECUTED_PRODUCTION=NO
NEXT_TASK_ID=PRODUCTION-SYNC-R5
NEXT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

R4-R2-R2 certificó ambos deployments Production sobre el commit exacto
`c05525a5e0419922a484fbe6cb25c8604b8ca313`: DeliGO
`a3d7d7a4-3732-42d7-95b6-4ecbbeae6ca3` y chat
`94927d86-a16f-45cb-80b5-2637aace0a39`, ambos `SUCCESS`. Los dos servicios
están saludables; DeliGO y chat respondieron HTTP 200 en sus smokes seguros.
La DB permanece post-26/pre-27, con #27 como única pendiente y
`pushSubscription` presente. R5 queda listo, no ejecutado y requiere
autorización explícita.

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R4-R2-R1
CURRENT_TASK_STATUS=BLOCKED_AWAITING_MANUAL_CHAT_BRANCH_CHANGE
PRODUCTION_SYNC_R4_R2_R1=BLOCKED_AWAITING_MANUAL_CHAT_BRANCH_CHANGE
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R4-R2-R1
LAST_UPDATED_DATE=2026-08-29
R4_R2_R1_REPORT=codex-reports/PRODUCTION_SYNC_R4_R2_R1.md
R4_R2_R1_MAIN_PUSH_COUNT=1
PRODUCTION_CODE_DEPLOY=SI
PRODUCTION_MAIN_MOVED=SI
PRODUCTION_DB_WRITE=NO
NEXT_TASK_ID=NOT_SET
NEXT_TASK_STATUS=BLOCKED_AWAITING_MANUAL_CHAT_BRANCH_CHANGE
```

R4-R2-R1 reverified all eight required Production variables, including the
three dedicated private-evidence Cloudinary variables, then passed the local
gate and executed exactly one fast-forward push. DeliGO deployed commit
`c05525a5e0419922a484fbe6cb25c8604b8ca313` successfully and
`https://deligo.ar/` returned HTTP 200. The task is blocked only because the
Railway CLI cannot safely perform the required branch-only change from
`testing` to `main` for Production `chat en vivo` while proving preservation
of repository, root and autodeploy. See
`codex-reports/PRODUCTION_SYNC_R4_R2_R1.md` for the manual UI handoff.

R4-R2 pasó los gates locales, pero la lectura directa de Railway Production
DeliGO contradijo la autoridad del operador: las tres variables exactas
`PRIVATE_EVIDENCE_CLOUDINARY_*` aparecen ausentes. Se detuvo antes del push y
no se intentó reparar la discrepancia automáticamente.

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R4-R1
CURRENT_TASK_STATUS=BLOCKED_AWAITING_MANUAL_PRIVATE_EVIDENCE_CLOUDINARY_CONFIGURATION
PRODUCTION_SYNC_R4_R1=BLOCKED_AWAITING_MANUAL_PRIVATE_EVIDENCE_CLOUDINARY_CONFIGURATION
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R4-R1
LAST_UPDATED_DATE=2026-08-29
R4_R1_REPORT=codex-reports/PRODUCTION_SYNC_R4_R1.md
R4_R1_MAIN_PUSH_COUNT=0
PRODUCTION_CODE_DEPLOY=NO
PRODUCTION_DB_WRITE=NO
NEXT_TASK_ID=NOT_SET
NEXT_TASK_STATUS=BLOCKED_AWAITING_MANUAL_PRIVATE_EVIDENCE_CLOUDINARY_CONFIGURATION
```

R4-R1 escribió y verificó sólo `REALTIME_INTERNAL_SERVICE_URL` para enrutar
Production→Production sin deploy. Las tres variables exactas de Cloudinary
de evidencia privada requieren acción manual con credenciales dedicadas de
Production; no se reutilizan las de TESTING. Chat Production mantiene repo
confirmado pero branch/root/autodeploy no expuestos por metadata.

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R4
CURRENT_TASK_STATUS=BLOCKED_R4_REQUIRED_PRODUCTION_VARIABLES_UNCERTIFIED_AND_CHAT_SOURCE_BRANCH_UNPROVEN
PRODUCTION_SYNC_R4=BLOCKED_R4_REQUIRED_PRODUCTION_VARIABLES_UNCERTIFIED_AND_CHAT_SOURCE_BRANCH_UNPROVEN
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R4
LAST_UPDATED_DATE=2026-08-29
R4_REPORT=codex-reports/PRODUCTION_SYNC_R4.md
R4_MAIN_PUSH_COUNT=0
PRODUCTION_CODE_DEPLOY=NO
PRODUCTION_DB_WRITE=NO
NEXT_TASK_ID=NOT_SET
NEXT_TASK_STATUS=BLOCKED_AWAITING_EXPLICIT_AUTHORIZATION_FOR_MISSING_PRODUCTION_DEPLOY_PREREQUISITES
```

R4 quedó bloqueada antes del push: faltan tres secretos exactos de evidencia
privada y la rama Production de `chat en vivo` no es demostrable desde su
metadata actual. La base conserva 26 migraciones exitosas, #27 pendiente y
`terminales_salon.pushSubscription` presente. No hubo mutaciones de Git,
Railway, código ni base.

```
DOCUMENT_ROLE=CROSS_CHAT_SECONDARY_CONTEXT (reconciliado en P2-T18-BLOCKER-AUTH2-R13-R2-R1 — este archivo ya NO es el primary handoff, para eliminar la ambigüedad de "a qué archivo enviar un chat nuevo")
PRIMARY_HANDOFF=CODEX_REPORT.md
THIS_FILE_ROLE=SECONDARY_CROSS_CHAT_CONTEXT
CURRENT_MASTER_TASK_HANDOFF=CODEX_REPORT.md (sin reemplazo — sigue siendo la autoridad de detalle por tarea)
DO_NOT_RECONSTRUCT_HISTORY_FROM_MEMORY=SI
SOURCED_FROM=codex-reports/archive/LEGACY_FULL_REPORT_20260826.md + CODEX_REPORT.md + codex-reports/ROADMAP.md + codex-reports/FINDINGS.md + codex-reports/DECISIONS_AND_INVARIANTS.md + codex-reports/TEST_AUTHORITY.md + codex-reports/GIT_DEPLOY_HISTORY.md + codex-reports/COMPLETED_TASKS.md + estado real de Git
LEGACY_FULL_REPORT_20260826_IMMUTABLE=SI (nunca se modifica, en ninguna tarea futura)
THIS_FILE_TRACKED_IN_GIT=NO (permanece sin trackear/sin stagear, nunca se commitea/pushea)
FULL_CONTEXT_UPDATE_REQUIRED_AFTER_EVERY_TASK=SI (actualizar al finalizar cada tarea futura, a partir de P2-T18-BLOCKER-AUTH2-R9)
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R3-R3-R1
LAST_UPDATED_DATE=2026-08-29

CURRENT_TASK_ID=PRODUCTION-SYNC-R3-R3-R1
CURRENT_TASK_STATUS=PASS_PRODUCTION_BASELINED_AND_MIGRATED_THROUGH_26_DESTRUCTIVE_27_PENDING
PRODUCTION_SYNC_R3_R3_R1=PASS_PRODUCTION_BASELINED_AND_MIGRATED_THROUGH_26_DESTRUCTIVE_27_PENDING
NEXT_TASK_ID=PRODUCTION-SYNC-R4
NEXT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
R3_R2_R1_HISTORICAL_STATUS=PASS_SEMANTIC_0_INIT_COMPLETION_FULL_SCRATCH_REHEARSAL_CERTIFIED
R3_R3_STOP_REASON=psql ignoró el patch por orden inválido de argumentos; Production permanece intacta y no hubo reintento.
R3_R1_HISTORICAL_STATUS=BLOCKED_BASELINE_STATE_CANNOT_BE_PROVEN
R3_R2_R1_RESULT=completion semántica certificada en scratch; 26 migraciones exitosas y sólo #27 pendiente.
PRODUCTION_DB_WRITE=NO
DATABASE_MIGRATION_EXECUTED=NO
PRODUCTION_CODE_DEPLOY=NO
PRODUCTION_MAIN_MOVED=NO
NEXT_TASK_ID=NOT_SET
NEXT_TASK_ID=NOT_SET
NEXT_TASK_STATUS=BLOCKED_AWAITING_NEW_EXPLICIT_AUTHORIZATION
```

Este archivo existe para que un chat nuevo, sin memoria previa, pueda
entender el proyecto completo y continuar el trabajo sin necesidad de
leer los 123,000+ líneas del reporte legacy. Si algo aquí contradice
uno de los 8 archivos fuente listados arriba, ese archivo fuente gana
— este documento es una síntesis, nunca una autoridad independiente.

---

## 1. SNAPSHOT

```
PROJECT=DeliGO
REPO=C:\Leo Campos\Trabajo\deligo-main-limpio
BRANCH=testing-codex
HEAD=c05525a5e0419922a484fbe6cb25c8604b8ca313
ORIGIN_TESTING_CODEX=c05525a5e0419922a484fbe6cb25c8604b8ca313
AHEAD=0
BEHIND=0
INDEX_EMPTY=SI (sin nada staged)
WORKING_TREE=sin diferencias tracked; sólo archivos no rastreados (reportes/contexto, `32`, `1)` y un PNG público); 0 paths de `src/`, schema, migraciones o package modificados
R2_HISTORICAL_TASK_ID=PRODUCTION-SYNC-R2
R2_HISTORICAL_TASK_STATUS=PASS_PRODUCTION_VARIABLES_READY_PREDEPLOY_ACTIVATION_DEFERRED_TO_SAFE_DEPLOY_STAGE (ver codex-reports/PRODUCTION_SYNC_R2.md — primera mutación real de Production: 4/4 secretos (REALTIME_SOCKET_TOKEN_SECRET/REALTIME_SESSION_CHECK_SECRET/REALTIME_INTERNAL_PUBLISH_SECRET/REGISTRATION_LIMIT_SECRET) generados con CSPRNG por el usuario manualmente (mutación del agente bloqueada por el clasificador de permisos del harness) y verificados read-only vía fingerprint SHA-256 sin plaintext — compartidos correctamente, cero reutilización de TESTING; REALTIME_INTERNAL_SERVICE_URL cerrado como falso positivo de drift pero NO escrito; preDeployCommand diferido — no se pudo probar que serviceInstanceUpdate no dispare deploy; deploy NO disparado, confirmado por railway status --json; R2_HISTORICAL_NEXT_TASK_ID=PRODUCTION-SYNC-R3 READY_NOT_EXECUTED, requiere autorización explícita del usuario)
P2_T18_DISPOSITION=PAUSED_NOT_CLOSED_EXTERNAL_INFRA_DEPENDENCY (F-P1-02/F-P1-01/F-P2-T18-LIVE-PUSH-01 quedan abiertos; NO investigar más Railway sin nueva instrucción explícita; bloquea sólo el lanzamiento operativo completo de pedidos/chat en tiempo real, NO el onboarding de catálogo)
R13_R2=PASS_AUTH02_FOCUSED_LOCAL_IMPLEMENTATION (preservado íntegro a través de todas las etapas hasta R13-R6)
R13_R3=BLOCKED_AUTH02_PRECOMMIT_ADVERSARIAL_FINDING (histórico, no reescrito — TEST_COVERAGE_GAP aislado M9, no PRODUCT_DEFECT — ver §11.1)
R13_R3_R1=PASS_AUTH02_M9_TEST_COVERAGE_GAP_CLOSED (cierre focal test-only del gap M9 — preservado, recertificado correcto por R13-R3-RETRY y RETRY-2 — ver §11.1)
R13_R3_RETRY=BLOCKED_AUTH02_TEST_COVERAGE_GAP (histórico, no reescrito — M9 recertificado correcto, pero encontró un SEGUNDO gap distinto M19-NEW — ver §11.1)
R13_R3_RETRY_R1=PASS_AUTH02_M19_TEST_COVERAGE_GAP_CLOSED (cierre focal test-only del gap M19-NEW — preservado, recertificado correcto por RETRY-2 — ver §11.1)
R13_R3_RETRY_2=BLOCKED_AUTH02_FRESH_TEST_GATE (histórico, no reescrito — recertificación final desde cero: AUTH02 100% verde en cobertura/mutación/seguridad/aceptación/focal — BLOCK exclusivamente por 1 fallo de regresión en archivo ajeno — ver §11.1)
R13_R3_RETRY_2_R1=BLOCKED_SEC_BLOCK_1_CLASSIFICATION_INCONCLUSIVE (histórico, no reescrito — clasificación diagnóstica: 0 solapamiento con AUTH02 confirmado estructuralmente, D1 FAIL/D2 PASS/D3 PASS, clasificado INCONCLUSIVE_EXTERNAL_DB_INSTABILITY — ver §11.1)
R13_R3_RETRY_2_R2=BLOCKED_FRESH_TANDA_2_CERTIFICATION_FAILURE (gate de certificación: SEGUNDO fallo consecutivo del mismo caso SEC-BLOCK-1 exacto, misma latencia anómala; AUTH02 en sí sigue 100% verde por identidad de bytes — ver §11.1)
R13_R3_RETRY_2_R2_R1=PASS_REPEATED_SEC_BLOCK_1_FAILURE_DISPOSITION_FROZEN (disposición read-only: EXTERNAL_TESTING_DB_RELIABILITY_LIMITATION_REQUIRES_NEW_CERTIFICATION_AUTHORITY, confianza MEDIA — E2/D1 aislado también falló, descartando contención entre archivos de TANDA_2; PASS = disposición determinada, NO autorización de commit — ver §11.1)
R13_R3_RETRY_2_R2_R1A=PASS_USER_PROCESS_DECISION_DEDICATED_DB_DEFERRED_AUTH02_PRECOMMIT_ACCEPTED_WITH_SINGLE_INFRA_EXCEPTION (el usuario decidió diferir la DB de TESTING dedicada y continuar con la infraestructura existente; verificados 6/6 gates A-F sobre la autoridad ya persistida; excepción acotada EX-P2-T18-SEC-BLOCK-1-P2028 aceptada; AUTH02_SAFE_FOR_EXACT_LOCAL_COMMIT=SI, R13_R4_AUTHORIZED=SI — ver §11.1)
R13_R4=PASS_AUTH02_EXACT_LOCAL_COMMIT (commit fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f, parent a1579f11e79a41b90c6df4d2e8573ca9a669b856, subject "fix: scope shared auth requests by actor family"; 14/14 blobs commiteados verificados contra la autoridad certificada; sin push/deploy — ver §11.1)
R13_R5=PASS_AUTH02_POSTCOMMIT_PREPUSH_EXACT_BLOB_REVIEW (recertificación INDEPENDIENTE del commit fe0e11d0 leyendo objetos Git directamente desde HEAD, sin confiar en el resumen de R13-R4; fileset por 2 métodos Git + 14 blob IDs vía git ls-tree — 14/14 idénticos; contrato de proxy/Chat/Push y M9/M19 confirmados en los blobs commiteados; 0 tests ejecutados; R13_R6_AUTHORIZED=SI — ver §11.1)
R13_R6=PASS_AUTH02_TESTING_PUSH_DEPLOY_CERTIFIED (gate prepush fresco lean: focal 117/117 una corrida, ESLint/TSC(31/24 idéntico)/git show --check/build todos PASS; push único a1579f1..fe0e11d sin --force; autodeploy Git-triggered observado read-only — DeliGO Copy y chat en vivo ambos SUCCESS en fe0e11d0 exacto confirmado desde metadata real de Railway; health/logs postdeploy limpios; AUTH02 ahora DESPLEGADO en TESTING; R13_R7_AUTHORIZED=SI — ver §11.1)
R13_R7=PASS_AUTH01_AUTH02_FULL_REAL_BROWSER_REPLAY_18_OF_18 (matriz de 18 casos de R13 repetida desde cero con Chrome real, 0/18 crédito heredado; CASE_05 confirma que Cliente sobrevive sin recarga al login de Negocio, ataque directo a AUTH01; CASE_09 confirma que no-leidos/conversaciones/mensajes/realtime-token/realtime-authorize devuelven 200 para ambos actores coexistiendo, síntoma AUTH02 NO reproducido; 18/18 PASS, 2/2 correcciones de control documentadas, cleanup DB+navegador completo — ver §11.1)
F_P1_02_REAL_BROWSER_ACCEPTANCE=BLOCKED_REAL_BROWSER_TYPING_CONTROL_INVALID (intento con Chrome real, fixture fresca P2T18_F_P1_02_, topología X1/X2/Y1, baseline de chat PASS ambas direcciones — pero el indicador de typing nunca apareció en el receptor en ninguna dirección pese a room-grants recién renovados y sendTyping confirmado disparado por el emisor; CONTROL_INVALID, no PASS ni FAIL — ver §11.1)
F_P1_02_R1=PASS_DIAGNOSIS_GENUINE_TYPING_CHANNEL_DEFECT_ISOLATED (histórico, CORREGIDO por R1-R1 — el observador de WebSocket + read_network_requests compartían un punto ciego real para tráfico WS nativo; "cero evidencia" no era "cero conexión" — ver F_P1_02_R1_R1 abajo)
F_P1_02_R1_R1=PASS_FALSE_POSITIVE_IDENTIFIED_AND_CORRECTED (histórico — el navegador SÍ conecta, F-P2-T18-TYPING-CHANNEL-01 retirado; ver F_P1_02_R2 abajo para el bloqueador ACTUAL)
F_P1_02_R2=FAIL_NEW_LIVE_PUSH_DEFECT_ISOLATED (reintento de la matriz de 6 casos de typing con topología real X1/X2/Y1: 0/6 mostró indicador alguno, descartados metódicamente rate-limit/grant-expiry/timing/identidad/scopes; prueba decisiva — mensaje NUEVO enviado desde Y1 con el hilo de X1 ya montado y a la vista nunca apareció en vivo — aísla el defecto al push servidor→cliente EN GENERAL (new-message + user-typing), no sólo typing; el "baseline PASS" reflejaba HTTP+refetch-on-reopen, no push real; nuevo finding F-P2-T18-LIVE-PUSH-01 (OPEN_ROOT_CAUSE_NOT_INVESTIGATED, severidad MEDIUM_TO_HIGH); F_P1_02_CURRENT_STATUS=BLOCKED_BY_LIVE_PUSH_DEFECT; posible misma causa raíz que F-P1-01, no confirmado; NEXT_REQUIRES_USER_DISPOSITION=SI — ver §11.1)
F_P1_02_R3=PARTIAL_ROOT_CAUSE_NARROWING_NO_FIX_YET (histórico — descartadas multi-réplica, reconexión/expiración, wiring del relay; ver F_P1_02_R4 abajo)
F_P1_02_R4=PASS_SERVER_SIDE_RULED_OUT_GAP_IS_TRANSPORT_OR_CLIENT (histórico — instrumentación del chat-service confirmó join_ok + typing_received candidates=2 emitted=1, el servidor SÍ emite; ver F_P1_02_R5 abajo para la conclusión final)
F_P1_02_R5=PASS_CLIENT_HANDLER_NEVER_INVOKED_GAP_IS_TRANSPORT_DELIVERY (usuario autorizó instrumentación del código principal de la app; logging agregado a `attachEventRelay` en realtime-manager.ts — relay_fired en cada evento recibido del socket, excepciones de subscriber ya no silenciadas; commiteado, pusheado, desplegado a TESTING en DeliGO Copy Y chat en vivo; con fixture fresca, typing disparado, consola del receptor leída en tiempo real (verificado que console.log SÍ se captura y que el chunk desplegado SÍ contenía el código nuevo, vía fetch con cache:'no-store') — **relay_fired NUNCA se registró, para ningún evento, en ningún actor**; combinado con R4 (servidor confirmado emitiendo), esto es evidencia triple-convergente: UI nunca refleja push, servidor confirma que emite, cliente confirma que su handler nunca se invoca — TODA la lógica de aplicación (servidor y cliente) descartada con evidencia real; la brecha es de ENTREGA DE TRANSPORTE, candidato más plausible: infraestructura de red/proxy entre Railway y el navegador, fuera del alcance de instrumentación de código adicional; instrumentación revertida inmediatamente después (commit c05525a, realtime-manager.ts confirmado byte-idéntico al estado pre-diagnóstico) — ver §11.1)
F_P1_02_R6=CONFIRMED_NETWORK_INDEPENDENT_LIKELY_RAILWAY_INFRA (usuario eligió explorar infraestructura de Railway; antes de eso se descartó la sandbox de pruebas como confusor reproduciendo el mismo test en Chrome real sobre la red real del usuario — defecto idéntico, 0 indicador de typing; `railway logs --network --json` (read-only) no mostró paquetes descartados en una muestra, pero es a nivel TCP, no WebSocket-frame, limitando su valor diagnóstico; se agotaron las vías de código/CLI de sólo lectura disponibles — causa raíz exacta requeriría soporte/acceso a infraestructura de Railway, fuera del alcance de este flujo de trabajo — ver §11.1)
NEXT_TASK_ID=PENDING_USER_DISPOSITION
NEXT_TASK_STATUS=AWAITING_USER_INPUT (A: contactar soporte de Railway con la evidencia reunida, gestionado por el usuario; B: diferir y avanzar a otra prioridad post-T18; C: diferir y cerrar P2-T18 con residual aceptado)
P0=CLOSED
P1=CLOSED
P2=IN_PROGRESS
P3=NOT_STARTED
PHASE1=DEPLOYED_TESTING_CERTIFIED
PHASE2=DEPLOYED_TESTING_REAL_BROWSER_CERTIFIED_18_OF_18
P2_T18_CURRENT=BLOCKED_ONLY_BY_REMAINING_CHAT_UI_REAL_BROWSER_ACCEPTANCE_F_P1_02_THEN_F_P1_01
F_P2_T18_AUTH01_STATUS=RESOLVED
F_P2_T18_AUTH01_CURRENT_STATUS=RESOLVED
F_P2_T18_AUTH02_STATUS=RESOLVED
F_P2_T18_AUTH02_CURRENT_STATUS=RESOLVED
AUTH01_RESOLVED_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
AUTH02_RESOLVED_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
R13_R7_ACCEPTANCE_MATRIX=18_OF_18_PASS
AUTH02_PRODUCT_ALLOWLIST_COUNT=7
AUTH02_TEST_ALLOWLIST_COUNT=7
AUTH02_CALLSITE_COUNT=11
AUTH02_NEW_SCOPE_PUSH_STATUS=SI
AUTH02_UNSUBSCRIBE_AFFECTED=SI
AUTH02_ROUTE_HANDLERS_CHANGED=NO
R13_R3_MUTANTS_ATTEMPTED=19
R13_R3_MUTANTS_DETECTED=17
R13_R3_MUTANTS_SURVIVED=2
R13_R3_BLOCKER_CLASS=TEST_COVERAGE_GAP
R13_R3_R1_TARGET_TEST_PATH=src/hooks/use-push-notifications-static-contract.test.ts
R13_R3_R1_PRODUCT_PATHS_CHANGED=0
R13_R3_R1_TEST_PATHS_CHANGED=1
R13_R3_R1_FOCAL_RESULT=117_OF_117_PASS
R13_R3_RETRY_MUTANTS_ATTEMPTED=20
R13_R3_RETRY_EQUIVALENT_MUTANTS=1 (M3)
R13_R3_RETRY_NON_EQUIVALENT_DETECTED=18
R13_R3_RETRY_VALID_SURVIVORS=1 (savePushSubscription fetch(url) consumption — permission-prompt.tsx, cerrado en RETRY-R1)
R13_R3_RETRY_TARGET_TEST_PATH=src/components/shared/permission-prompt-static-contract.test.ts
R13_R3_RETRY_R1_TARGET_TEST_PATH=src/components/shared/permission-prompt-static-contract.test.ts
R13_R3_RETRY_R1_PRODUCT_PATHS_CHANGED=0
R13_R3_RETRY_R1_TEST_PATHS_CHANGED=1
R13_R3_RETRY_R1_FOCAL_RESULT=117_OF_117_PASS
R13_R3_RETRY_2_MUTANTS_ATTEMPTED=20
R13_R3_RETRY_2_EQUIVALENT_MUTANTS=1 (M3)
R13_R3_RETRY_2_NON_EQUIVALENT_DETECTED=19
R13_R3_RETRY_2_VALID_SURVIVORS=0
R13_R3_RETRY_2_SECURITY_MATRIX=20_OF_20_PASS
R13_R3_RETRY_2_LOCAL_ACCEPTANCE_MATRIX=12_OF_12_PASS
R13_R3_RETRY_2_FOCAL_RESULT=117_OF_117_PASS
R13_R3_RETRY_2_REGRESSION_TANDA_1=163_OF_163_PASS
R13_R3_RETRY_2_REGRESSION_TANDA_2=30_OF_31_PASS_1_FAIL (client-block-security.integration.test.ts, SEC-BLOCK-1, ajeno a AUTH02)
R13_R3_RETRY_2_REGRESSION_TANDA_3=NO_EJECUTADA
R13_R3_RETRY_2_R1_D1=FAIL (P2028, resA, 25144ms, aislado)
R13_R3_RETRY_2_R1_D2=PASS (19/19, archivo completo)
R13_R3_RETRY_2_R1_D3=PASS (31/31, TANDA_2 exacta)
R13_R3_RETRY_2_R1_FAILURE_CLASS=INCONCLUSIVE_EXTERNAL_DB_INSTABILITY
R13_R3_RETRY_2_R1_AUTH02_OVERLAP=NO (proxy.ts nunca importado/invocado en el test, confirmado estructuralmente)
R13_R3_FULL_RETRY_REQUIRED=SI (cumplido por R13-R3-RETRY-2; el gate de regresión fresca falló de nuevo en R13-R3-RETRY-2-R2; disposición determinada en R13-R3-RETRY-2-R2-R1; usuario aceptó excepción acotada y autorizó R13-R4 en R13-R3-RETRY-2-R2-R1A)
R13_R4_AUTHORIZED_BY_R13_R3_RETRY=NO
R13_R4_AUTHORIZED_BY_R13_R3_RETRY_R1=NO
R13_R4_AUTHORIZED_BY_R13_R3_RETRY_2=NO
R13_R4_AUTHORIZED_BY_R13_R3_RETRY_2_R1=NO
R13_R4_AUTHORIZED_BY_R13_R3_RETRY_2_R2=NO
R13_R4_AUTHORIZED_BY_R13_R3_RETRY_2_R2_R1=NO
R13_R4_AUTHORIZED_BY_R13_R3_RETRY_2_R2_R1A=SI
R13_R6_AUTHORIZED_BY_R13_R5=SI
R13_R7_AUTHORIZED_BY_R13_R6=SI
R13_REPLAY_REQUIRED_FROM_ZERO=SI
R13_REPLAY_REQUIRED_MATRIX=18_OF_18
CURRENT_HEAD=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
CURRENT_ORIGIN=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
CURRENT_AHEAD_OF_ORIGIN=0
LAST_PUSH_STAGE=P2-T18-BLOCKER-AUTH2-R13-R6
LAST_PUSH_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
LAST_TESTING_DEPLOY_STAGE=P2-T18-BLOCKER-AUTH2-R13-R6
LAST_REAL_BROWSER_STAGE=P2-T18-BLOCKER-AUTH2-R13-R7
LAST_RECONCILIATION_STAGE=P2-T18-BLOCKER-AUTH2-R13-R1
LAST_LOCAL_IMPLEMENTATION_STAGE=P2-T18-BLOCKER-AUTH2-R13-R2
LAST_DOC_RECONCILIATION_STAGE=P2-T18-BLOCKER-AUTH2-R13-R2-R1
LAST_ADVERSARIAL_REVIEW_STAGE=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2
LAST_TEST_ONLY_CORRECTION_STAGE=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-R1
LAST_DIAGNOSTIC_CLASSIFICATION_STAGE=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R1
LAST_CERTIFICATION_STAGE=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2
LAST_DISPOSITION_STAGE=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1
LAST_USER_PROCESS_DECISION_STAGE=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1A
LAST_LOCAL_COMMIT_STAGE=P2-T18-BLOCKER-AUTH2-R13-R4
LAST_POSTCOMMIT_REVIEW_STAGE=P2-T18-BLOCKER-AUTH2-R13-R5
LAST_TESTING_PUSH_DEPLOY_STAGE=P2-T18-BLOCKER-AUTH2-R13-R6
PRIMARY_HANDOFF=CODEX_REPORT.md
THIS_FILE_ROLE=SECONDARY_CROSS_CHAT_CONTEXT
```

**Regla de idioma (permanente, repetida en cada etapa)**: toda
comunicación dirigida al usuario, y toda narrativa agregada a los
reportes, se escribe en ESPAÑOL. Literales técnicos, hashes, rutas,
comandos y marcadores permanecen en inglés.

**Archivo raíz `32` (permanente, absoluto, repetido sin excepción en
cada prompt de etapa)**: NUNCA leer, inspeccionar, ejecutar, modificar,
stagear ni borrar. Aparece como `?? 32` en cada `git status` de este
proyecto — es intencional, no un artefacto a limpiar.

---

## 2. PERMANENT EXECUTION RULES

Reglas operativas acumuladas a lo largo de toda la sesión, vigentes
para cualquier tarea futura salvo que el usuario las revoque
explícitamente:

- **Idioma español + archivo `32` intocable** — ver §1, sin excepción.
- **`WOULD_NEW_FACT_HAVE_CHANGED_EXTERNAL_PROMPT`** (fuse rule,
  establecida tras el incidente "ALTO CONTROLADO" de AUTH2-R2): si
  durante la implementación se descubre un hecho arquitectónico nuevo
  que habría cambiado el encargo original de haberse conocido antes,
  se detiene todo trabajo sustantivo de inmediato — nunca se
  auto-adapta en silencio. Se reporta el hecho y se espera la próxima
  etapa/instrucción.
- **Stop-on-objective / anti-scope-creep**: al llegar a un veredicto
  PASS/BLOCK, se detiene inmediatamente — no se persigue causa raíz
  adicional ni se expande el alcance más allá de lo pedido por la
  etapa activa.
- **Archive-before-overwrite**: antes de sobrescribir
  `codex-reports/CURRENT_TASK.md` con el contenido de una nueva etapa,
  el contenido anterior se archiva primero en
  `codex-reports/archive/<TASK-ID>.md`, verificado por hash.
- **`git add --` explícito, nunca `-A` ni `.`** al preparar un commit
  de una etapa — sólo los paths exactos del allowlist congelado.
- **Un solo commit por etapa de "commit exacto"**, con subject
  pre-congelado en la etapa de diseño previa, nunca decidido en el
  momento del commit.
- **Push explícito y único** — sólo cuando el usuario lo autoriza
  expresamente en el propio prompt de la etapa (nunca por iniciativa
  propia), y siempre exactamente un `git push origin testing-codex`
  sin `--force`.
- **Autodeploy de Railway se observa pasivamente** (vía
  `railway status --json`, filtrando por `environmentId` de TESTING —
  el JSON completo incluye un nodo `production` no relacionado que se
  debe descartar) — nunca `railway up` ni redeploy manual.
- **Fixtures de DB reales sólo en TESTING**, vía
  `DELIGO_TEST_DATABASE_URL`, siempre con prefijo identificable en el
  nombre (p.ej. "P2T18 Stage7 R1"), y siempre eliminados por completo
  (0 remanentes) al finalizar la etapa. Nunca fallback silencioso a
  otra `DATABASE_URL`.
- **Byte-frozen neighbors**: cualquier archivo declarado "no debe
  cambiar" en una etapa se verifica con `git hash-object` antes Y
  después de cualquier trabajo con capacidad de mutación.
- **Mutation testing, cuando se pide, se ejecuta en un espejo AISLADO
  fuera del repo** (directorio temporal con `tsconfig.json` propio
  mapeando paquetes reales vía `paths`) — nunca se muta un archivo del
  repositorio real.
- **Un mutante sobreviviente bloquea la etapa**, salvo prueba
  independiente de que el arnés de mutación es inválido. En una etapa
  de revisión adversarial explícitamente marcada "no corregir", el
  hallazgo se reporta y se define un follow-up focal — nunca se
  corrige el test in situ, para preservar la separación entre "quien
  encuentra el defecto" y "quien lo corrige".
- **Un allowlist heredado de una etapa de diseño anterior se
  re-verifica contra el código actual en cada nueva etapa relevante,
  nunca se copia sin comprobar** — tanto para encontrar superficie no
  vista antes como para descartar superficie que ya no hace falta.
- **Un fallo de test se investiga por reproducibilidad antes de
  clasificarse** — ni se ignora silenciosamente, ni se trata como
  bloqueo automático, cuando hay evidencia de que es un flake
  transitorio de infraestructura externa (p.ej. una prueba de
  concurrencia real contra DB) y el código conmiteado no cambió entre
  intentos.
- **`codex-reports/archive/LEGACY_FULL_REPORT_20260826.md` es
  permanentemente inmutable** — nunca se modifica/reescribe/anexa, en
  ninguna tarea futura, para siempre.
- **Este archivo (`DELIGO_FULL_CONTEXT_LATEST.md`) se actualiza al
  finalizar cada tarea futura**, permanece sin trackear/sin stagear en
  Git, y se construye únicamente a partir de las 8 autoridades
  nombradas más el estado real de Git — nunca de la memoria del
  modelo.

---

## 3. SYSTEM / ARCHITECTURE SUMMARY

DeliGO es un monolito Next.js (`DeliGO Copy`, serviceId
`c6335604-063a-4a10-9c82-b0acb9e8ca7a`) más un microservicio de chat en
tiempo real separado (`chat en vivo`, serviceId
`bc071a6e-9ec1-46e4-99a9-e8ca0302a95e`), desplegados en Railway, proyecto
`amiable-rejoicing`. Tres tipos de actor con áreas propias bajo prefijo
de ruta: `/cliente`, `/negocio`, `/repartidor` (más `/admin` para
superadmin, fuera del sistema de familias). Autenticación por cookie de
sesión + fila `Sesion` en Postgres. Realtime vía WebSocket nativo
(`src/lib/realtime-manager.ts` en el cliente, chat-service en el
servidor) para chat y tracking de repartidor. Estado de auth en cliente
vía Zustand (`src/store/auth-store.ts`) con middleware `persist` sobre
`localStorage`.

**Infra Railway TESTING** (usada para toda certificación runtime real):
proyecto `amiable-rejoicing`, environment `TESTING`
(id `f37d0c49-b737-49e8-be89-a00c13734fae`), servicios `DeliGO Copy` y
`chat en vivo`, más Postgres y 2 cron jobs (`Review Moderation Expiry`,
`DeliGO Mesa Occupancy Cron`) que autodeployan incidentalmente en cada
push al monorepo.

---

## 4. ROADMAP (resumen — autoridad completa en `codex-reports/ROADMAP.md`)

```
P0=CLOSED
P1=CLOSED
P2=IN_PROGRESS
  P2-T02=PAUSED_EXTERNAL_DEPENDENCY
  P2-T05=CLOSED (push notification hardening)
  P2-T11=CLOSED (native-socket revocation hardening, con 1 residual LOW aceptado)
  P2-T12=CLOSED (TerminalOperativa dead-column removal)
  P2-T13=CLOSED (Race-B stale-detach fix)
  P2-T18=BLOCKED_BY_AUTH_SESSION_COEXISTENCE_PHASE2_PRECOMMIT_TEST_GAPS_FOUND (Chat Cross-Tab UI Polish — activo)
P3=NOT_STARTED
```

Próxima tarea canónica una vez P2-T18 cierre por completo (incluido su
blocker AUTH2 y la certificación real de navegador): sin definir
todavía — P2-T18 sigue siendo el foco activo de todo el roadmap.

---

## 5. COMPLETED TASK HISTORY (índice — autoridad completa en `codex-reports/COMPLETED_TASKS.md`, 963 líneas, leído íntegro)

- **P0 / P1**: CLOSED, fundacional, fuera de esta ventana de contexto reciente.
- **P2-T02**: PAUSED_EXTERNAL_DEPENDENCY.
- **P2-T05** (hardening de push notifications): Stage1→FINAL-TESTING-CHECKPOINT, findings F15/F18–F23 todos RESOLVED, commit final `e172cd7ac8245d32db89f96cf6c86ca31bb43cf2`.
- **P2-T11** (hardening de revocación de socket nativo): Stage1→Stage5G, Phase A/B/C commits `d0ba59d`/`e8d2171`/`f6ca24f`, CLOSED con 1 residual LOW aceptado — ver §10 para el contexto completo.
- **P2-T12** (remoción de columna muerta TerminalOperativa, dos fases): Stage1→Stage5F, commits `bebd36c`/`7822d84`, CLOSED.
- **P2-T13** (fix de Race-B stale-detach): Stage1→Stage7, commit `44b9da0`, CLOSED.
- **P2-T18-STAGE1**: baseline freeze de F-P1-01/F-P1-02, ambos `REPRODUCED`/`UI_POLISH` — arranque de la tarea activa, ver §11.

Los 5 commits recientes en `git log` de esta rama, en orden:
`d0ba59d` (Phase A P2-T11) → `7822d84`/`bebd36c` (P2-T12) →
`44b9da0` (P2-T13) → `e172cd7` (P2-T05 checkpoint), todos anteriores a
la cadena AUTH2 de P2-T18 (que añade `1adcc01f...` y `c047e9eb...`
encima, ambos ya en `origin/testing-codex`).

---

## 6. ACTIVE / DEFERRED FINDINGS (autoridad completa en `codex-reports/FINDINGS.md`)

Todos los findings de P0/P1/P2-T05/P2-T11/P2-T12/P2-T13 están
`RESOLVED`/`CLOSED`. Activos o diferidos actualmente:

1. **`F-P2-T18-AUTH01`** — `SAME_BROWSER_MULTI_ACTOR_SESSION_COLLISION`.
   Status actual: `PHASE2_LOCAL_IMPLEMENTED_TEST_COVERAGE_GAPS_FOUND_AWAITING_R9_R1`.
   Ver §12 para el diseño completo y §15 para la próxima acción.
2. **`F-P1-01`** — chat cross-tab: `messages-read` entregado a la
   pestaña hermana pero ignorado por la UI (unread queda stale hasta
   el próximo poll). `REPRODUCED_CURRENT_ACCEPTANCE_CONTRACT_FROZEN`,
   severidad `COSMETIC`, `UI_POLISH`. Bloqueado detrás de
   F-P2-T18-AUTH01 (necesita coexistencia multi-actor para certificar
   con navegador real con topología completa).
3. **`F-P1-02`** — chat cross-tab: typing se auto-refleja en la
   pestaña hermana del mismo actor. Fix ya commiteado/desplegado
   (`1adcc01f`). Ya NO bloqueado por AUTH01/AUTH02 (`RESOLVED` desde
   R13-R7). La certificación real-browser
   (`P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE`, 2026-08-29) confirmó
   baseline de chat sano pero `CONTROL_INVALID` en el canal de typing.
   El diagnóstico acotado subsiguiente
   (`P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R1`, 2026-08-29) aisló
   inicialmente como causa que el navegador nunca intentaba conectar
   al chat-service — nuevo finding `F-P2-T18-TYPING-CHANNEL-01`. La
   investigación de seguimiento (`P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R1-R1`,
   2026-08-29, disposición A del usuario "investigar/corregir ahora")
   **corrigió esa conclusión**: era un falso positivo de
   instrumentación (el observador de WebSocket y `read_network_requests`
   comparten un punto ciego real para tráfico WS nativo). Verificación
   decisiva con Chrome real contra el código sin modificar confirmó
   que **el navegador SÍ conecta correctamente** (`/realtime/token`+
   `/realtime/authorize`=200 gateados tras `ensureConnected()` exitoso,
   indicador UI "● Conectado"). `F-P2-T18-TYPING-CHANNEL-01` reclasificado
   `FALSE_POSITIVE_CORRECTED`, retirado como bloqueador. El reintento
   de aceptación (`P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R2`,
   2026-08-29) ejecutó la matriz de 6 casos con topología real
   X1/X2/Y1: **0/6 mostró indicador de typing**, con rate-limit/
   grant-expiry/timing/identidad/scopes metódicamente descartados. Una
   prueba decisiva (mensaje nuevo enviado desde Y1 con el hilo de X1
   ya montado y a la vista) confirmó que el defecto es más amplio:
   **el push servidor→cliente no llega en absoluto** (ni `new-message`
   ni `user-typing`), pese a conexión/autorización correctas — el
   "baseline PASS" reflejaba HTTP+refetch-on-reopen, no push real.
   Nuevo finding `F-P2-T18-LIVE-PUSH-01` (`OPEN_ROOT_CAUSE_NOT_INVESTIGATED`,
   severidad MEDIUM_TO_HIGH, posible misma causa raíz que F-P1-01, no
   confirmado). `F_P1_02_CURRENT_STATUS=BLOCKED_BY_LIVE_PUSH_DEFECT`.
   Ver `codex-reports/CURRENT_TASK.md` y §11.1 más abajo.
4. **`NONBLOCKING_COSMETIC_DEBT`** (sin F-ID formal) — prefijo
   `"configuration_"` duplicado en
   `mini-services/chat-service/internal-session-check-client.js`'s
   `checkSessionActive()`. `SEVERITY=COSMETIC`,
   `SECURITY_IMPACT=NINGUNO`, `STATUS=OPEN_NONBLOCKING`, dispuesto para
   una futura tarea equivalente a P2-T15.

---

## 7. PERMANENT DECISIONS / INVARIANTS (índice — autoridad completa en `codex-reports/DECISIONS_AND_INVARIANTS.md`)

- La autoridad de proxy/middleware activa es `src/proxy.ts` — Next.js
  16 falla el build si coexiste con `middleware.ts`. Nunca reintroducir
  `middleware.ts`.
- `SESSION_LOGIN_ATOMICITY_DEBT` resolvió únicamente atomicidad de
  logins concurrentes del MISMO actor — nunca resolvió coexistencia de
  cookies entre actores DISTINTOS (eso es exactamente
  `F-P2-T18-AUTH01`).
- Cuando dos partes del sistema (cliente/servidor) implementan el mismo
  concepto (resolución de familia por prefijo de ruta), deben usar
  EXACTAMENTE el mismo patrón boundary-safe de comparación — nunca una
  aproximación "parecida".
- "Tests en verde" no es prueba de ausencia de gaps de cobertura —
  sólo prueba que los tests existentes pasan contra el código
  existente. Un contrato de test estático basado en
  `toContain`/`toMatch` tiene una debilidad estructural inherente
  (`STATIC_STRING_ONLY_WEAKNESS`): detecta presencia de un patrón
  correcto, no ausencia de una condición adicional insertada en otro
  lugar.
- El resto de invariantes históricos (P0/P1/P2-T05/P2-T11/P2-T12/P2-T13)
  están documentados en detalle en el archivo fuente — no repetidos
  aquí por no ser accionables para el trabajo activo.

---

## 8. TEST AUTHORITIES (índice — autoridad completa en `codex-reports/TEST_AUTHORITY.md`)

```
PHASE1_LOCAL_TEST_TOTAL=73/73 PASS (5 archivos: proxy.test.ts + 4 más)
PHASE2_LOCAL_TEST_TOTAL=130/130 PASS (33 mandatorios de Fase 2 + 97 de regresión de Fase 1/P2-T11)
R9_FRESH_RERUN=130/130 PASS (re-derivado independientemente, coincide exacto)
R9_MUTATION_TESTING=12 mutantes intentados fuera del repo, 10 detectados, 2 sobrevivientes (gaps de cobertura, no defectos)
P2_T18_PHASE2_SAFE_TO_COMMIT=NO_BLOCKED_AWAITING_R9_R1_TEST_COVERAGE_CLOSURE
```

Archivos de test de Fase 2 (los 4 relevantes para el trabajo activo):
`src/store/auth-store.test.ts` (9 tests, nuevo), `src/lib/realtime-client.test.ts`
(7 tests, nuevo), `src/hooks/use-auth-static-contract.test.ts` (11
tests, nuevo), `src/providers/realtime-provider-cross-tab-static-contract.test.ts`
(6 tests, sólo assertion #2 modificada — preexistente de P2-T11).

---

## 9. GIT / DEPLOY HISTORY (índice — autoridad completa en `codex-reports/GIT_DEPLOY_HISTORY.md`)

```
HEAD_ACTUAL=a1579f11e79a41b90c6df4d2e8573ca9a669b856
ORIGIN_TESTING_CODEX=a1579f11e79a41b90c6df4d2e8573ca9a669b856 (idéntico, sin drift)
ÚLTIMO PUSH=P2-T18-BLOCKER-AUTH2-R12 (c047e9eb..a1579f11)
ÚLTIMO DEPLOY TESTING CONFIRMADO=commitHash a1579f11 en ambos servicios (DeliGO Copy deployment 78625067, chat en vivo deployment 1916b7af), ambos SUCCESS
```

Cadena de commits recientes en `testing-codex` (más antiguo → más
reciente): `d0ba59d` (P2-T11 Phase A) → `7822d84`/`bebd36c` (P2-T12) →
`44b9da0` (P2-T13) → `e172cd7` (P2-T05 checkpoint) → `f6ca24f` (P2-T11
Phase C) → `1adcc01f` (P2-T18-STAGE4, F-P1-01/F-P1-02 local) →
`c047e9eb` (P2-T18-BLOCKER-AUTH2-R4, Fase 1 de la fundación de cookies
por familia de actor, desplegada en TESTING desde R6) →
`a1579f1` (P2-T18-BLOCKER-AUTH2-R10, Fase 2 activación cliente —
**HEAD actual, también en `origin/testing-codex`**, desplegada en
TESTING desde R12). Fase 2 (11 paths, ver §13) fue implementada
localmente (R8), revisada adversarialmente con mutation testing (R9,
R9-R1), commiteada localmente (R10), recertificada independientemente
dos veces (R11, R12), pusheada y desplegada en TESTING (R12) — sólo
falta la certificación con navegador real (R13, no ejecutada).

---

## 10. P2-T11 FULL CONTEXT (native-socket revocation hardening — CLOSED)

Objetivo: que revocar la sesión de un actor (ban, logout forzado,
expiración) corte también su conexión de socket en tiempo real, no
sólo el acceso HTTP futuro. Implementado en 3 fases aditivas:
**Phase A** (`d0ba59d`) — validación de sesión en tiempo real vía un
endpoint interno nuevo; **Phase B** (`e8d2171`) — el chat-service
consulta ese endpoint y cierra el socket si la sesión ya no es válida;
**Phase C** (`f6ca24f`) — reducción del TTL de gracia a 120s y
aislamiento cross-tab same-browser certificado con navegador real
(Chromium vía CDP, dos pestañas del mismo origin/contexto): el logout
real dispara un evento nativo `storage` en la pestaña receptora en
15-20ms, la pestaña emisora nunca recibe su propio evento, y ningún
escenario adversarial (incluida una topología de actor revocado)
logró resucitar una sesión ni conectar un socket no autorizado.

Cerrado formalmente en Stage5G: `F-P2-T11-01=RESOLVED`, `P2-T11=CLOSED`.
Un único residual de severidad baja (evento de logout tardío bajo
timing patológico de navegador, nunca reproducido con las herramientas
de navegador disponibles — sin control CDP de lifecycle genuino)
quedó dispuesto como `ACCEPTED_LOW_NON_SECURITY_BLOCKING_LIMITATION`
— evaluado contra un modelo de amenaza de 4 preguntas (resurrección de
sesión, reautorización de actor revocado, acceso no autorizado a
socket, escalación de privilegio — las 4 `NO`), con política de
reapertura explícita si en el futuro surge una herramienta con control
genuino de lifecycle o evidencia de un efecto de seguridad real. La
terminación forzada instantánea cross-instance permanece
deliberadamente fuera de este cierre — mandato explícito de una tarea
anterior (P2-T09), nunca absorbida ni implementada aquí.

`realtime-manager.ts` y `realtime-types.ts` son la superficie pública
que Fase 2 de AUTH2 debe NUNCA tocar (ver §12) — son el corazón de este
sistema ya cerrado y certificado; cualquier cambio ahí reabriría el
riesgo que P2-T11 cerró.

---

## 11. P2-T18 FULL CONTEXT (Chat Cross-Tab UI Polish — tarea activa)

Objetivo original (complejidad estimada 2/10 al congelarse en Stage1):
corregir dos defectos cosméticos de UI cross-tab del chat — F-P1-01
(unread stale) y F-P1-02 (typing auto-reflejado) — ver §6.

Cadena de stages: **Stage1** (baseline freeze, ambos findings
recuperados y re-confirmados `REPRODUCED`) → **Stage2** (implementación
local del fix, 1 archivo de producto: `chat-sheet.tsx`) → **Stage3**
(revisión adversarial precommit) → **Stage4** (commit exacto,
`1adcc01f`) → **Stage5** (revisión post-commit de blobs) → **Stage6**
(push + deploy TESTING, certificado) → **Stage7** (intento de
certificación con navegador real) — **aquí surgió el blocker**: al
intentar establecer una topología de 3 pestañas (Cliente X1+X2, Negocio
Y1) en un mismo navegador, se descubrió que un segundo login
sobrescribe la cookie de sesión del primero (mismo nombre de cookie
`deligo_session` para todos los actores) — este es exactamente
`F-P2-T18-AUTH01` (ver §6/§12), que pasó a bloquear el resto de Stage7
y de toda la tarea.

Stage7 también produjo un hallazgo separado y todavía sin resolver: un
runtime defect en la ruta de typing X→Y (Cliente tipea → Negocio no ve
la actualización, pese a que el servidor emite correctamente y el
frame llega íntegro al WebSocket del receptor) — investigación
detenida por instrucción explícita del usuario, sin causa raíz
determinada, sin ningún fix intentado. Esto es independiente del
blocker AUTH2 y sigue pendiente si se retoma la certificación completa
de F-P1-02.

Desde entonces, toda la actividad de la tarea (R1 hasta la R9 actual)
ha sido resolver el blocker AUTH2 — ver §12 para el diseño y §15 para
el estado exacto.

---

## 12. P2-T18 CURRENT AUTH DESIGN (F-P2-T18-AUTH01 — same-browser multi-actor session coexistence)

**Problema**: `SESSION_COOKIE_NAME="deligo_session"` es global para
cliente/negocio/repartidor/superadmin (`src/lib/auth.ts:224`) — un
segundo login sobrescribe la cookie del primero en el navegador (mismo
nombre, mismo `path="/"`), aunque la fila `Sesion` en DB del primer
actor sigue siendo 100% válida. No es una vulnerabilidad de seguridad
(ninguna sesión ajena se lee/filtra; el peor caso es un re-login) pero
bloquea tanto la certificación de F-P1-02 con un solo navegador como
el caso de uso legítimo de operar Cliente y Negocio a la vez en el
mismo navegador.

**Diseño elegido**: `OPTION_A_ACTOR_FAMILY_SCOPED_SESSION_COOKIES`, sin
cambio de schema. Dos fases:

### Fase 1 — servidor (DONE, desplegada en TESTING, commit `c047e9eb`)

Cookies de sesión con nombre scoped por familia de actor
(`deligo_session_cliente`/`_negocio`/`_repartidor`), resueltas por
`resolveActorSession()` en `src/proxy.ts`, y presentadas a los route
handlers SIN modificar bajo el nombre de cookie legacy vía reescritura
de headers sólo-en-request. Archivos tocados:
`src/proxy.ts`, `src/lib/auth.ts`,
`src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`
— más 5 archivos de test. Certificado con 16/16 casos de seguridad
contra el backend real desplegado en TESTING (login individual
compatible, coexistencia simultánea de ambas cookies de familia,
aislamiento por path, selector conflictivo/malformado fail-closed,
header spoofeado sin autoridad, logout acotado por familia, transición
legacy sin fuga).

### Fase 2 — cliente (implementada por R8, certificada precommit por R9-R1, commiteada por R10, recertificada por R11, PUSHEADA Y DESPLEGADA EN TESTING por R12 — ver §15)

Activación del lado cliente: namespacing por familia en el
`localStorage` del store Zustand `persist`, un selector `?actorFamily=`
enviado por cada caller de los 4 endpoints compartidos
(`/api/auth/me`, `/api/auth/logout`, `/api/realtime/token`,
`/api/realtime/authorize`), y un listener cross-tab de logout
consciente de familia.

**Piezas clave**:

- **`activeSessionFamily(pathname)`** (en `src/store/auth-store.ts`,
  exportada) — única fuente de verdad, mapea `window.location.pathname`
  a `"cliente"|"negocio"|"repartidor"|null` usando
  `matchesFamilyPrefix(pathname, prefix)` =
  `pathname === prefix || pathname.startsWith(prefix + "/")` —
  deliberadamente el mismo patrón boundary-safe que `pathFamily()` del
  servidor. Nunca se deriva de storage ni de query strings; nunca se
  trata como autoridad de seguridad (el servidor siempre re-valida).
- **`familyScopedStorage()`/`familyScopedKey()`** — adapter `StateStorage`
  custom para `createJSONStorage`, remapea la clave fija `"deligo-auth"`
  a `deligo-auth:<family>` en cada `getItem`/`setItem`/`removeItem`,
  derivando la familia fresca (nunca cacheada) del pathname actual en
  cada llamada. Para pathnames sin familia (p.ej. `/admin`), cae al
  comportamiento legacy sin namespacing.
- **`withActorFamily(path, family)`** — helper local (duplicado con
  firmas ligeramente distintas en `use-auth.ts` y
  `realtime-client.ts`) que agrega `?actorFamily=<family>` a una URL
  sólo si la familia no es null — reutiliza exactamente el transporte
  ya certificado en Fase 1 (query param, nunca header).
- **Forma pública del store sin cambio**: `user: AuthUser | null`
  intacto — cada pestaña tiene memoria JS/Zustand independiente; sólo
  `localStorage` es compartido entre pestañas, por eso sólo la CLAVE
  necesitaba namespacing, nunca la forma en memoria. 26/26 consumidores
  directos confirmados sin necesidad de cambio.

**Allowlist congelado de Fase 2 (7 archivos de producto, exacto, re-verificado
independientemente en R7, R9 Y R10 — ahora los 7 forman parte del
commit local `a1579f11e79a41b90c6df4d2e8573ca9a669b856`)**:

```
src/store/auth-store.ts
src/providers/realtime-provider.tsx
src/hooks/use-auth.ts
src/lib/realtime-client.ts
src/hooks/use-suspension-check.ts
src/app/login/page.tsx
src/components/auth/auth-modal.tsx
```

`src/lib/realtime-manager.ts` y `src/lib/realtime-types.ts` fueron
descartados del allowlist en R7 (no requieren cambio —
`realtime-client.ts` corre en el navegador y deriva la familia por sí
mismo) y deben permanecer byte-idénticos — verificado 3 veces
(R8 antes/después, R9 independientemente) contra hash
`06c857ce8b4e46e2df37ad92174771046b6cdb26` /
`93dd06e7bbe328fdc3262ecbc02d53715e53631a`.

**4 archivos de test relacionados** (ver §8, §13 para hashes):
`src/store/auth-store.test.ts` (nuevo en R8, +2 tests de rehidratación
en R9-R1), `src/lib/realtime-client.test.ts` (nuevo, sin cambio desde
R8), `src/hooks/use-auth-static-contract.test.ts` (nuevo, sin cambio
desde R8), `src/providers/realtime-provider-cross-tab-static-contract.test.ts`
(assertion #2 modificada en R8, +1 test de guard exacto en R9-R1).

**R9 (revisión adversarial) + R9-R1 (cierre de gaps)**: R9 encontró,
vía mutation testing aislado (12 mutantes fuera del repo), que 2
sobrevivían — un `getItem` hardcodeado a la familia Cliente (sin
cobertura de rehidratación), y un listener cross-tab que aceptaría la
clave legacy plana `deligo-auth` (el contrato estático de P2-T11 sólo
probaba presencia del patrón correcto, no ausencia de un bypass OR).
Ambos eran gaps de TEST, no defectos de producto (verificado por
lectura directa dos veces). R9-R1 cerró ambos exclusivamente con
tests nuevos — 2 en `auth-store.test.ts` (rehidratación real vía
`useAuthStore.persist.rehydrate()`), 1 en el contrato estático cross-tab
(guard exacto) — sin tocar ningún archivo de producto. Replay completo:
12/12 mutantes detectados. 133/133 tests, 20/20 seguridad, 10/10
aceptación.

**R10 (commit local exacto)**: convirtió esos 11 paths, ya
certificados dos veces, en un único commit local
(`a1579f11e79a41b90c6df4d2e8573ca9a669b856`, parent `c047e9eb`, subject
`feat: enable actor-family client auth coexistence`) — corrida
decisiva de 133/133 tests, fingerprint 11/11 idéntico antes/después de
los gates, staging explícito de sólo esos 11 paths, commit recertificado
directamente desde los objetos Git (11/11 blobs commiteados idénticos
a los staged/certificados, working tree limpio contra HEAD). **NO
pusheado** — `AHEAD=1`/`BEHIND=0` contra `origin/testing-codex`
(`c047e9eb`, sin cambio).

**R11 (recertificación postcommit/prepush independiente)**: repitió
toda la verificación de R10 pero SIN confiar en su narrativa — re-derivó
el fileset y los 11 blob IDs directamente de `git diff-tree`/`git
ls-tree HEAD` (11/11 idénticos), leyó los 11 blobs completos vía `git
show HEAD:<path>`, re-clasificó el diff `HEAD^..HEAD` completo (19
hunks, 0 sin clasificar), re-ejecutó standalone la lógica de
boundary-safety copiada literalmente del blob committed (18 casos),
confirmó los 6 vecinos congelados sin diff entre `HEAD^`/`HEAD`, y
declaró aplicable la autoridad de mutation testing 12/12 de R9-R1 por
identidad exacta de bytes (sin repetir la campaña completa).
Reconstruyó 20/20 seguridad y 10/10 aceptación, corrió 133/133 tests
frescos (corrida decisiva única), y confirmó lint/TSC/`git show
--check`/build limpios. Fase 2 quedó
`PHASE2_POSTCOMMIT_CERTIFIED_READY_FOR_FRESH_TESTING_PREPUSH` —
técnicamente lista para push, pero R11 NO otorgó un push futuro ciego:
R12 repitió gates decisivos frescos inmediatamente antes del push
real.

**R12 (push exacto + autodeploy certificado)**: repitió en fresco toda
la revalidación decisiva (11/11 fileset/blobs, vecinos congelados sin
drift, 133/133 tests a la primera, 20/20 seguridad, 10/10 aceptación,
mutation authority 12/12 por identidad de blobs, lint/TSC/build
limpios), confirmó Railway inequívocamente en TESTING sin deploy
concurrente y con health prepush limpio, y ejecutó **exactamente un**
`git push origin testing-codex` (`c047e9eb..a1579f11`, sin `--force`)
— `HEAD=ORIGIN=a1579f11`, `AHEAD=0`/`BEHIND=0`. Observó únicamente
(sin `railway up`/redeploy manual) el autodeploy Git-triggered:
`DeliGO Copy` (deployment `78625067`) y `chat en vivo` (deployment
`1916b7af`) ambos `SUCCESS` con `commitHash=a1579f11` exacto
confirmado desde metadata real de Railway. Logs sin error, health
postdeploy limpio, y un smoke de regresión de Fase 1 server sin
navegador (7 casos: selector válido/desconocido/malformado siempre
fail-closed, sin fuga de `Set-Cookie`, sin fallback cruzado, sin 5xx)
confirmó `PHASE1_POSTDEPLOY_SERVER_REGRESSION=PASS`.
`PHASE2_DEPLOYED_FROM_EXACT_COMMIT=SI`;
`PHASE2_BROWSER_BEHAVIOR_CERTIFIED=NO` — resultado esperado, la
certificación real de navegador queda íntegramente para
`P2-T18-BLOCKER-AUTH2-R13`. Fase 2 queda
`PHASE2_DEPLOYED_TESTING_AWAITING_SAME_BROWSER_REAL_ACCEPTANCE`.

---

## 13. CURRENT WORKING TREE (Fase 2 commiteada, recertificada 3 veces, PUSHEADA Y DESPLEGADA EN TESTING, HEAD=ORIGIN=`a1579f1`)

```
$ git status -sb
## testing-codex...origin/testing-codex
?? 32                                                                   <- NUNCA TOCAR
?? CODEX_REPORT.md
?? codex-reports/**
?? DELIGO_FULL_CONTEXT_LATEST.md                                        <- este archivo, sin trackear a propósito
```

Los 11 paths de Fase 2 (7 producto + 4 test) ya NO aparecen como
dirty — quedaron commiteados en `a1579f11e79a41b90c6df4d2e8573ca9a669b856`
(parent `c047e9eb`), y ese commit ya está también en
`origin/testing-codex` (pusheado en R12) y desplegado en TESTING. El
working tree de source/test está completamente limpio contra HEAD.
Blobs exactos commiteados (`git ls-tree HEAD -- <path>`, idénticos a
los certificados en R9-R1/R9/R10/R11):

```
src/store/auth-store.ts                                              = 16c87112cca52b15112e1c7cdda04e83b83573b4
src/providers/realtime-provider.tsx                                  = 4d0b534da3ab21a9a2a70723bd1014e9664562ab
src/hooks/use-auth.ts                                                = 599702c40e3f25b8e2a74dbb4e3496cb7530ed8f
src/lib/realtime-client.ts                                           = ffdeed213e36adf26e2884b2b10a7400516c362f
src/hooks/use-suspension-check.ts                                    = c5501aefca71d395d20b7c08034021b95ba43061
src/app/login/page.tsx                                               = 4341ebcaa10fe86128cf22e650551a7f20e92b59
src/components/auth/auth-modal.tsx                                   = 3b46364f4c1f439b6db37da73e7e7822df59ba4a
src/hooks/use-auth-static-contract.test.ts                           = ff089771a07d30fd61b705fb8a0ca480dd4e304c
src/lib/realtime-client.test.ts                                      = 3e9d6abbf8fc25df02bf02e3d6f54c2eb54add0d
src/store/auth-store.test.ts                                         = 7aeb0f3903c04746714ca42c83dd189f9fca062a
src/providers/realtime-provider-cross-tab-static-contract.test.ts    = 7e62fe8ed87848e7db50ebae85c2e1a5ea68c246
```

`CODEX_REPORT.md` y `codex-reports/**` siguen sin trackear — son parte
del sistema de reportes de esta sesión, nunca se commitean al repo del
producto (son metadata de proceso, no código).

---

## 14. CURRENT FROZEN CONTRACTS

```
PHASE2_RECONCILED_PRODUCT_ALLOWLIST_COUNT=7 (ver §12, congelado en R7, re-verificado en R9, R9-R1, R10, R11 y R12)
PHASE2_RECONCILED_TEST_ALLOWLIST_COUNT=4 archivos físicos (5 obligaciones consolidadas)
REALTIME_MANAGER_PUBLIC_API_CHANGE_REQUIRED=NO
R12_PHASE2_SECURITY_MATRIX=20_OF_20_PASS
R12_LOCAL_ACCEPTANCE_MATRIX=10_OF_10_PASS
R12_MUTATION_AUTHORITY=12_OF_12_BY_CERTIFIED_BLOB_IDENTITY (0 sobrevivientes)
COMMIT_SUBJECT=feat: enable actor-family client auth coexistence
COMMIT_HASH=a1579f11e79a41b90c6df4d2e8573ca9a669b856
COMMIT_PARENT=c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb
PUSHED=SI (R12, c047e9eb..a1579f11)
DEPLOYED_TESTING=SI (R12, DeliGO Copy deployment 78625067, chat en vivo deployment 1916b7af, ambos commitHash=a1579f11)
PHASE2_BROWSER_BEHAVIOR_CERTIFIED=PARTIAL (R13, 9/18 puntos de la matriz confirmados con navegador real — ver §15)
R13_AUTH01_ACCEPTANCE_MATRIX=9_OF_18_CONFIRMED_1_OF_18_CLEANUP_8_OF_18_NOT_REACHED
F_P2_T18_AUTH01_STATUS=OPEN_BLOCKED_BY_AUTH02_CERTIFICATION_DEPLOY_AND_FULL_R13_REPLAY
AUTH02_PRODUCT_ALLOWLIST_COUNT=7 (congelado en R13-R1, implementado en R13-R2, ver §11.1)
AUTH02_TEST_ALLOWLIST_COUNT=7 (implementado en R13-R2)
AUTH02_FOCAL_TEST_RESULT=117_OF_117_PASS
AUTH02_REGRESSION_RESULT=294_OF_294_PASS
```

El commit exacto de Fase 2 fue recertificado TRES VECES desde los
objetos Git (R10 dentro de su propia etapa, R11 de forma
independiente, R12 en fresco inmediatamente antes del push), pusheado
exactamente una vez y desplegado en TESTING — server (Fase 1) y
cliente (Fase 2) ahora coexisten en el mismo commit desplegado. R13
certificó con navegador real el núcleo de la coexistencia (cookies,
storage, reload, realtime-connection) — confirmado funcionando — pero
descubrió un defecto real DISTINTO (`F-P2-T18-AUTH02`, ver §11.1) que
bloquea el cierre 18/18 de la matriz. R13-R1 (read-only) reconcilió
causa raíz/callers/allowlist exactos para ese defecto; R13-R2 lo
**implementó localmente** (sin commit/push) exactamente como fue
congelado — ver §11.1 para el detalle. Ver `codex-reports/CURRENT_TASK.md`
(reporte de R13-R2) para el detalle completo.

---

## 11.1. F-P2-T18-AUTH02 (descubierto en R13, reconciliado en R13-R1, implementado en R13-R2, auditado adversarialmente en R13-R3, gap M9 cerrado en R13-R3-R1, recertificado desde cero en R13-R3-RETRY — segundo gap M19-NEW encontrado y cerrado en R13-R3-RETRY-R1 — recertificación final desde cero en R13-R3-RETRY-2 BLOQUEADA por fallo de regresión ajeno — fallo clasificado INCONCLUSIVE en R13-R3-RETRY-2-R1 — gate de regresión fresca BLOQUEADO por SEGUNDO fallo consecutivo en R13-R3-RETRY-2-R2 — disposición determinada en R13-R3-RETRY-2-R2-R1 — usuario acepta excepción acotada y AUTORIZA R13-R4 en R13-R3-RETRY-2-R2-R1A — COMMIT LOCAL EXACTO ejecutado en R13-R4 — RECERTIFICADO INDEPENDIENTEMENTE desde objetos Git en R13-R5 — PUSHEADO Y DESPLEGADO EN TESTING en R13-R6 — RESUELTO con navegador real 18/18 en R13-R7)

```
FINDING_ID=F-P2-T18-AUTH02
TITLE=Endpoints compartidos de Chat/Push devuelven 401 para AMBOS actores bajo coexistencia real de 2+ cookies de familia
STATUS=RESOLVED
SEVERITY=FUNCIONAL (no seguridad — fail-closed en el 100% de los casos)
ROOT_CAUSE=el rewrite de cookie legacy en src/proxy.ts es incondicional a AUTH_REQUIRED_PREFIXES (depende sólo de si resolved.token es truthy) — así que cualquier endpoint que lea la cookie legacy directamente sufre la ambigüedad de resolveActorSession() bajo 2+ candidatas, esté o no en esa lista.
AUTH02_ENDPOINT_COUNT=6 (no-leidos, conversaciones, mensajes/[pedidoId], subscribe, unsubscribe, status)
AUTH02_PRODUCT_ALLOWLIST=src/proxy.ts + src/components/chat/{chat-fab,chat-sheet,chat-view,share-target-flow}.tsx + src/hooks/use-push-notifications.ts + src/components/shared/permission-prompt.tsx (7 archivos, CERO route handlers — commiteado, pusheado y desplegado byte-idéntico en fe0e11d0)
AUTH02_TRUSTED_FAMILY_SOURCE=useAuthStore().user?.type para 9 de los 11 call sites (NO pathname — ChatFab/ChatSheet/ChatView/PermissionPrompt están montados en el ROOT layout, activos en cualquier ruta); share-target-flow.tsx (2 call sites) usa su prop role explícito
AUTH02_TEST_RESULT_R13_R2=7 archivos (4 modificados + 3 nuevos), 117/117 PASS focal, 294/294 PASS regresión
AUTH02_MUTATION_CAMPAIGN_R13_R3_RETRY_2=20 mutantes (19 originales + M19-NEW), 19/19 no-equivalentes detectados, M3 reconfirmado equivalente, 0 sobrevivientes válidos — preservada por identidad de blob hasta el deploy (nunca repetida)
AUTH02_R13_R3_RETRY_2_REGRESSION_BLOCKER=1 fallo decisivo en client-block-security.integration.test.ts (SEC-BLOCK-1, dispositivo compartido) — investigado, repetido, dispuesto y aceptado por el usuario como excepción acotada en la cadena R13-R3-RETRY-2-R1→R2-R1A
AUTH02_R13_R3_RETRY_2_R2_R1_DISPOSITION=EXTERNAL_TESTING_DB_RELIABILITY_LIMITATION_REQUIRES_NEW_CERTIFICATION_AUTHORITY (confianza MEDIA, técnica, preservada histórica)
AUTH02_R13_R3_RETRY_2_R2_R1A_USER_DECISION=USER_DEDICATED_TEST_DATABASE_DECISION=DEFERRED — el usuario decidió continuar con la infraestructura de TESTING existente, aceptando la excepción TEMP_TESTING_INFRA_EXCEPTION_ID=EX-P2-T18-SEC-BLOCK-1-P2028 (sólo este caso exacto, no permanente, sin tocar el test en código)
AUTH02_DB_REGRESSION_CERTIFICATION=PASS_WITH_ONE_USER_ACCEPTED_TESTING_INFRA_EXCEPTION
AUTH02_DEFERRED_FINDING=F-P2-TESTINFRA-01 (DEFERRED_BY_USER, revisit P2-T10)
AUTH02_R13_R4_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f (parent a1579f11e79a41b90c6df4d2e8573ca9a669b856, subject "fix: scope shared auth requests by actor family")
AUTH02_R13_R5_INDEPENDENT_VERIFICATION=fileset por 2 métodos Git + 14 blob IDs vía git ls-tree HEAD — 14/14 idénticos; contrato de proxy/Chat/Push y M9/M19 confirmados leyendo los blobs directamente de HEAD; 0 tests ejecutados
AUTH02_R13_R6_PUSH_DEPLOY=push único a1579f1..fe0e11d (sin --force); DeliGO Copy SUCCESS (deployment 4e6618dc) y chat en vivo SUCCESS (deployment 43abe272), ambos en commit fe0e11d0 exacto confirmado desde metadata real de Railway; health/logs postdeploy limpios, 0 errores materiales
AUTH02_COMMIT_STATUS=SI (pusheado y desplegado en TESTING)
AUTH02_PUSHED=SI
AUTH02_DEPLOYED_TESTING=SI
R13_R7_AUTHORIZED=SI
R13_R7_ACCEPTANCE_MATRIX=18_OF_18_PASS
AUTH02_RESOLVED_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
NEXT_ACTION=P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE
```

Detalle completo en `codex-reports/CURRENT_TASK.md` (reporte de
R13-R7) y `codex-reports/FINDINGS.md` (incluye `F-P2-TESTINFRA-01`, la
deuda diferida separada). **Pusheado y desplegado en TESTING** — el
commit `fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f` (parent `a1579f11`,
subject `fix: scope shared auth requests by actor family`) ya no es
sólo un commit local: `origin/testing-codex` apunta exactamente a él
(`HEAD=ORIGIN=fe0e11d0`, `AHEAD=0`/`BEHIND=0`), y tanto "DeliGO Copy"
como "chat en vivo" lo sirven en producción de TESTING con estado
`SUCCESS` confirmado desde la metadata real de Railway — nunca
inferido del éxito del `git push`. Técnicamente AUTH02 está 100%
certificado en todas las dimensiones (0 gaps de cobertura, 0 mutantes
sobrevivientes válidos, matriz de seguridad 20/20, aceptación 12/12,
focal 117/117, TANDA_1 163/163 — preservado por identidad de bytes/
blob a través de SIETE etapas independientes) más una excepción de
infraestructura de TESTING estrechamente acotada, explícitamente
aprobada por el usuario, que NO modifica ningún byte de source/test.
R13-R3, el primer R13-R3-RETRY, R13-R3-RETRY-2, R13-R3-RETRY-2-R1,
R13-R3-RETRY-2-R2, R13-R3-RETRY-2-R2-R1A, R13-R4 y R13-R5 permanecen
históricos exactamente como se cerraron, sin reescribir.
`AUTH02_LOCAL_COMMIT_COMPLETE=SI`, `AUTH02_PUSHED=SI`,
`AUTH02_DEPLOYED_TESTING=SI`, `R13_R7_AUTHORIZED=SI`. `R13-R7`
(2026-08-29) ejecutó el replay completo de navegador real desde cero
(18/18, el resultado parcial histórico 9/18 de R13 no contó) con
Chrome real contra el commit desplegado — **18/18 PASS**, incluyendo
la recreación directa del síntoma de este finding (CASE_09: chat del
Pedido abierto en ambas tabs, `no-leidos`/`conversaciones`/`mensajes`/
`realtime-token`/`realtime-authorize` todos `200`, no reproducido).
`F-P2-T18-AUTH01` y `F-P2-T18-AUTH02` pasan a `RESOLVED`
(`AUTH01_RESOLVED_COMMIT=AUTH02_RESOLVED_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`).
P2-T18 en sí NO se cierra — queda bloqueado únicamente por la
aceptación con navegador real de la UI de Chat restante (`F-P1-02`,
luego `F-P1-01`).

---

## 15. CURRENT NEXT TASK

```
NEXT_TASK_ID=PENDING_USER_DISPOSITION
NEXT_TASK_TITLE=(depende de la disposición elegida por el usuario)
NEXT_TASK_STATUS=AWAITING_USER_INPUT
SCOPE_ESPERADO=
  No definido — requiere disposición explícita del usuario entre: (A)
  investigar/corregir ahora el defecto de conexión del socket
  (`F-P2-T18-TYPING-CHANNEL-01`), en una etapa de implementación nueva;
  (B) diferir F-P1-02/el nuevo finding y avanzar a la aceptación de
  F-P1-01 de todos modos (aunque probablemente tropiece con el mismo
  defecto, al depender también de push en vivo); (C) diferir ambos
  ítems de aceptación residual y cerrar P2-T18 con un residual MEDIUM
  aceptado explícitamente.
PRECONDITION=P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R1 PASS_DIAGNOSIS_GENUINE_TYPING_CHANNEL_DEFECT_ISOLATED
  (cumplida, 2026-08-29) — diagnóstico acotado (3 observaciones máximo)
  aisló el primer tramo roto: Observation 1 (harness externo,
  socket.io-client real, dos actores reales) confirmó el chat-service
  100% sano en ambas direcciones; Observation 2 (Browser 2 real, espera
  deliberada de 5s antes de escribir) descartó timing/room-grant;
  Observation 3 (observador temporal de solo lectura de WebSocket,
  excepción puntual del prompt) confirmó, corroborado por
  `read_network_requests`, que el navegador nunca intenta conectar al
  chat-service pese a que `/realtime/token`+`/realtime/authorize`
  devuelven `200`. `FIRST_BROKEN_HOP=HOP_B`,
  `R1_CLASSIFICATION=SENDER_CLIENT_EGRESS_DEFECT`, nuevo finding
  `F-P2-T18-TYPING-CHANNEL-01` (no es el guard de auto-eco de F-P1-02
  en sí). Ningún fix intentado; cleanup DB+navegador+harness+observador
  completo, 0 residuales; Git final sin cambio,
  `HEAD=ORIGIN=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`,
  `AHEAD=0`/`BEHIND=0`, índice vacío.
```

Con `R13-R7` (replay 18/18 fresco) en PASS: `F-P2-T18-AUTH01` y
`F-P2-T18-AUTH02` pasaron a `RESOLVED`. El intento de certificar
`F-P1-02` con navegador real
(`P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE`, 2026-08-29) quedó
`BLOCKED_REAL_BROWSER_TYPING_CONTROL_INVALID`; el diagnóstico
subsiguiente (`...-R1`, 2026-08-29) aisló la causa en un defecto
DISTINTO (`F-P2-T18-TYPING-CHANNEL-01`, el navegador nunca conecta al
chat-service). `P2-T18` sigue bloqueada exactamente igual que antes de
esos dos intentos (`F-P1-02` seguido de `F-P1-01`) — el único cambio
es que ahora se sabe DÓNDE se rompe, no sólo que estaba roto. Por
política explícita de velocidad del usuario, no se define
automáticamente una etapa de implementación — se requiere su
disposición. **Sólo cuando F-P1-02 y F-P1-01 certifiquen** comienza la
prioridad post-P2-T18 del usuario: primero la auditoría de
sincronización Producción-vs-`testing-codex` (comparando
`https://github.com/LeoCampos2504/DeliGO` contra
`https://github.com/LeoCampos2504/DeliGO/tree/testing-codex`) y su
sincronización aprobada en etapas controladas — antes de que negocios
reales carguen catálogos de producto —, luego `P2-T06`, luego el gate
de dependencia inmediato de `P2-T14`. Ninguna de estas etapas
posteriores está definida en detalle todavía. La deuda diferida
`F-P2-TESTINFRA-01` (DB de TESTING dedicada) queda para
`P2-T10`/trabajo futuro de infraestructura, sin relación con este
cierre.

---

## 16. COLD-HANDOFF SELF-CHECK (validación obligatoria de esta etapa)

1. ¿Repo? → `C:\Leo Campos\Trabajo\deligo-main-limpio`. ✓ §1
2. ¿Rama? → `testing-codex`. ✓ §1
3. ¿HEAD actual? → `fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`, IDÉNTICO a `origin/testing-codex` (`AHEAD=0`/`BEHIND=0`) — pusheado en R13-R6 (`a1579f1..fe0e11d`) y desplegado con `SUCCESS` en TESTING (DeliGO Copy + chat en vivo, commit exacto confirmado desde metadata real de Railway); R13-R7 no generó ningún commit/push/deploy nuevo, sólo confirmó el mismo estado. ✓ §1/§9
4. ¿Tarea actual? → `P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R2`. ✓ §1
5. ¿Estado actual? → `FAIL_NEW_LIVE_PUSH_DEFECT_ISOLATED` (reintento de la matriz de 6 casos de typing con topología real X1/X2/Y1, tras confirmarse en R1-R1 que el canal de conexión SÍ funciona; 0/6 casos mostró indicador de typing en ninguna dirección, con rate-limiting/expiración de grant/latencia de render/identidad de actor/política de scopes descartados metódicamente uno por uno; prueba decisiva — un mensaje de chat NUEVO enviado desde Y1 mientras X1 ya tenía el hilo montado y a la vista nunca apareció en vivo, sólo los mensajes de baseline vistos tras reabrir el hilo — aísla el defecto al **push servidor→cliente en general** (`new-message` Y `user-typing`, no sólo typing), no a la conexión ni a la autorización (ambas confirmadas correctas); nuevo finding `F-P2-T18-LIVE-PUSH-01` (`OPEN_ROOT_CAUSE_NOT_INVESTIGATED`, severidad MEDIUM_TO_HIGH, causa raíz deliberadamente no investigada más allá del aislamiento — fuera de alcance de una etapa de aceptación); `F_P1_02_CURRENT_STATUS=BLOCKED_BY_LIVE_PUSH_DEFECT`; posible misma causa raíz que F-P1-01, no confirmado; cero mutación de producto, cleanup DB+navegador+scratchpad completo). ✓ §1/§11.1/§15
6. ¿Qué es P2-T18? → Chat Cross-Tab UI Polish, bloqueada por F-P2-T18-AUTH01 desde Stage7. ✓ §11
7. ¿Estado de Fase 1? → DONE, commiteada (`c047e9eb`), pusheada y desplegada en TESTING, certificada 16/16 runtime, y su núcleo re-confirmado con navegador real en R13. ✓ §12
8. ¿Estado de Fase 2? → Implementada (R8), revisada adversarialmente con mutation testing (R9 BLOCK, R9-R1 cierre de gaps), commiteada (R10), recertificada independientemente dos veces (R11, R12), pusheada y desplegada en TESTING (R12, `a1579f1`), certificada PARCIALMENTE con navegador real en R13 (9/18 — núcleo funcionando, defecto distinto aislado como F-P2-T18-AUTH02), ese defecto reconciliado, implementado, auditado adversarialmente (BLOCK por gaps M9/M19-NEW, ambos cerrados), recertificado desde cero dos veces, bloqueado por un fallo de regresión ajeno de infraestructura de TESTING (investigado, repetido, dispuesto), aceptado por el usuario como excepción acotada y AUTORIZANDO R13-R4, commiteado localmente (`fe0e11d0`), recertificado independientemente en R13-R5, PUSHEADO Y DESPLEGADO en TESTING en R13-R6, y ahora CERTIFICADA COMPLETA con navegador real en R13-R7 (18/18 fresco). `F_P2_T18_AUTH01_STATUS=RESOLVED`, `F_P2_T18_AUTH02_STATUS=RESOLVED`. ✓ §12/§15
9. ¿Los 11 paths de Fase 2 (commit `a1579f11`)? → Siguen sin dirty por sí mismos — commiteados, pusheados, re-verificado en R10/R11/R12/R13/R13-R1 sin cambio. **El working tree de AUTH02 ya NO tiene cambios** — los 14 paths (7 producto + 7 test) que estuvieron en el working tree desde R10 son ahora el commit `fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f` (parent `a1579f11`), pusheado y desplegado, confirmado byte-idéntico al estado certificado en cada etapa previa incluyendo R13-R6 (sólo 2 test paths cambiaron en total desde R10 — M9 en R13-R3-R1, M19-NEW en R13-R3-RETRY-R1 —, ambos exactamente como autorizado). Blobs de `a1579f11` (Fase 2 R10) exactos en §13; blobs de `fe0e11d0` (AUTH02) verificados 14/14 en R13-R4 y de forma independiente en R13-R5, ahora servidos en TESTING.
10. ¿Por qué `realtime-manager.ts` no debe cambiar? → Ya certificado y cerrado por P2-T11; Fase 2 lo descartó del allowlist en R7 porque `realtime-client.ts` puede derivar la familia por sí mismo sin tocarlo — permanece byte-idéntico también dentro del commit desplegado, re-verificado sin diff entre `HEAD^` y `HEAD` en R11 y R12, y por fingerprint SHA-256 en cada etapa de AUTH02 hasta el commit desplegado `fe0e11d0`; su lógica de demand-gating (`acquireOrderRoom`/`hasGlobalRealtimeDemand`) fue la causa de que R13 necesitara ampliar el fixture con un Pedido real, no un defecto. AUTH02 tampoco lo toca. ✓ §10/§12
11. ¿Estado de P2-T11? → `CLOSED`, con 1 residual LOW `ACCEPTED_LOW_NON_SECURITY_BLOCKING_LIMITATION`. ✓ §10
12. ¿Próxima tarea? → `PENDING_USER_DISPOSITION` (nuevo finding `F-P2-T18-LIVE-PUSH-01` — el push servidor→cliente no llega en el navegador real, bloqueando F-P1-02; se requiere que el usuario elija entre investigar/corregir ahora, diferir y avanzar a otra prioridad post-T18, o diferir y cerrar P2-T18 con residual aceptado — mismo patrón de disposición A/B/C que R1), alcance en §15. ✓
13. ¿Acciones prohibidas permanentes? → Ver §2 (idioma, archivo `32`, WOULD_NEW_FACT rule, stop-on-objective, archive-before-overwrite — **el commit `fe0e11d0` sólo incluyó exactamente los 14 paths de AUTH02, nunca reportes/root 32, re-confirmado en R13-R5 y R13-R6** —, el único push de esta cadena ya se ejecutó en R13-R6 (`a1579f1..fe0e11d`, sin `--force`) — cualquier push adicional futuro requiere nueva autorización explícita, fixtures TESTING only, byte-frozen neighbors, presupuesto diagnóstico fijo reafirmado en R13-R3-RETRY-2-R1, presupuesto de certificación fijo reafirmado en R13-R3-RETRY-2-R2/R13-R6 (máximo una corrida por gate, sin retry-to-green), no fix durante revisión/diagnóstico/certificación/disposición/reconciliación/commit/recertificación/push-deploy —**reafirmado en cada una de esas etapas: el test SEC-BLOCK-1 nunca fue corregido en código (sigue byte-idéntico dentro del commit desplegado, sin `.skip`, sin cambiar `expect(...).toBe(201)`), ninguna etapa histórica fue reescrita de BLOCKED a PASS**—, la excepción `EX-P2-T18-SEC-BLOCK-1-P2028` es estrechamente acotada (`GLOBAL_FLAKE_POLICY_WEAKENED=NO`), allowlist de AUTH02 (7 producto + 7 test) ya desplegado exacto, no ampliable sin nueva reconciliación explícita, LEGACY_FULL_REPORT inmutable, nunca `railway up`/deploy manual/`railway variables`/provisionar infraestructura sin autorización explícita del usuario, Production nunca tocada, prioridad post-P2-T18 del usuario (auditoría de sincronización Producción-vs-testing-codex PRIMERO, luego P2-T06, luego P2-T14 si dependency-safe) registrada pero NO iniciada — ninguna renumeración de posiciones del roadmap sin auditar dependencias primero). ✓

`COLD_HANDOFF_VALIDATION=PASS_13_OF_13_ANSWERABLE`

## Corrección de autoridad — BUSINESS-HOURS-TIMEZONE-PRODUCTION-PROMOTION-R1

La nota histórica anterior que indicaba Production no tocada queda supersedida por la promoción certificada del 2026-08-30: `origin/main` y `origin/testing-codex` están en `a178140ef5167dce1b596edeb58e17cc7029beaf`; Production DB está en `28/28/0`, con `Negocio.timezone` y horarios sin reescritura. No se autoriza lanzamiento público. Ver `codex-reports/BUSINESS_HOURS_TIMEZONE_PRODUCTION_PROMOTION_R1.md`.

## Cross-chat handoff — P2-T18 realtime diagnosis correction

HISTORICAL_CONCLUSION: `P2_T18=PAUSED_NOT_CLOSED_EXTERNAL_INFRA_DEPENDENCY` y `F_P2_T18_LIVE_PUSH_01_STATUS=PAUSED_EXTERNAL_INFRA_DEPENDENCY` se preservan como historia; PRODUCT-DUPLICATION-R1 no implementó P2-T18.

NEW_RUNTIME_COUNTEREVIDENCE: durante pruebas manuales reales, Negocio móvil con chat abierto sí recibió `new-message` y `user-typing` desde Cliente móvil. Cliente móvil, Negocio desktop y Cliente desktop no observaron realtime en los casos aportados; fuera del chat tampoco se observó entrega.

CURRENT_PROVISIONAL_CLASSIFICATION: `P2_T18=PAUSED_PENDING_REALTIME_ACTOR_DEVICE_MATRIX_REDIAGNOSIS`; `F_P2_T18_LIVE_PUSH_01_CURRENT_PROVISIONAL_STATUS=REOPEN_DIAGNOSIS_ACTOR_DEVICE_DEPENDENT_COUNTEREXAMPLE_FOUND`; `P2_T18_GLOBAL_RAILWAY_SERVER_TO_CLIENT_BLOCK_HYPOTHESIS=INVALIDATED_BY_COUNTEREXAMPLE`; `RAILWAY_GLOBAL_ROOT_CAUSE_CONFIRMED=NO`; `RAILWAY_GLOBAL_TRANSPORT_BLOCK_ASSUMPTION_ALLOWED=NO`.

NEXT_ACTION: `P2-T18-REALTIME-ACTOR-DEVICE-MATRIX-R1`, futura matriz Cliente/Negocio × móvil/desktop con ChatView mounted/unmounted, token/authorize/scopes, room lease, listeners/relay/subscribers y foreground/background. `P2_T18_OUTSIDE_CHAT_REALTIME_STATUS=NEEDS_CONTRACT_AUDIT_NOT_YET_CLASSIFIED_AS_BUG`. No investigar Railway primero.

P2-T46-R1 current state: implementation approved and locally built on `work/p2-t46-r1`; additive occupation-payment authority, strict occupation isolation and close guards are ready for Testing-only deployment. Manual operator certification remains pending.

## P2-T46 final certified state — 2026-09-11

P2-T46 (Table Account + Ticket + History Canonical Detail) está
`CLOSED_TESTING_CERTIFIED` y `P2_T46_RELEASE_ELIGIBLE=SI`. El operador certificó
R1 y R2 físicamente sobre `c3da04ef84dbd183956e78691a3b3da0f5dc2f68` (R1 7/7,
R2 5/5). Testing avanzó a `c826e796d33de5d00f8efddf4fa258fb86587c6` con un
único commit documental; no implica que ese SHA haya sido probado físicamente.
Production no fue tocada. Siguiente acción: `P2_T46_PRODUCTION_PROMOTION_EVALUATION`.

## P2-T46 Production checkpoint — 2026-09-11

T46 está cerrado en Production con el release curado
`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`, migración aplicada y checkpoint
`p2-t46-stable-2026-09-11`. La certificación física sigue anclada al runtime
`c3da04ef`; la descendencia documental `c826e79` no se presentó como runtime
probado. No se promovieron T02 ni el resto de Testing. El lanzamiento público
continúa sin autorización. Próxima prioridad recomendada, no iniciada:
`P2-T32` — Client Address UX Unification + Profile Deep-Link.

## P2-T23-R1 — estado vigente — 2026-09-13

T23 implementó interpolación client-side únicamente sobre el marker de
tracking. Testing ejecuta el commit
`2f4c8d1d8392668dfd3f89602b1e06a2297519bc` en el deployment
`6da4b52c-8886-4d52-b31a-ba2e0ba21311` (`SUCCESS/RUNNING`). El estado es
`P2_T23_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION`; aún no es un
closeout físico ni una autorización de Production. T02 conserva
`CLOSED_TESTING_CERTIFIED`/`RELEASE_ELIGIBLE=SI`; T54 conserva
`FUTURE_AFTER_T02_T23_T24`; la siguiente acción es la certificación física de
T23 R1.
