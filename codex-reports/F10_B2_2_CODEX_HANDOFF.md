# DeliGO — continuidad Codex y preparación F10-B2.2 (diagnóstico previo, supersedido)

Estado vigente: consultar la sección `ACTUALIZACIÓN VIGENTE — F10-B2.2-A local` más abajo. El material anterior conserva el preflight de la transición y ahora es histórico.

Fecha de auditoría: 2026-10-09 (America/Buenos_Aires)
Alcance: transición documental y diagnóstico read-only. No se implementó F10-B2.2.

## Estado del repositorio

| Campo | Resultado |
|---|---|
| Ruta | `C:\Leo Campos\Trabajo\deligo-main-limpio` |
| Rama actual | `work/f10-b2-1-physical-cash-registers-shifts` |
| HEAD local | `8da7d2552c602598d150bb188cc8e693361f73a9` — `docs: record F10-B2.1 cash registers and shifts` |
| `origin/testing-codex` | `8da7d2552c602598d150bb188cc8e693361f73a9` (consultado con `git ls-remote`) |
| `origin/main` | `42ca5005d2ecd412de87e454b52820f38aaec5c0`; sin cambios hechos aquí |
| `origin/work/f10-b2-1-physical-cash-registers-shifts` | mismo HEAD `8da7d2552c602598d150bb188cc8e693361f73a9` |
| Estado previo | cero cambios tracked/staged; 327 entradas sin seguimiento según `git status --porcelain`, preservadas sin limpiar ni incorporar |
| Rama de trabajo | es `work/...`, no `testing-codex`; la rama local `testing-codex` y los refs remotos sí apuntan al mismo commit de integración |
| Procesos | no se listó otro hilo activo de Codex en este repo. Hay procesos `claude.exe`/Claude Code; la inspección de procesos no confirmó si alguno utiliza este checkout. Riesgo de edición concurrente no descartado |

La cantidad de archivos sin seguimiento vuelve inseguro cualquier `git add .` o commit general. Entre los nombres listados está `32`, que las instrucciones del proyecto declaran absolutamente intocable. No se examinó ni se modificó. El estado reportado es el del preflight; revisar antes de continuar porque otras sesiones podrían cambiarlo.

## Contexto técnico recuperado

Se consultaron `CODEX_REPORT.md`, `DELIGO_FULL_CONTEXT_LATEST.md`, el bloque F10 de `codex-reports/ROADMAP.md`, los informes F10-A, B0, B1, B2.0 y B2.1, y el schema, servicio de ventas, servicio/admin de turnos y rutas actuales relacionadas. Los informes F10 especializados fueron leídos para esta continuidad; los handoffs históricos principales son extensos y se inspeccionaron sus encabezados, estado corriente y secciones F10 pertinentes, no cada bloque histórico ajeno a F10.

| Área | Estado registrado por las fuentes del proyecto |
|---|---|
| F9 | `CLOSED_TESTING_CERTIFIED`; reutilizable, no romper |
| R3A | `CLOSED_TESTING_CERTIFIED_WITH_DOCUMENTED_LIMITATIONS`; reservas en modo ON según los handoffs. Caja debe conservar sus rechazos atómicos |
| F10-A | Diseño/auditoría terminados. D6 dice que la caja es del negocio, el dueño también opera y se identifica autoría |
| F10-B0 | Motor único `registrarVentaCaja`, precio/stock del servidor, clave idempotente/huella, cobro y libro de efectivo. Transferencia queda declarada, no conciliada |
| F10-B1 | `CLOSED_TESTING_CERTIFIED`, empleo con sesión personal Operaciones y área `caja`; iPhone PWA 9/9 reportado por operador. No equivale a certificación de otros dispositivos ni Production |
| F10-B2.0 | `IMPLEMENTED_TESTING`; Decimal `NUMERIC(12,2)`, doble escritura/backfill y protecciones documentadas. No retirar Float anterior |
| F10-B2.1 | `IMPLEMENTED_TESTING`; `CajaFisica`, `TurnoCaja`, apertura idempotente, cuenta de efectivo por caja, asociación actual a turno del propio actor, expected sólo dueño. API/motor presentes, interfaz completa y cierre ausentes |
| F10-B2.2 | `NOT_STARTED`; en esta tarea no se cambió código, schema, migraciones, endpoints, UI, datos o despliegue |

Según el informe B2.1, la migración `20261011120000_f10_b2_1_cash_registers_shifts` ya se había aplicado en TESTING, aditiva y con checksum coincidente; no se volvió a consultar la base. Sus pruebas informadas fueron 52/0 (22 real-DB). No se repitieron pruebas. La opción de obligatoriedad sigue `OPCIONAL` y no existe cierre recuperable. La suite B2.1 indicó 35 errores TypeScript iguales al baseline y una regresión intermitente preexistente en cancelación de pedidos de mesa; son contexto heredado, no mediciones de esta tarea.

### Implementación actual observada en código

- `TurnoCaja` tiene un responsable `NEGOCIO|EMPLEADO`, `responsableId`, `empleadoId?`, caja, estado `ABIERTO`, fondo inicial Decimal y clave/huella de apertura. La migración mantiene índice parcial para un único turno abierto por caja, además de límites por actor.
- `CajaFisica` pertenece al `negocioId`; turno ↔ caja conserva FK compuesta de tenant.
- `Venta.turnoCajaId` y `OperacionFinanciera.turnoCajaId` ya son nullable; la venta también conserva `actorTipo`, `actorId` y `empleadoId`. Esos campos separan autor de turno aunque el servicio actual los acople al autor/responsable.
- `registrarVentaCaja` acepta un `turnoCajaId` ya resuelto, revalida en transacción Serializable que está abierto, coincide con negocio/caja y que `responsableTipo/responsableId` coinciden con el actor. El cuerpo no selecciona identidad ni turno.
- La ruta del dueño obtiene sólo `turnoAbiertoDeActor(... NEGOCIO)`. La ruta del cajero resuelve su propio turno desde la sesión personal. El libro utiliza la cuenta de la caja del turno; sin turno se conserva `efectivo_caja_sin_asignar` mientras el modo es opcional.
- `calcularEfectivoEsperadoTurno` calcula fondo inicial más patas exactas del turno en la cuenta de su caja. El admin del dueño es su única superficie actual; pruebas estáticas de B2.1 impiden que interfaces/rutas del cajero importen ese módulo o entreguen `esperado`.

## Decisión #17: resuelta

`DECISION_17_SHARED_CASH_REGISTER=APPROVED` (operador, 2026-10-09): la caja física pertenece al negocio y el dueño la administra. El dueño y empleado autorizado pueden operar el mismo turno. Hay un responsable operativo del turno; el dueño no abre un segundo turno en esa caja. El dueño vende desde el panel del negocio y su operación se atribuye a la caja/turno compartido con autor `NEGOCIO`. La venta del empleado conserva autor `EMPLEADO` de su sesión. Ambas ventas de efectivo forman parte del efectivo esperado. Con varias cajas, la selección física del dueño es explícita. El cajero nunca ve el esperado ni diferencias; el dueño conserva acceso administrativo.

Esto sustituye las alternativas A/B/C que F10-B2.1 §11 había dejado pendientes y la cuestión asociada de si el dueño debía abrir su propio turno bajo `OBLIGATORIO`. Se conservaron marcadas como historia reemplazada en los documentos, no como opciones activas. La decisión de producto no autoriza todavía implementación.

### Diseño de adaptación previo a implementar

1. **Separar responsabilidad y participación.** Mantener el responsable único e inmutable del turno. Añadir una relación aditiva de participantes (preferencia: tabla `TurnoCajaParticipante` para empleados) con negocio, turno, empleado, actor/fecha de autorización, estado/revocación y unicidad por empleado y turno. Sólo propietario del negocio agrega o revoca; servidor exige empleado activo, del mismo negocio y con área `caja`. El negocio participa por sesión administrativa y no necesita fila de empleado ni turno propio.
2. **Selección explícita del dueño.** Si hay varias cajas, la UI requiere elegir una identificada por nombre/id; no asumir caja predeterminada para atribuir dinero. La petición manda `cajaFisicaId`, nunca `turnoCajaId`. Servidor deriva negocio del token, valida caja tenant/activa y resuelve el turno abierto único en ella. Si la caja elegida no tiene turno y `OPCIONAL`, la decisión de producto deja sin definir si registrar sin turno o pedir turno/selección distinta; resolverlo antes del código. Nunca enviar la venta a otra caja por defecto.
3. **Preservar actor vs turno.** En venta dueño usar `actorTipo=NEGOCIO`, `actorId=negocioId`, aunque `turnoCajaId` apunte al turno cuyo responsable es empleado. En venta empleado usar `actorTipo=EMPLEADO`, `actorId=empleadoId` y el `empleadoId` autenticado. Venta y operación financiera apuntan al mismo turno; el cash leg va a la cuenta de la caja de ese turno.
4. **Idempotencia.** La huella debe incluir actor, líneas/medio y la caja física/turno resuelto. La misma clave para otra caja o turno devuelve conflicto; no replay. Replay sólo al mismo actor según las garantías actuales.
5. **Transacciones.** Validar pertenencia/participación, estado abierto, caja, negocio y modo dentro de la misma transacción serializable que escribe venta/cobro/libro/inventario. Definir lock/CAS de cierre y revocación contra ventas concurrentes; resultado atómico. Conservar el índice parcial de turno abierto por caja y las restricciones de tenant.
6. **Privacidad.** Cualquier respuesta del cajero, incluida carga, replay, error de cierre, listados o metadatos, excluye esperado, diferencia, acumulados financieros, otros turnos y saldos. Contar/anotar en ciego sin filtrar el esperado por el servidor. El panel del dueño mantiene vista administrativa.
7. **Auditoría y UX.** Historial debe poder mostrar en la misma caja responsable del turno, participantes autorizados y autor de cada operación. Alta/revocación auditadas. El dueño selecciona caja explícitamente; cajero sólo ve caja/turno al que está autorizado.

## F10-B2.2: secuencia propuesta

La siguiente secuencia mantiene los cambios pequeños. No activa `OBLIGATORIO` hasta completar todas las transiciones monetarias, recuperación y gates.

| Bloque | Alcance y salida segura |
|---|---|
| A — atribución compartida | Schema aditivo participantes + eventos auditables, resolución de permisos/actor, motor, fingerprint por caja/turno. Validar tenant, revocación, autoría dual, idempotencia, R3A, ventas y turno único. Sin UI/activación |
| B — cajas/turnos en UX | Panel dueño enumera cajas y turno/responsable; dueño elige caja y administra participantes; cajero ve sólo su turno/permisos, nunca montos protegidos. Mantener OPCIONAL |
| C — declaración ciega | Definir estados/timestamps, CAS e idempotencia. Responsable declara efectivo contado sin esperado ni diferencia. La aceptación de venta se congela al comenzar/confirmar el cierre con serialización venta-cierre; no borrar/reabrir silenciosamente |
| D — revisión administrativa | Guardar declaración original inmutable; esperado exacto y diferencia sólo para dueño; correcciones/observaciones como eventos compensatorios con actor, hora y motivo |
| E — cierre y destino del dinero | Normal: distinguir efectivo contado, diferencia (`contado − esperado`), importe entregado a dueño/resguardo y fondo remanente. Invariante provisional: contado = entregado + remanente. Un gasto/retiro requiere movimiento separado; ni entrega ni remanente son venta/ingreso |
| F — traspaso | Enlazar turno origen/destino y ambos lados del movimiento atómicamente, con idempotencia; remanente inicial del siguiente turno no vuelve a sumarse al saldo de la caja/negocio. Traspaso de turno sin dinero no inventa una transferencia |
| G — turnos abandonados | Dueño retoma o recupera con su identidad, motivo y auditoría; responsable original queda intacto. Definir venta de resultado incierto/in-flight, efectivo a contar, disponibilidad del responsable y qué transición puede forzar el dueño. Sin cierre automático por tiempo |
| H — activación gradual | Flag protegido por origen y por negocio, sólo después de A–G, autorización, revisión y plan de reversión operacional. Default OPCIONAL; no se activa en esta tarea |

No llamar a la operación «cierre completa» antes de definir suma/balance, cierre normal, diferencias, destino de efectivo, fondos remanentes, traspaso, reapertura/recuperación, idempotencia y concurrencia.

### Dinero al cierre: términos distintos

- **Efectivo esperado:** fondo inicial del turno + patas de efectivo positivas − salidas reales autorizadas. Transferencias declaradas y ventas digitales no suman efectivo.
- **Efectivo contado:** declaración ciega del responsable, sin sustituir el esperado.
- **Diferencia:** contado − esperado; sólo dueño la ve y la explica/revisa. No se ajusta automáticamente al libro ni cambia la venta.
- **Entregado:** porción contada que sale físicamente a dueño/resguardo; destino y recepción deben quedar identificados.
- **Remanente/fondo siguiente:** porción que queda en la caja y se declara como apertura siguiente, enlazada al turno origen. No registrar el mismo billete como ingreso nuevo.
- **Traspaso:** movimiento entre turnos con lados origen/destino asociados, no una suma global nueva. Un cambio de cajero por sí solo no mueve dinero.
- **Recuperación:** evento administrativo auditado para turno sin operador disponible; no muta el responsable original ni borra la declaración previa.

## Vuelto automático / vuelto en productos

`VUELTO_EN_PRODUCTOS=PLANNED_NOT_STARTED`; sin UI, endpoint, migración ni cambio de motor. La etapa de UX para calcular el vuelto en una venta de efectivo puede ser una mejora separada: monto entregado por cliente → vuelto calculado. Después, si se autoriza, registrar efectivo devuelto y valor/equivalente en productos separadamente. El efectivo retenido por caja es el que importa al efectivo esperado; los caramelos no crean ingreso en efectivo ni inventario sin una operación real. No hacer obligatoria la selección de cada dulce si el negocio no lleva inventario individual. Antes de ofrecerlo comercialmente debe revisarse consentimiento del cliente y normativa aplicable de defensa del consumidor. Lugar sugerido: una extensión posterior a F10-B2.2 de Caja dentro de F10-B, sin asignar por ahora C/D/E.

## Alcance realizado / no realizado

- Documentación actualizada: `codex-reports/ROADMAP.md`, `codex-reports/F10_B2_1_CASH_REGISTERS_SHIFTS.md`, `CODEX_REPORT.md`; este handoff agregado.
- `DELIGO_FULL_CONTEXT_LATEST.md` no fue actualizado: sigue siendo un resumen secundario previo que lista #17 como pendiente. Debe reconciliarse cuando se regularice la política documental; la inconsistencia está declarada en el handoff primario para evitar confundirlo con la decisión vigente.
- No hubo cambio de código, schema, migración, DB local/TESTING, interfaz, endpoint, datos ni Production. No se ejecutaron pruebas, `tsc`, build, lint, migrate, ni deploy.
- No se realizó commit: la documentación del repo contiene instrucciones incompatibles sobre el path primario del informe (`CODEX_REPORT.md` raíz frente a `codex-reports/CODEX_REPORT.md`, que no existe) y sobre que `DELIGO_FULL_CONTEXT_LATEST.md` debe ser untracked aunque Git lo tiene tracked; además el worktree presenta cientos de archivos untracked previos y hay procesos de Claude presentes. Las ediciones son locales y revisables.

## Riesgos y decisiones abiertas antes del código

- Comportamiento si el dueño selecciona una caja sin turno con modo `OPCIONAL`.
- Flujo preciso para seleccionar/autorizar empleados participantes, altas antes o durante turno y revocación mientras una venta está procesándose.
- Quién puede declarar cierre o recuperación si el responsable falta; cualquier toma de control del dueño debe conservar responsable original.
- Qué datos componen el recuento y qué destinos de entrega se aceptan; si el dueño confirma recepción.
- Estados, reintentos, idempotencia y reglas para cierre vs venta concurrente o intento de venta incierto.
- Restricciones tenant/FK para participantes polimórficos; evitar que un empleado de otro negocio se asocie incluso por carrera.
- Conciliación por turno cuando varios actores venden y el dueño comparte permisos; expected siempre de uso administrativo.
- En vuelto de productos, consentimiento explícito y revisión legal antes de publicación; no integrar productos a inventario sin respaldo.

## Próxima acción recomendada

Revisar este documento y autorizar un bloque acotado, empezando por contrato/esquema/servicio B2.2-A. Antes de cualquier modificación, confirmar que Claude ya no escribe este checkout y resolver la discrepancia de instrucciones/documentación; las pruebas con datos reales, cambios a TESTING y despliegue requieren autorización propia.
# ACTUALIZACIÓN VIGENTE — F10-B2.2-A TESTING verificado (2026-10-09)

Esta actualización supersede los estados históricos que siguen debajo. Los cambios locales están en `work/f10-b2-1-physical-cash-registers-shifts`, sobre base `8da7d2552c602598d150bb188cc8e693361f73a9`; los gates pasan y queda pendiente el commit/push a `testing-codex`, que activa el deploy de Railway TESTING. `origin/main` sigue en `42ca5005d2ecd412de87e454b52820f38aaec5c0`.

## Marcadores actuales

```text
RESULT=TESTING_GATES_PASS_DEPLOY_PENDING
PREFLIGHT_STATUS=PASS_WITH_PRESERVED_UNTRACKED_ARTIFACTS_AND_NO_CONCURRENT_SOURCE_WRITES_OBSERVED
DOCUMENTATION_CONFLICTS=ROOT_CODEX_REPORT_IS_GIT_TRACKED_MASTER; CODEX_REPORT_IN_codex-reports_ABSENT; FULL_CONTEXT_IS_TRACKED_DESPITE_SKILL_POLICY; NO_DUPLICATE_OR_TRACKING_CHANGE
DOCUMENTATION_COMMIT=PENDING_SCOPED_COMMIT
DECISION_17=APPROVED_EMPLOYEE_STARTS_SHIFT_OWNER_SHARES_ACTIVE_REGISTER
F10_B2_2_A_STATUS=REAL_DB_TESTED_TESTING_DEPLOY_PENDING
EMPLOYEE_OPENS_SHIFT=YES_PERSONAL_SESSION_NO_EXTRA_INVITATION
OWNER_SEES_ACTIVE_SHIFT_API=GET_/api/negocio/caja/turnos_AND_/cajas
OWNER_USES_EMPLOYEE_SHIFT=YES_OWNER_SESSION_IMPLICIT
OWNER_AUTO_REGISTER_RESOLUTION=ONE_OPEN_SHIFT_AUTOMATIC; ZERO_OPEN_PRESERVES_OPCIONAL_UNASSIGNED; SELECTED_BOX_WITHOUT_OPEN_SHIFT_409
MULTIPLE_REGISTER_SELECTION=REQUIRED_CAJA_SELECCION_REQUERIDA
OWNER_SALES_ATTRIBUTION=NEGOCIO
EMPLOYEE_SALES_ATTRIBUTION=EMPLEADO
SHARED_EXPECTED_CASH=EXACT_DECIMAL_CASH_LEGS_FROM_BOTH_ACTORS; TRANSFER_EXCLUDED
EMPLOYEE_ADDITIONAL_PERMISSIONS=NO_PARTICIPANT_SCHEMA; OTHER_EMPLOYEE_REMAINS_UNAUTHORIZED
IDEMPOTENCY_AFTER_SHIFT_CHANGE=REPLAY_BEFORE_LIVE_RESOLUTION; PRESERVE_ORIGINAL_TURNO; EXPLICIT_BOX_PART_OF_FINGERPRINT
CONCURRENT_SALES=SERIALIZABLE; REGISTER_ROW_LOCKS; REAL_DB_TESTS_PASS
TENANT_ISOLATION=SERVER_SCOPED_REGISTER_LOOKUP; CROSS_TENANT_SELECTION_404
EXPECTED_CASH_OWNER_ONLY=YES
SHIFT_ENFORCEMENT_MODE=OPCIONAL
NEW_TESTS=FINGERPRINT_SELECTION_UNIT_AND_SHARED_SHIFT_INTEGRATION_CASES_WRITTEN
REGRESSION_TESTS=255_PASS_0_FAIL (1871_ASSERTIONS; F9_R3A_F10_B0_B1_B2)
REAL_DB_TESTS=23_PASS_0_FAIL (218_ASSERTIONS; EXACT_FIXTURE_CLEANUP_CONFIRMED)
TYPESCRIPT_NEW_ERRORS=0 (35_BASELINE_DIAGNOSTICS)
BUILD=PASS (162_PAGES)
ESLINT=PASS (CHANGED_TYPESCRIPT_FILES)
PRISMA_VALIDATE=PASS
F10_B2_2_B_STATUS=NOT_STARTED
VUELTO_EN_PRODUCTOS=PLANNED_NOT_STARTED
CONSUMO_INTERNO=PLANNED_NOT_STARTED
SCHEMA_CHANGED=NO
NEW_MIGRATIONS=0
MIGRATION_CHECKSUM_MATCH=NOT_APPLICABLE
TESTING_DB_IDENTITY=railway/postgres; SHA256(system_identifier)[0:12]=d64be28f676e; TESTING_CONFIRMED
TESTING_MIGRATIONS=F10_B0_F10_B2_0_F10_B2_1_PRESENT_AND_FINISHED; PRISMA_41_APPLIED_UP_TO_DATE
TESTING_DB_AUTH=PASS_NO_P1000
TESTING_DEPLOY_ID=PENDING_AUTODEPLOY_ON_PUSH
TESTING_DEPLOY_STATUS=PENDING
TESTING_DEPLOY_COMMIT_MATCH=TO_BE_VERIFIED_AFTER_PUSH
PRODUCTION_TOUCHED=NO
KNOWN_LIMITATIONS=NO_UI; NO_PARTICIPANT_SCHEMA; EXTRA_EMPLOYEES_NOT_AUTHORIZED; F10_B2_2_B_NOT_STARTED
NEXT_ACTION=CREATE_SCOPED_COMMITS_PUSH_TESTING_CODEX_AND_VERIFY_RAILWAY_TESTING_DEPLOY_AND_POST_DEPLOY_SMOKE
```

## Evidencia actual de esta continuación

- Credential check: process value matches project `.env` and Codex `.env` by
  SHA-256; process environment takes precedence over dotenv, and no secret was
  printed. PostgreSQL connected read-only (`transaction_read_only=on`):
  `current_database()=railway`, role `postgres`, cluster fingerprint
  `d64be28f676e`; F10-B0/B2.0/B2.1 migrations are finished and Prisma reports
  41 applied with schema up to date.
- F10-B2.2-A real PostgreSQL integration: 23/23, 218 assertions. This includes
  employee opening, shared owner sales, separate authorship, cash vs transfer,
  automatic/explicit register selection, replay and original shift preservation,
  concurrent sales, tenant isolation, R3A reservation behavior and expected-cash
  privacy. Read-only post-test audit found zero `test-f10b21-*`, `test-f10b0-*`
  businesses and zero matching operational accounts.
- Relevant regressions: 255/255, 1,871 assertions, including F9, R3A and
  F10-B0/B1/B2. TypeScript: 35 baseline diagnostics, zero in changed files.
  Prisma validate, changed-file ESLint, build (162/162 pages) and `git diff
  --check` pass. No schema change or migration was added.
- Railway CLI read-only state: project `amiable-rejoicing`, environment
  `TESTING`, service `DeliGO Copy`, repo `LeoCampos2504/DeliGO`, branch
  `testing-codex`; Production DeliGO follows `main` at
  `42ca5005d2ecd412de87e454b52820f38aaec5c0`. Push-triggered Testing deployment
  and post-deploy smoke remain pending.

## Evidencia histórica del intento anterior, antes de actualizar credenciales

- Bun unit/static regressions: 159 passed, 0 failed across 10 files; fake R3A
  API regression: 15/0. Static F10 contracts: 51/0 (also included in the
  159-run). Next production build succeeded, generated 162 pages, ESLint passed
  on touched TypeScript files, Prisma validate passed.
- TypeScript returned 35 diagnostics, the same documented B2.1 baseline; zero
  diagnostics refer to files changed for A.
- Attempted the PostgreSQL integration suite using the endpoint provided in
  `DELIGO_TEST_DATABASE_URL`; the server returned invalid-credentials/P1000 at
  initial fixture creation. The connection could not verify `current_database`
  and no test fixture or migration was written. The Railway connector available
  in this session showed only an unrelated project; local Railway CLI reported
  no linked environment. Do not substitute another database or deploy until a
  valid TESTING credential is supplied through the established project channel.
- `git diff --check` passed. Final status: 11 tracked files modified, this
  existing handoff remains untracked, zero staged files; local HEAD and
  `origin/testing-codex` remain `8da7d2552c602598d150bb188cc8e693361f73a9`,
  and `origin/main` remains `42ca5005d2ecd412de87e454b52820f38aaec5c0`.
  Claude PID 24544 remains alive with its transcript last written at
  `2026-10-09T18:15:12-03:00`; no outside edits were observed during this run.

## Implementation surface

- `src/lib/caja-venta-service.ts`: shared engine now resolves owner shift after
  exact-key replay; employee responsible person remains checked; lock order is
  register then open-turn read, preparing sale vs future-close serialization.
- `src/app/api/negocio/caja/ventas/route.ts`: owner may select physical
  `cajaFisicaId`; session remains sole source of owner identity.
- `src/app/api/negocio/caja/turnos/route.ts`: all active shifts are listed,
  plus up to 50 closed recent shifts.
- `src/lib/f10-b2-1-turnos.integration.test.ts`: shared attribution, cash,
  active-shift API, automatic/explicit selection, tenant/closed-register
  rejection, changed-register key conflict, replay after reopen, and concurrent
  owner/employee attempt were executed against real TESTING PostgreSQL; all 23
  tests passed in the credential-refresh continuation above.
- `src/lib/f10-b2-1-static-contract.test.ts`,
  `src/lib/f10-b0-static-contract.test.ts`,
  `src/app/api/negocio/caja/ventas/route.reservations.test.ts`,
  `src/lib/caja-venta-f10b0.test.ts`: contracts updated for B2.2-A, mocked R3A
  route adapted to transaction-side register resolution, selected-box
  fingerprint coverage added.

## Document routing discrepancy

Git confirms root `CODEX_REPORT.md` is tracked; `codex-reports/CODEX_REPORT.md`
does not exist. Repository-local skill text designates the latter as primary.
The previous handoff in this file also records conflicting tracking advice for
`DELIGO_FULL_CONTEXT_LATEST.md`, which Git already tracks. No duplicate report
was created and neither path tracking nor the secondary file was changed. The
root master handoff, F10 B2.1 report, roadmap, and this existing handoff were
updated locally. The `32` path and unrelated untracked files were not read,
staged, or changed.

# DeliGO — continuidad Codex y preparación F10-B2.2
