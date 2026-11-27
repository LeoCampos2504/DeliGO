## DeliGO Skill Routing

- For any substantial DeliGO repository task, invoke `deligo-safe-task`
  before making changes or drawing conclusions from project state.

- Before declaring any substantial task complete, blocked, paused,
  certified, or ready for handoff, invoke `deligo-closeout`.

- Invoke `deligo-testing-deploy` only when the CURRENT operator task
  explicitly authorizes the relevant commit/push/TESTING-deploy
  operations. Never infer deployment authorization from passing tests,
  a recommendation, or apparent readiness.

- Skills contain procedures; authority/context docs
  (`codex-reports/CODEX_REPORT.md`, `DELIGO_FULL_CONTEXT_LATEST.md`,
  and the rest of `codex-reports/`) contain live state. Always obtain
  changing state (hashes, deployment IDs, current task, test counts)
  from Git and authority docs, never from a skill.

## Secret access guardrails (2026-10-10)

SECRET_READ_POLICY=DENY_BY_DEFAULT
PRODUCTION_SECRET_ACCESS=OPERATOR_ONLY
PRODUCTION_CONNECTORS=DISABLED_IN_NORMAL_DEV_SESSIONS
SECRET_VALUES_IN_TOOL_OUTPUT=PROHIBITED
SENSITIVE_TOOL_CALLS_REQUIRE_TECHNICAL_GUARDRAILS=YES
GUARDRAIL_FAILURE=BLOCK
SECRET_EXPOSURE_INCIDENT=STOP_AND_REPORT

Never read or print live credential values, `.env` contents, complete Railway variables/configuration, process-environment dumps, or connector auth/config payloads. Use names and metadata only. Normal development must run without Production secrets and without Production-capable connectors. A session needing exceptional Production administration must be separate, operator-controlled, and limited to one authorized action. If a guardrail is absent, incompatible, errors, or cannot be confirmed, block the sensitive operation. These controls are defense in depth, not a guarantee against arbitrary code or a compromised host.

## Metodología obligatoria T7 (operador, VIGENTE desde 2026-11-27) — `DEVELOPMENT_WORKFLOW.md`

Leer `DEVELOPMENT_WORKFLOW.md` (raíz) antes de planificar cualquier tarea. Ciclo: DEFINICIÓN → DESARROLLO → CI →
TESTING → CERTIFICACIÓN MANUAL FOCALIZADA → PRODUCTION → VERIFICACIÓN TÉCNICA → CIERRE. Una funcionalidad a la vez y
una única rama funcional activa; `main` y `testing-codex` alineadas al empezar y al cerrar; Production recibe por
fast-forward, sin force, exactamente el SHA certificado en TESTING; no se repite en Production la certificación manual;
se mantienen todas las pruebas y contratos de seguridad; controles extra sólo según riesgo; bases independientes;
nada experimental en Production sin certificación y autorización. Estado de las protecciones técnicas (ruleset de
GitHub, CI sobre `codex/**`, «Wait for CI»): ver el archivo — distinguir lo activo de lo pendiente. Las metodologías
del 2026-11-24 y del 2026-11-19 (sección siguiente) quedan como antecedente; sus principios siguen dentro del ciclo.

## Metodología de trabajo vigente (operador, 2026-11-19)

Reemplaza la metodología anterior de baterías automatizadas como condición para avanzar. No reescribe ni invalida
las certificaciones ya registradas en `codex-reports/` (siguen siendo historial válido).

- Prioridad: avanzar con las funcionalidades y comprobarlas con revisión manual del operador y de Claude, con evidencia
  del sistema.
- No crear suites automatizadas nuevas por defecto; no correr baterías grandes de regresión ni repetir cientos de
  pruebas tras cada cambio; las pruebas unitarias / contratos / integración no son condición habitual para seguir.
- Conservar todas las pruebas existentes: no eliminarlas ni debilitar protecciones.
- Al implementar: revisión técnica breve y dejarlo disponible para probar en navegador. Claude recorre los flujos
  principales que pueda con datos ficticios en un entorno autorizado; el operador prueba como usuario siguiendo
  instrucciones exactas.
- Tras cada prueba, Claude revisa la evidencia: respuestas HTTP, logs, PostgreSQL, movimientos financieros, stock,
  auditorías y registros relacionados, con consultas preferentemente de SOLO LECTURA.
- Corregir lo observado y continuar, sin lanzar automáticamente una batería completa. Si un cambio crítico de dinero o
  stock necesita una comprobación especial, explicarla brevemente y hacer una verificación focalizada.
- Seguridad que se mantiene: sin cambios en Production ni en Railway TESTING sin autorización de esa etapa; nunca
  reset / seed / borrado de datos históricos en bases persistentes; respaldo antes de migraciones sobre bases
  persistentes; idempotencia, transacciones, permisos, auditoría y autoridad única de stock (R3A); no repetir una
  operación financiera fallida sin comprobar antes qué quedó registrado; no declarar «probado» lo que sólo se revisó en
  código; no quitar mecanismos de seguridad para acelerar.
- Informes cortos: qué se implementó · qué pudo ver/probar Claude · qué verificó el operador y con qué evidencia · qué
  falta comprobar manualmente · problemas detectados · próximo paso (con URL y acciones exactas para el operador).
