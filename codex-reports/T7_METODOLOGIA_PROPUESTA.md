# T7 — Metodología obligatoria de desarrollo de DeliGO (APROBADA Y VIGENTE desde 2026-11-27)

**Estado: APROBADA por el operador el 2026-11-27 con precisiones; la autoridad vigente es `DEVELOPMENT_WORKFLOW.md`.**
Precisiones del operador: ciclo con «CERTIFICACIÓN MANUAL FOCALIZADA»; una única rama funcional activa; sin pull
requests ni merge commits que cambien el SHA certificado; probar que el ruleset admite el fast-forward directo antes de
aplicarlo; «Wait for CI» en Production sólo cuando el workflow contemple los pushes a `main`; sin autorizaciones
redundantes dentro de un alcance aprobado. Este documento conserva la propuesta original y su razonamiento.

Preparada por Claude el 2026-11-27, después del cierre de T6, a pedido del operador. Al aprobarse reemplaza el contenido operativo de `DEVELOPMENT_WORKFLOW.md`
(2026-11-24), que queda como antecedente; sus principios (pruebas funcionales sólo en TESTING, una tarea por vez, límite
de unos tres intentos, seguridad proporcional, documentos de continuidad) se conservan dentro de este ciclo.

Punto de partida: Production = TESTING = `697dfd7e` (70 migraciones), CI completo de 995 pruebas, bases independientes.
La estabilización T0–T6 existió porque se acumularon cientos de commits en `testing-codex` sin pasar a Production. Esta
metodología existe para que eso no se repita.

## 1. El ciclo

```
UNA FUNCIONALIDAD → DESARROLLO → CI → TESTING → PRUEBA MANUAL FOCALIZADA → PRODUCTION → VERIFICACIÓN TÉCNICA → CIERRE
```

| Etapa | Quién | Qué se hace | Sale de la etapa cuando |
|---|---|---|---|
| 0. Definición | operador + ChatGPT | una sola funcionalidad o corrección, con alcance, riesgo (bajo/medio/alto) y criterio de aceptación | el operador aprueba el alcance |
| 1. Desarrollo | Claude | rama `codex/<funcionalidad>` creada desde `main` (= `testing-codex`); código + pruebas de la lógica tocada; informe breve | ChatGPT aprueba la revisión |
| 2. CI | GitHub Actions | push de la rama (autorizado); CI completo (typecheck, pruebas, build, migraciones sobre PostgreSQL efímero) | CI verde sobre el SHA exacto |
| 3. TESTING | Claude (autorizado) | fast-forward de `testing-codex` a ese SHA; Railway TESTING despliega; si hay migraciones: respaldo previo de TESTING | despliegue SUCCESS con el SHA exacto |
| 4. Prueba manual focalizada | operador (+ Claude con datos ficticios) | sólo los flujos tocados y sus vecinos directos, con instrucciones exactas; Claude revisa la evidencia (HTTP, logs, base de solo lectura) | operador aprueba |
| 5. Production | Claude (autorizado) | fast-forward de `main` al MISMO SHA certificado en TESTING; si hay migraciones: respaldo de Production + ensayo aislado (riesgo alto) | despliegue SUCCESS con el SHA exacto |
| 6. Verificación técnica | Claude | SHA, log del pre-deploy (migraciones), arranque, smoke HTTP, 5xx, crons, chat; si hubo migraciones: verificador de solo lectura del operador; el operador hace un smoke mínimo con su cuenta real SÓLO de lo que cambió | sin incidencias |
| 7. Cierre | Claude | documentos de continuidad, etiqueta de versión, rama de la funcionalidad cerrada | `main` = `testing-codex` = SHA cerrado |

No se repite en Production la certificación manual hecha en TESTING. Si en TESTING aparece un error: causa real →
corrección puntual → revisión → nuevo SHA → CI → TESTING → repetir sólo lo afectado (máximo unos tres intentos; después,
evaluar abandonar y reiniciar limpio desde `main`).

## 2. Reglas obligatorias

1. **Una funcionalidad a la vez.** Hay a lo sumo UNA rama de funcionalidad abierta. No se empieza la siguiente hasta
   completar el Cierre de la anterior (o descartarla formalmente).
2. **Nada acumulado sin publicar.** `testing-codex` nunca queda más de UNA funcionalidad por delante de `main`. Si una
   funcionalidad aprobada en TESTING no puede ir a Production, se decide explícitamente: publicarla, revertirla en
   `testing-codex` o dejarla en su rama; nunca se apila otra encima.
3. **Ramas alineadas.** Al empezar y al cerrar: `main` = `testing-codex`. Comprobación previa obligatoria de cada tarea:
   `git ls-remote origin main testing-codex` (mismo SHA) y ninguna rama de funcionalidad abierta.
4. **Production = exactamente lo certificado.** `main` sólo avanza por fast-forward al SHA que ya pasó CI y TESTING.
   Prohibidos: commits directos en `main`, merges/rebases/squash al publicar, cherry-picks, force push.
5. **CI completo y regresión siempre.** No se eliminan, debilitan ni saltan pruebas para obtener verde. Las pruebas
   nuevas se limitan a la lógica tocada.
6. **Controles proporcionales al riesgo** (tabla de `DEVELOPMENT_WORKFLOW.md`): alto = autenticación, permisos,
   aislamiento entre negocios, Caja, stock, pagos, deudas, migraciones y datos históricos → respaldo, transacciones,
   idempotencia, auditoría, ensayo de migraciones sobre copia aislada antes de Production y verificador de solo lectura
   después. Bajo/medio → sin respaldos ni ensayos.
7. **Entornos independientes.** Cada entorno con su propia base; nunca copiar datos, respaldos ni variables entre
   TESTING y Production; nunca reset/seed/borrado de datos persistentes; credenciales sólo en memoria del operador.
8. **Nada experimental publicado sin autorización.** Los experimentos viven en su rama (CI permitido); no llegan a
   `testing-codex` ni a `main` sin autorización expresa del operador para esa etapa.
9. **Autorización por etapa.** Push de rama, despliegue en TESTING y despliegue en Production son tres autorizaciones
   distintas del operador; ninguna se infiere de que las pruebas pasen.

## 3. Cómo garantizar que sólo lleguen a `main` commits aprobados por CI

Hoy nada lo impide técnicamente: `main` acepta cualquier push del administrador y el CI ni siquiera corre sobre `main`.
Propuesta en tres capas (todas son cambios de configuración de GitHub/Railway que **hace o autoriza el operador**; no se
aplican sin su aprobación):

1. **Regla de GitHub (ruleset) sobre `main` y `testing-codex`** — repositorio público, disponible sin costo:
   - «Require status checks to pass» con el check `validate` (job del workflow de CI). Para un push directo, GitHub
     rechaza el commit si ese SHA no tiene el check aprobado en otra referencia: como el SHA ya pasó CI en la rama de la
     funcionalidad, el fast-forward se acepta; un commit nuevo o no verificado se rechaza.
   - «Block force pushes», «Restrict deletions», «Require linear history».
   - Lista de bypass **vacía** (tampoco el administrador). Una emergencia exige que el operador desactive la regla a
     mano, de forma visible y registrada.
2. **Workflow de CI**: cambiar el disparador de la lista explícita de ramas (hoy 90+ entradas) a `codex/**`,
   `testing-codex` y `main`, para que toda rama de funcionalidad tenga CI sin editar el workflow. Es el único cambio de
   archivo que requiere esta metodología; se hace como primera tarea de T7 por el ciclo normal (no toca código
   funcional).
3. **Railway «Wait for CI»** (`checkSuites`, hoy desactivado) en DeliGO Production y DeliGO Copy: Railway no despliega un
   commit hasta que sus checks de GitHub terminan bien. Defensa en profundidad si la regla de GitHub se desactivara.

Complemento: **watch paths en Railway** para que los commits sólo documentales no redespliegan (hoy DeliGO, Review
Moderation Expiry y el chat redespliegan con cualquier commit; el chat incluso con su carpeta sin cambios). Propuesta:
chat → `/mini-services/chat-service/**`; Review Expiry → su script, `src/lib` usados, `prisma/**`, `package.json`,
`bun.lock`; DeliGO → todo salvo `codex-reports/**` y los `.md` de la raíz (patrones estilo gitignore; confirmar la
exclusión en el panel al aplicarlo). Mientras no exista, los documentos de cierre viajan como primer commit de la
siguiente funcionalidad (ver §4).

## 4. Documentación de cierre sin despliegues extra

La documentación de cierre se escribe después de publicar, así que no puede estar en el SHA publicado. Regla: el commit
documental de cierre de la funcionalidad N es el **primer commit de la rama de la funcionalidad N+1** (o un commit
documental propio en `codex/docs-<fecha>` cuando no haya otra funcionalidad inmediata). Llega a `testing-codex` y `main`
junto con la siguiente publicación, sin forzar despliegues. Con los watch paths del §3 podría publicarse solo, sin
redespliegue.

Aplicación inmediata: el commit documental del cierre de T6 queda en `codex/release-candidata` (sin push a `main` ni a
`testing-codex`) y será la base de la rama de la paridad de enlaces/QR de mesas.

## 5. Versiones y recuperación

- Cada publicación en Production se registra en `GIT_DEPLOY_HISTORY.md` (SHA, fecha, funcionalidad, migraciones, IDs de
  despliegue, verificación) y se etiqueta en Git: `prod-AAAA-MM-DD-<sha8>` (etiqueta anotada, empujada con autorización).
  Primera etiqueta propuesta: `prod-2026-11-27-697dfd7e`.
- Recuperación: determinar el estado real antes de actuar; sin reintentos automáticos de migraciones; sin
  `migrate resolve`, SQL improvisado ni restauraciones sin análisis y autorización expresa; el rollback de Railway al
  despliegue anterior sólo después de verificar compatibilidad con el esquema aplicado.
- Una funcionalidad con migraciones debe ser compatible hacia atrás (código anterior funcionando sobre el esquema nuevo),
  para que el rollback de código siempre sea posible sin tocar la base.

## 6. Tamaño de una funcionalidad

Pensada para cerrarse en días, no semanas. Si una funcionalidad crece (muchos archivos, varias migraciones, más de un
módulo de riesgo alto), se divide en entregas que se publican por separado, cada una útil o invisible por sí misma.
Lo que se descubre al pasar va al roadmap, salvo que bloquee la funcionalidad actual.

## 7. Pendientes que se conservan

- Pruebas manuales de T5 **diferidas, no aprobadas** (decisión comercial): segundo cajero, GPS/navegación,
  Salón/Mozo/Terminal/PyR, autenticación y sesiones simultáneas, notificaciones/push, carrito/pedido público, importación
  XLSX de Excel real, Caja en dispositivos físicos, D-6. Se ejecutan cuando una funcionalidad toque esas áreas o como
  tareas propias del roadmap.
- **Próxima funcionalidad (máxima prioridad):** paridad de enlaces y códigos QR de mesas en Terminal y Salón personal.
  No se empieza hasta aprobar T7.

## 8. Primeros pasos al aprobarse

1. Operador: crear el ruleset de GitHub (§3.1) y activar «Wait for CI» en Railway (§3.3); opcionalmente los watch paths.
2. Claude, como primera tarea del ciclo: workflow `codex/**` (§3.2), publicada junto con el commit documental de T6.
3. Registrar la activación (fecha y SHA estable) en `DEVELOPMENT_WORKFLOW.md`, `CLAUDE.md` y `GIT_DEPLOY_HISTORY.md`.
4. Empezar la paridad de enlaces/QR de mesas por el ciclo completo.
