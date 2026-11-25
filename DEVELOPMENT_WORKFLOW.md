# DeliGO — metodología permanente de desarrollo

Definida por el operador el 2026-11-24. Reemplaza, cuando se active, la metodología del 2026-11-19 (validación manual
con evidencia, sin baterías nuevas por defecto), que queda como antecedente: sus principios siguen vigentes dentro de este
flujo. Las certificaciones ya registradas en `codex-reports/` siguen siendo historial válido.

## Activación

**Estado: PENDIENTE DE ACTIVACIÓN.** Entra plenamente en vigencia cuando se cumplan TODAS estas condiciones:

1. BUG-001 y BUG-002 corregidos y verificados en TESTING.
2. Pruebas funcionales de la integración actual (compras/catálogo, commit desplegado en TESTING) completadas.
3. Incidencias que impidan una liberación segura resueltas.
4. Despliegue de Production preparado con sus precauciones.
5. Una versión estable, funcional y certificada en Production.

Hasta entonces: terminar la certificación actual por bloques (Bloque 1 = `M11240504`) sin perder los controles ya
preparados y sin agregar trabajo innecesario. Al activarse, registrar la fecha y el commit estable aquí y en
`codex-reports/GIT_DEPLOY_HISTORY.md`.

## Flujo obligatorio de cada tarea

1. El operador define la necesidad, el error o la funcionalidad.
2. ChatGPT analiza requisitos y prepara el alcance.
3. Claude estudia el código existente y las decisiones históricas relevantes.
4. Claude implementa la solución.
5. Claude entrega un informe de los cambios.
6. ChatGPT revisa lógica, seguridad y posibles regresiones.
7. Con autorización, Claude sube los cambios a GitHub.
8. GitHub Actions hace los controles automáticos.
9. Los cambios llegan a `testing-codex` y a Railway TESTING.
10. El operador hace las pruebas funcionales directamente en TESTING.
11. Claude comprueba los resultados internos cuando haga falta.
12. ChatGPT analiza los resultados.
13. Si todo está bien, el operador autoriza Production.
14. Se registra la versión estable y se cierra la tarea.

## Pruebas

- El código se desarrolla y edita en local; **las pruebas funcionales se hacen en Railway TESTING**.
- No se hacen: certificaciones funcionales locales completas, las mismas pruebas en localhost y en TESTING, simulaciones
  locales largas, automatizaciones complejas para lo que se prueba fácil desde la interfaz, scripts temporales
  innecesarios, rondas de comprobación sin evidencia nueva, ni pruebas masivas de lo que una modificación sencilla no
  afectó.
- Se conservan las pruebas automatizadas existentes y GitHub Actions. Nunca se eliminan, debilitan ni modifican sólo para
  conseguir un CI verde (sí se actualizan cuando describen un comportamiento que el operador decidió cambiar, y se dice).
- Comprobaciones técnicas mínimas sólo cuando son indispensables (sobre todo en cambios críticos), sin convertirse en
  certificaciones duplicadas.

## Una tarea por vez

- Objetivos concretos y delimitados; no acumular modificaciones sin certificar.
- Siempre que se pueda, cerrar el ciclo y llevar la versión estable a Production antes de empezar otra tarea importante.
- No introducir funcionalidades no pedidas. Los problemas laterales van al roadmap, salvo que bloqueen la tarea actual.

## Gestión de errores en TESTING

1. Identificar la causa real. 2. Proponer una corrección puntual. 3. Someterla a revisión. 4. Actualizar TESTING.
5. Repetir sólo las pruebas afectadas.

Después de unos **tres intentos fallidos**, detenerse y evaluar si conviene abandonar la implementación; no acumular
parches sobre una solución defectuosa. Si se reinicia: partir del último commit certificado de Production, conservar los
intentos en Git, hacer una implementación limpia, evaluar por separado migraciones y datos de TESTING, no restaurar bases
ni borrar datos sin autorización y no usar force push sin autorización explícita.

## Production como referencia estable

Production representa la última versión funcional certificada. Cada liberación registra: commit exacto, fecha,
funcionalidades, migraciones aplicadas, resultados de las pruebas, incidencias conocidas, respaldo y procedimiento de
recuperación cuando corresponda. Preferentemente se etiqueta en Git. Production nunca cambia sólo porque TESTING funcione:
el operador autoriza cada despliegue.

## Seguridad proporcional al riesgo

| Riesgo | Ejemplos | Controles |
|---|---|---|
| Bajo | diseño, textos, distribución, mejoras visuales | revisión breve, CI, prueba visual en TESTING |
| Medio | flujos, formularios, consultas, lógica comercial no crítica | + pruebas de la lógica tocada y verificación focalizada |
| Alto | autenticación, permisos, aislamiento entre negocios, Caja, stock, pagos, deudas, facturación, migraciones, datos históricos, operaciones irreversibles | + respaldo, auditoría, transacciones, idempotencia, integridad, permisos y recuperación según el alcance |

No aplicar procedimientos complejos a tareas sencillas.

## Responsabilidades

- **Operador:** define necesidades, toma decisiones finales, autoriza despliegues, hace las pruebas funcionales y evalúa
  la experiencia de usuario.
- **ChatGPT:** analiza requisitos y decisiones, revisa propuestas e informes, detecta riesgos y regresiones, prepara
  prompts, audita resultados y evidencia, consulta GitHub/Railway cuando tiene acceso y ayuda con la continuidad.
- **Claude:** inspecciona el código real, implementa, respeta las decisiones aprobadas, gestiona Git, CI y despliegues
  autorizados, verifica datos internos cuando corresponde, documenta e informa resultados reales sin inventar
  verificaciones.

## Continuidad del proyecto

El conocimiento queda en el repositorio, no en una conversación. Documentos y su función:

| Documento | Contenido |
|---|---|
| `CLAUDE.md` | instrucciones de trabajo y guardas |
| `DEVELOPMENT_WORKFLOW.md` | esta metodología y su condición de activación |
| `codex-reports/ROADMAP.md` | tareas completadas, pendientes, bloqueadas, descartadas, futuras y deuda técnica |
| `DELIGO_FULL_CONTEXT_LATEST.md` | contexto técnico y comercial, arquitectura y decisiones importantes |
| `CODEX_REPORT.md` | estado actual y punto exacto de continuidad |
| `codex-reports/GIT_DEPLOY_HISTORY.md` | ramas, commits, despliegues, certificaciones y versiones estables |
| `codex-reports/<módulo>.md` | documentos técnicos específicos |

Al cerrar cada tarea se actualiza sólo la documentación que corresponde. El punto de continuidad (`CODEX_REPORT.md`)
siempre dice: qué se está haciendo y por qué, decisiones del operador, qué está implementado, qué está desplegado, qué fue
realmente probado, qué falta, qué autorizaciones existen, qué está prohibido y el siguiente paso exacto. Las decisiones
históricas no se borran: cuando una cambia, se registra la nueva, cuál reemplaza y por qué. La documentación no se
presenta como estado real sin verificarla contra Git, CI o Railway.

## Eficiencia

Resultados concretos; sin informes repetitivos ni comprobaciones redundantes; no dedicar más tiempo a herramientas de
certificación que al problema original; no inventar resultados, commits ni hashes; si falta una herramienta o un acceso,
decirlo y seguir con una alternativa razonable; seguridad sin burocracia.
