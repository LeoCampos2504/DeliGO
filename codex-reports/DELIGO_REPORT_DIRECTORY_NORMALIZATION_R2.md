# DeliGO — Canonical report directory normalization R2

Fecha: 2026-09-27  
Resultado: consolidación documental y normalización física completadas.  
Alcance: documentación canónica, configuración local por worktree y verificación física. Sin cambios de producto, código, tests, base de datos, commits, pushes ni Production.

## Causa estructural

`git worktree list --porcelain` confirmó cinco checkouts del mismo repositorio. Los cuatro worktrees funcionales tenían `codex-reports`, `CODEX_REPORT.md` y `DELIGO_FULL_CONTEXT_LATEST.md` rastreados por Git en sus respectivas ramas. Por eso Git materializaba las copias al crear/usar cada checkout; no eran sólo archivos temporales creados por las tareas. Una eliminación manual produciría working-tree deletions para esos archivos rastreados, y una operación posterior que los incluya podría volver a materializarlos.

```text
ARE_NONCANONICAL_REPORT_COPIES_GIT_TRACKED=SI
SIMPLE_FILESYSTEM_DELETE_WOULD_SHOW_TRACKED_DELETIONS=SI
GIT_CAN_REMATERIALIZE_TRACKED_PATHS=SI
```

No se usó eliminación manual. Git sparse-checkout marca los archivos excluidos para omitirlos en el working tree, pero siguen rastreados en el índice/branch. La configuración `extensions.worktreeConfig=true` ya estaba activa en el repositorio compartido antes del cambio. Git documenta que sparse-checkout asigna la configuración y el archivo de reglas por worktree cuando está disponible esa extensión; los archivos excluidos permanecen rastreados ([sparse-checkout](https://git-scm.com/docs/git-sparse-checkout), [git-config: extensions.worktreeConfig](https://git-scm.com/docs/git-config#Documentation/git-config.txt-extensionsworktreeConfig)).

## Inventario consolidado y reconciliación

El preflight de R1 halló 299 copias de reportes en cuatro directorios no canónicos: 273 idénticas por contenido normalizado, 2 contenidas por la versión canónica y 24 copias divergentes. Había además cuatro handoffs divergentes. Se agruparon hashes/versiones repetidas para reconciliar la información una sola vez, no por cada checkout.

| Archivo | Resolución en autoridad canónica |
|---|---|
| `COMPLETED_TASKS.md` | Se amplió el registro terminal T39 con los gates R3/R3A/R3B, alcance de la evidencia física, resultado desktop, exclusiones de producto y triggers que no se dispararon físicamente. El cierre T34-R4 canónico se preservó. |
| `DECISIONS_AND_INVARIANTS.md` | Se incorporaron las decisiones R3 de SuperAdmin Push: owner moderno, legacy inerte, branch de auth dedicado, dispatch post-commit, resolución transaccional, deduplicación por endpoint, destino `/admin`, UI y compatibilidad T40. |
| `GIT_DEPLOY_HISTORY.md` | Se añadió como historial el commit R3 `a808453fd8ca8120412c4c257ed211098f8ea819`, deploy Testing y límites de Production. El objeto commit existe localmente. El registro posterior de Production RC1 permanece como autoridad más nueva. |
| `FINDINGS.md` | La versión canónica prevalece: `F-P2-T31-R23B-01=RESOLVED` por T34-R4 y el finding P2-T38 está resuelto. Se añadió que `OPEN_NON_BLOCKING` era sólo el estado histórico anterior al cierre R1. R3/R4 quedan identificados como posteriores a los snapshots abiertos. |
| `P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md` | Se conserva la versión canónica con `R1P6I_COMMIT_SHA=d6cde93fb35b822ff839bf25353922f3a41437ce`; `PENDING_COMMIT` de las ramas es estado obsoleto, no contenido vigente que deba promoverse. El estado pendiente de deploy allí registrado se mantiene. |
| `ROADMAP.md` | Se preservó el handoff R4 actual, con T34 cerrado y el finding resuelto. La captura 2026-09-25 de doc-reconcile se conservó bajo encabezado histórico, incluyendo `T34=READY_TO_START` como estado de esa fecha y su nota explícita de supersesión. El backlog anterior que decía `READY_TO_START` fue reclasificado como snapshot histórico, no backlog activo. |
| `TEST_AUTHORITY.md` | Se preservaron como históricos los gates T39 R3/R3A/R3B y el closeout terminal, diferenciando el timeout ambiental R3A del resultado R3B/final cerrado. La evidencia física desktop y los límites de certificación siguen explícitos. |
| `CODEX_REPORT.md` y `DELIGO_FULL_CONTEXT_LATEST.md` | Se mantuvieron los handoffs canónicos. El encabezado vigente refleja T34-R4 cerrado y elimina T34 de candidatos futuros; el bloque P2-T38 anterior se etiqueta histórico. El resumen T34-R4 y un compact handoff T39 del 2026-09-25 se conservaron con contexto temporal, sin tratar conteos/prioridades viejos como actuales. |

Las diferencias T34/T38 de `ROADMAP.md` no tenían líneas informativas exclusivas frente al canónico; eran diferencias de orden/contenido ya cubierto. La variante `FINDINGS.md` que afirmaba T38 `OPEN_NON_BLOCKING` y el `PENDING_COMMIT` de T44 se clasificaron `STALE_DUPLICATE`, no autoridad actual. No se reconstruyeron los reportes T34 R0/R1/R2/R3/R4; sus cinco copias canónicas y adendas permanecen intactas.

```text
REPORT_DIVERGENCES_BEFORE=24_REPORT_COPIES
HANDOFF_DIVERGENCES_BEFORE=4_HANDOFF_COPIES
CANONICAL_HAS_ALL_UNIQUE_DOCUMENTATION=SI (reconciliada; los snapshots antiguos están etiquetados como históricos)
UNRESOLVED_UNIQUE_DOCUMENTATION=NO
```

## Artefactos de load tests

Se aplicó la política indicada por esta tarea: `load-tests\results\loadcert-*\human-report.md` se clasifica `GENERATED_TEST_ARTIFACT_NOT_CODEX_TECHNICAL_REPORT`. Los 12 artefactos permanecen en sus carpetas de resultados; no se movieron a `codex-reports` ni se borraron.

## Mecanismo single-physical-copy y paths

Se volvió a ejecutar `git worktree list --porcelain` antes del cambio; las cinco rutas/HEAD/branches coincidían con el inventario R1. `extensions.worktreeConfig=true` está en `.git/config`; `core.sparseCheckout` no estaba activo y los `info/sparse-checkout` son rutas distintas por worktree. La configuración existente de `p2-doc-reconcile-t38` (`codex.localEnvironmentConfigPath`) se preservó.

Se aplicó non-cone sparse-checkout sólo en estos cuatro worktrees funcionales:

| Worktree | Git-dir de config/rules |
|---|---|
| `C:\Leo Campos\Trabajo\deligo-t34-session-isolation` | `C:\Leo Campos\Trabajo\deligo-main-limpio\.git\worktrees\deligo-t34-session-isolation\` |
| `C:\Leo Campos\Trabajo\deligo-t38-installation-ux` | `C:\Leo Campos\Trabajo\deligo-main-limpio\.git\worktrees\deligo-t38-installation-ux\` |
| `C:\Leo Campos\Trabajo\deligo-t39-admin` | `C:\Leo Campos\Trabajo\deligo-main-limpio\.git\worktrees\deligo-t39-admin\` |
| `C:\Users\eltig\.codex\worktrees\p2-doc-reconcile-t38\deligo-main-limpio` | `C:\Leo Campos\Trabajo\deligo-main-limpio\.git\worktrees\deligo-main-limpio\` |

Reglas aplicadas en cada `info/sparse-checkout`:

```text
/*
!/codex-reports/
!/CODEX_REPORT.md
!/DELIGO_FULL_CONTEXT_LATEST.md
```

Rutas excluidas en cada worktree: `<worktree>\codex-reports\**`, `<worktree>\CODEX_REPORT.md`, `<worktree>\DELIGO_FULL_CONTEXT_LATEST.md`. No se excluyó `load-tests`, `src` ni ninguna otra ruta. La configuración está en cada `config.worktree` y las reglas en cada Git-dir individual; el worktree canónico no fue objetivo. En él `core.sparseCheckout` sigue unset, `.git/info/sparse-checkout` no existe y las tres rutas documentales continúan presentes.

## Validación física posterior

| Worktree | `codex-reports` | `CODEX_REPORT.md` | `DELIGO_FULL_CONTEXT_LATEST.md` | Estado Git | Código ejemplo `src/proxy.ts` |
|---|---:|---:|---:|---:|---:|
| T34 | NO | NO | NO | clean | presente |
| T38 | NO | NO | NO | clean | presente |
| T39 | NO | NO | NO | clean | presente |
| Doc reconcile | NO | NO | NO | clean | presente |
| Canónico `deligo-main-limpio` | SÍ | SÍ | SÍ | dirt preexistente preservado + cambios documentales autorizados | no se cambió |

En los cuatro worktrees funcionales `git ls-files -t` muestra `S` para los handoffs y `codex-reports/ROADMAP.md`: siguen rastreados, con skip-worktree activo, no borrados del índice ni de la historia. `git status --short --untracked-files=all` devolvió cero entradas en cada worktree funcional. `git worktree list` sigue mostrando cinco worktrees, sin cambios en sus HEAD/branches.

```text
REPORT_DIVERGENCES_AFTER=0 (cero copias no canónicas materializadas)
HANDOFF_DIVERGENCES_AFTER=0 (cero handoffs no canónicos materializados)
NONCANONICAL_REPORT_DIRS_PHYSICALLY_PRESENT=0
NONCANONICAL_HANDOFFS_PHYSICALLY_PRESENT=0
CANONICAL_REPORT_DIR_INTACT=SI
SPARSE_CHECKOUT_SAFE_PER_WORKTREE=SI
SPARSE_CHECKOUT_APPLIED=SI (4 worktrees funcionales; canónico excluido)
```

## Estado sucio canónico, límites y rollback

R1 observó antes de esta tarea 34 entradas tracked/modified y 26,750 untracked en el worktree canónico. Se preservaron sin reset, clean, restore masivo, stash, checkout destructivo ni staging masivo. El recuento posterior es 36 entradas tracked/modified y 26,752 untracked. Dos documentos tracked se editaron dentro del alcance autorizado; el nuevo reporte R2 explica una de las dos entradas untracked adicionales y la otra no fue atribuida ni modificada. Ninguna de las 26,750 entradas untracked de R1 se limpió o manipuló; el reporte R1 existente también se dejó intacto.

Riesgo residual: Git mantiene las versiones antiguas en las ramas/historia. Si una futura operación desactiva sparse-checkout, expande sus patrones o escribe explícitamente en una ruta excluida, las copias podrían volver a materializarse. Mantener los patrones por worktree y crear futuros reportes directamente en el directorio canónico.

Rollback por worktree, si el operador lo solicita: `git -C "<ruta-del-worktree-funcional>" sparse-checkout disable`. Ejecutarlo individualmente en T34/T38/T39/doc-reconcile rematerializa los paths rastreados de esa rama. No ejecutarlo en `deligo-main-limpio`. La reversión sólo restaura presencia física según el índice/branch; no sincroniza ni sobrescribe la autoridad canónica.

No se creó commit ni se hizo push. Los cambios locales de sparse-checkout no se agregaron a archivos del proyecto.

## Marcadores de cierre

```text
RESULT=PASS
ROOT_CAUSE_OF_DUPLICATION=REPORTS_AND_HANDOFFS_ARE_GIT_TRACKED_IN_EACH_WORKTREE_BRANCH
WORKTREES_FOUND=5
REPORT_DIVERGENCES_BEFORE=24
REPORT_DIVERGENCES_AFTER=0
HANDOFF_DIVERGENCES_BEFORE=4
HANDOFF_DIVERGENCES_AFTER=0
CANONICAL_HAS_ALL_UNIQUE_DOCUMENTATION=SI
LOAD_TEST_REPORT_POLICY=GENERATED_TEST_ARTIFACT_NOT_CODEX_TECHNICAL_REPORT (12 preserved)
SINGLE_PHYSICAL_COPY_MECHANISM=PER_WORKTREE_NON_CONE_GIT_SPARSE_CHECKOUT
SPARSE_CHECKOUT_SAFE_PER_WORKTREE=SI
SPARSE_CHECKOUT_APPLIED=SI
NONCANONICAL_REPORT_DIRS_PHYSICALLY_PRESENT=NO
NONCANONICAL_HANDOFFS_PHYSICALLY_PRESENT=NO
CANONICAL_REPORT_DIR_INTACT=SI
CANONICAL_DIRTY_STATE_PRESERVED=SI
CODE_MODIFIED=NO
PRODUCTION_TOUCHED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_NEXT_TASK_DECISION
REPORT_PATH=C:\Leo Campos\Trabajo\deligo-main-limpio\codex-reports\DELIGO_REPORT_DIRECTORY_NORMALIZATION_R2.md
```
