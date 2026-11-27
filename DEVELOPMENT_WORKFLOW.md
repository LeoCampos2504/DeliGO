# DeliGO — metodología obligatoria de desarrollo (T7)

**VIGENTE desde el 2026-11-27** (activación formal del operador, «T7 — Activación definitiva de la metodología de
desarrollo incremental»). Versión estable de partida: `697dfd7e6516f22e98597ab07021f30b23e6849a` = Production =
TESTING, etiqueta `prod-2026-11-27-697dfd7e`.

Reemplaza el flujo del 2026-11-24 y la metodología del 2026-11-19, que quedan como antecedente (ver al final): sus
principios —pruebas funcionales sólo en TESTING, una tarea por vez, límite de unos tres intentos, seguridad proporcional,
documentos de continuidad— siguen vigentes dentro de este ciclo. Las certificaciones registradas en `codex-reports/`
siguen siendo historial válido. Propuesta original y su razonamiento: `codex-reports/T7_METODOLOGIA_PROPUESTA.md`.

**Objetivo:** que nunca más se acumulen cientos de commits sin publicar y haga falta otra estabilización masiva como
T0–T6.

## El ciclo

```
DEFINICIÓN → DESARROLLO → CI → TESTING → CERTIFICACIÓN MANUAL FOCALIZADA → PRODUCTION → VERIFICACIÓN TÉCNICA → CIERRE
```

| Etapa | Responsable | Qué se hace | Termina cuando |
|---|---|---|---|
| Definición | operador (+ ChatGPT) | una funcionalidad o corrección: alcance, riesgo (bajo/medio/alto) y criterio de aceptación | el operador autoriza el alcance |
| Desarrollo | Claude | rama `codex/<funcionalidad>` desde `main` (= `testing-codex`); código + pruebas de la lógica tocada; informe breve | ChatGPT revisa diseño e invariantes |
| CI | GitHub Actions | push de la rama; job `validate` completo (typecheck, pruebas, build, migraciones sobre PostgreSQL efímero) | `validate` verde sobre el SHA exacto |
| TESTING | Claude | fast-forward de `testing-codex` a ese SHA; Railway TESTING despliega; respaldo previo de TESTING sólo si hay migraciones | despliegue SUCCESS con el SHA exacto |
| Certificación manual focalizada | operador (+ Claude con datos ficticios) | sólo los flujos tocados y sus vecinos directos, con instrucciones exactas; Claude revisa la evidencia (HTTP, logs, base de solo lectura) | el operador aprueba |
| Production | Claude | fast-forward de `main` al MISMO SHA certificado; respaldo + ensayo aislado de migraciones sólo si el riesgo es alto | despliegue SUCCESS con el SHA exacto |
| Verificación técnica | Claude (+ operador si hay migraciones) | SHA, log del pre-deploy, arranque, smoke HTTP, 5xx, crons y chat; verificador de solo lectura del operador si hubo migraciones; proporcional al cambio | sin incidencias |
| Cierre | Claude | documentos de continuidad, etiqueta `prod-AAAA-MM-DD-<sha8>`, rama de la funcionalidad cerrada | `main` = `testing-codex` |

Autorizaciones: el alcance aprobado por el operador cubre todo lo que está dentro de él (desarrollo, pruebas, push de
la rama de desarrollo, CI). Se piden por separado sólo el despliegue en TESTING y el despliegue en Production, salvo que
el operador los incluya expresamente en el alcance. No se piden autorizaciones redundantes.

Errores en TESTING: causa real → corrección puntual → revisión → nuevo SHA → CI → TESTING → repetir sólo lo afectado.
Después de unos **tres intentos fallidos**, detenerse y evaluar abandonar; si se reinicia, partir limpio desde `main`,
conservar los intentos en Git, evaluar por separado migraciones y datos de TESTING, sin restaurar bases ni borrar datos
ni force push sin autorización.

## Reglas obligatorias

1. **Una funcionalidad a la vez**, con **una única rama activa de desarrollo funcional**.
2. **No acumular** funcionalidades pendientes de publicación: `testing-codex` nunca está más de una funcionalidad por
   delante de `main`. Si algo certificado no puede ir a Production, el operador decide publicarlo, revertirlo en
   `testing-codex` o dejarlo en su rama; nunca se apila otra funcionalidad encima.
3. **No comenzar otra funcionalidad hasta cerrar la anterior** (o descartarla formalmente).
4. **`main` y `testing-codex` alineadas** al comenzar y al finalizar cada ciclo. Comprobación previa obligatoria:
   `git ls-remote origin main testing-codex` (mismo SHA) y ninguna otra rama funcional abierta.
5. **Production recibe exactamente el SHA certificado en TESTING**, por **fast-forward normal, sin force**. Prohibidos
   al publicar: commits directos en `main`, merges, rebases, squash, cherry-picks, pull requests o merge commits que
   cambien el SHA certificado.
6. **No se repite en Production** la certificación manual completa de TESTING; la verificación en Production es
   principalmente **técnica y proporcional al cambio**.
7. **Se mantienen todas las pruebas automatizadas y los contratos de seguridad existentes**: nunca se eliminan,
   debilitan, saltan ni relajan para obtener verde (se actualizan sólo cuando el operador cambia el comportamiento, y
   se dice). No se debilita ningún job, paso, guarda de entorno ni requisito del CI.
8. **Controles adicionales sólo cuando el riesgo lo justifica** (financiero, seguridad, concurrencia, integridad de
   datos): ver la tabla de riesgo.
9. **Funcionalidades grandes se dividen** en entregas pequeñas, útiles y publicables por separado.
10. **Lo experimental no llega a Production** sin certificación y autorización expresa; vive en su rama (CI permitido).
11. **Bases de datos de ambos entornos completamente independientes**: nunca copiar datos, respaldos ni variables
    entre TESTING y Production; nunca reset/seed/borrado de datos persistentes; credenciales sólo en memoria del
    operador.
12. **Documentación de cierre sin despliegues extra:** los documentos de cierre del ciclo N viajan como primer commit
    de la rama del ciclo N+1 (o en una rama `codex/docs-*`); nunca se adelanta `main` ni `testing-codex` con un commit
    sólo documental mientras cualquier commit redespliegue los servicios.

## Responsabilidades

- **Operador:** define prioridades y decisiones funcionales; autoriza el alcance; hace la certificación manual
  focalizada; autoriza los despliegues.
- **Claude:** analiza, implementa y documenta; ejecuta pruebas automatizadas; prepara las certificaciones (pasos
  exactos, URL, datos ficticios); publica exclusivamente cuando está autorizado; verifica los despliegues y comunica
  incidencias con evidencia real, sin inventar verificaciones.
- **ChatGPT:** revisa diseños, decisiones e invariantes; evalúa seguridad e integridad; comprueba independientemente
  las evidencias cuando tiene acceso; revisa los informes y prepara las instrucciones del siguiente paso.

## Protección de ramas y CI

Estado al 2026-11-27 — **distinguir activo de pendiente**:

| Protección | Estado |
|---|---|
| Fast-forward del SHA exacto, sin force (regla de proceso) | **ACTIVA** (regla de esta metodología) |
| CI `validate` sobre `main`, `testing-codex` y `codex/**` | **PREPARADA** en la rama `codex/t7-metodologia` (cambio sólo del disparador; mismos 81 pasos); entra en vigor en `main`/`testing-codex` con el primer ciclo de T7 |
| Ruleset de GitHub en `main` y `testing-codex`: check obligatorio `validate` (GitHub Actions, app 15368), sin force push, sin eliminación, historia lineal, sin bypass, sin pull request obligatorio | **PENDIENTE** de activación por el operador (Claude no tiene acceso de administración a GitHub sin leer credenciales). Archivo para importar: `.github/rulesets/t7-main-testing-codex-ruleset.json` |
| Prueba previa del ruleset con fast-forward directo | **PENDIENTE**: ruleset de prueba `.github/rulesets/t7-probe-ruleset.json` sobre `codex/t7-ruleset-probe` (procedimiento abajo) |
| Railway «Wait for CI» (DeliGO Production y DeliGO Copy) | **PENDIENTE**: no se activa en Production hasta que `main` contenga el workflow con el disparador de `main`; es defensa adicional, no reemplaza la comprobación previa del SHA y su CI |
| Watch paths de Railway para que los commits documentales no redespliegan | **PENDIENTE** (propuesta T7 §3; la decide el operador) |

Procedimiento de prueba del ruleset (próxima sesión, antes de proteger `main` y `testing-codex`):

1. Operador: GitHub → Settings → Rules → Rulesets → New ruleset → Import a ruleset →
   `t7-probe-ruleset.json` → Create.
2. Claude: `git push origin 697dfd7e6516f22e98597ab07021f30b23e6849a:refs/heads/codex/t7-ruleset-probe`
   → debe **aceptarse** (SHA con `validate` aprobado; no dispara CI ni despliegues).
3. Claude: push del commit documental `90114b0c` (sin `validate`) a esa rama → debe **rechazarse**.
4. Claude: push de la punta de `codex/t7-metodologia` (con `validate` aprobado), fast-forward desde `697dfd7e` → debe
   **aceptarse**.
5. Si los tres resultados son los esperados: el operador importa `t7-main-testing-codex-ruleset.json` y desactiva el
   ruleset de prueba. Si alguno falla: no se protege `main` hasta entender por qué.

Una emergencia que exija saltar la regla obliga al operador a desactivarla a mano, de forma visible, y a registrarlo en
`GIT_DEPLOY_HISTORY.md`.

## Riesgo y controles

| Riesgo | Ejemplos | Controles |
|---|---|---|
| Bajo | diseño, textos, distribución, mejoras visuales | revisión breve, CI, prueba visual en TESTING |
| Medio | flujos, formularios, consultas, lógica comercial no crítica | + pruebas de la lógica tocada y verificación focalizada |
| Alto | autenticación, permisos, aislamiento entre negocios, Caja, stock, pagos, deudas, facturación, migraciones, datos históricos, operaciones irreversibles | + respaldo, auditoría, transacciones, idempotencia, concurrencia, integridad y recuperación; migraciones ensayadas sobre una copia aislada antes de Production y verificador de solo lectura después |

Toda migración debe ser compatible hacia atrás (el código anterior funciona sobre el esquema nuevo), para que el
rollback de código en Railway siempre sea posible sin tocar la base. No aplicar procedimientos complejos a tareas
sencillas.

## Pruebas

- El código se desarrolla en local; **las pruebas funcionales se hacen en Railway TESTING**.
- No se hacen certificaciones funcionales locales completas, pruebas duplicadas localhost/TESTING, simulaciones largas,
  automatizaciones complejas para lo que se prueba fácil desde la interfaz, scripts temporales innecesarios ni rondas
  de comprobación sin evidencia nueva.
- Las pruebas nuevas se limitan a la lógica tocada; el CI completo y la regresión se mantienen siempre.

## Production y recuperación

Cada publicación registra en `codex-reports/GIT_DEPLOY_HISTORY.md`: SHA, fecha, funcionalidad, migraciones, IDs de
despliegue, verificación e incidencias, y se etiqueta `prod-AAAA-MM-DD-<sha8>`. Ante una falla: determinar el estado
real antes de actuar; sin reintentos automáticos de migraciones; sin `migrate resolve`, SQL improvisado ni
restauraciones sin análisis y autorización expresa; rollback al despliegue anterior sólo tras verificar compatibilidad
con el esquema aplicado.

## Continuidad del proyecto

El conocimiento queda en el repositorio, no en una conversación.

| Documento | Contenido |
|---|---|
| `CLAUDE.md` | instrucciones de trabajo y guardas |
| `DEVELOPMENT_WORKFLOW.md` | esta metodología |
| `codex-reports/ROADMAP.md` | prioridades, pendientes, diferidos, deuda técnica |
| `DELIGO_FULL_CONTEXT_LATEST.md` | contexto técnico y comercial |
| `CODEX_REPORT.md` | estado actual y punto exacto de continuidad |
| `codex-reports/GIT_DEPLOY_HISTORY.md` | ramas, commits, despliegues, versiones estables y etiquetas |
| `codex-reports/<módulo>.md` | documentos técnicos específicos |

`CODEX_REPORT.md` siempre dice: qué se está haciendo y por qué, decisiones del operador, qué está implementado,
desplegado y realmente probado, qué falta, qué autorizaciones existen, qué está prohibido y el siguiente paso exacto.
Las decisiones históricas no se borran: se registra la nueva, cuál reemplaza y por qué. La documentación no se
presenta como estado real sin verificarla contra Git, CI o Railway.

## Eficiencia

Resultados concretos; informes cortos (qué se implementó · qué vio/probó Claude · qué verificó el operador · qué falta
· problemas · próximo paso con URL y acciones exactas); sin comprobaciones redundantes; no dedicar más tiempo a
herramientas de certificación que al problema; no inventar resultados, commits ni hashes; si falta un acceso, decirlo
y seguir con una alternativa razonable; seguridad sin burocracia.

## Antecedentes

- **2026-11-24:** flujo operador → ChatGPT → Claude → GitHub Actions → TESTING → Production con condición de activación
  (versión estable certificada en Production); cumplida con `697dfd7e` el 2026-11-27 y reemplazado por este ciclo.
- **2026-11-19:** validación manual con evidencia en lugar de baterías automatizadas nuevas como condición para avanzar;
  sus principios se conservan en «Pruebas».
