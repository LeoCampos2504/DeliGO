# P2-T34-R4 — Post-fix physical recertification closeout

Fecha: 2026-09-26 (ART)
Alcance: cierre de certificación en TESTING; sin cambio funcional, DB, config ni Production.

## Resultado

El operador reportó recertificación en Android real, Chrome normal y el mismo perfil. Empezó con Cliente y Repartidor desconectados. Case A autenticó Cliente por Google OAuth y terminó en `/cliente/`. En Case B, Repartidor autenticó por Google OAuth en una segunda pestaña; después de volver y recargar Cliente, ambas sesiones siguieron operativas, Cliente continuó como Cliente, no apareció `WrongRoleNotice` y Repartidor permaneció autenticado.

La secuencia física satisface el escenario de aceptación indicado por R2 y solicitado explícitamente por R3. Los documentos dicen que C–H quedaron sin ejecutar tras el fallo histórico y que R3 debía recertificar primero A/B; ninguno establece C–H como condición de cierre. No se ejecutaron ni se solicitaron esos casos.

## Causa, historia y fix

La reproducción histórica de Case B fue FAIL con aviso de rol incorrecto al recargar Cliente. El operador confirmó que ambas autenticaciones históricas usaron Google OAuth. La causa confirmada fue que callback/completado OAuth seguía escribiendo la cookie legacy compartida `deligo_session`, fuera del aislamiento por familia.

R3 migró los flujos Google OAuth Cliente/Repartidor a cookies de sesión por familia para callback y consentimiento, preservando el fallback legacy del proxy para handlers existentes y el handoff T40 limitado a la familia previa correspondiente. Fix funcional: `38ac6d398fb1bdead11913a347c81162eb260666` (`fix: isolate Google OAuth sessions by actor family`). Se conserva `REGRESSION_STATUS=HISTORICAL_FIX_INCOMPLETE` y `REGRESSION_INTRODUCED_BY_COMMIT=NONE`: describen que el arreglo histórico quedó incompleto y que ningún commit posterior reintrodujo la regresión.

## Recertificación física

| Caso/observación | Resultado post-fix |
|---|---|
| A — Cliente Google OAuth, ruta `/cliente/` | PASS |
| B — Repartidor Google OAuth, segunda pestaña mismo Chrome/perfil | PASS |
| Cliente antes del reload | PASS |
| Cliente después del reload, continúa como Cliente | PASS |
| Aviso de rol equivocado después del reload | NO |
| Repartidor después del reload de Cliente, sigue autenticado | PASS |
| Coexistencia concurrente Cliente + Repartidor | PASS |

Histórico: `CASE_B_HISTORICAL=FAIL`. Post-fix: `CASE_B_POST_FIX=PASS`. El fallo ya no se reprodujo con la secuencia relevante. No se informó timestamp del ensayo ni versión Android/Chrome; no se infieren.

## Verificación TESTING y logs

`git fetch origin --prune` confirmó `origin/testing-codex=38ac6d398fb1bdead11913a347c81162eb260666`; el fix es ancestro de la rama. Railway TESTING reportó DeliGO Copy `SUCCESS`, deployment `da0f5913-31db-466d-978b-a554f86b891e`, y chat en vivo `SUCCESS`, deployment `345b9a6e-45db-403d-88da-a965a4d1850b`, ambos en el commit funcional exacto. Review Moderation Expiry también `SUCCESS` en el mismo SHA. No hubo redeploy manual.

Gate de logs de TESTING, ventana reciente de 24 h revisada sin imprimir mensajes sensibles: DeliGO Copy 155 registros, chat en vivo 7, Review Moderation Expiry 0; cero coincidencias exception/fatal/unhandled/crash y cero errores auth/session/cookie/wrong-role. Los matches de términos relevantes fueron revisados como no bloqueantes. `P2_T34_POST_PHYSICAL_LOG_GATE=PASS`.

## Disposición y documentación

`F-P2-T31-R23B-01` queda RESOLVED por P2-T34. T34 queda `CLOSED_TESTING_CERTIFIED`; la certificación funcional sigue anclada al commit R3 más esta evidencia física, no al commit documental.

```text
P2_T34_R3_TECHNICAL_GATE=PASS
CASE_A_POST_FIX=PASS
CASE_B_POST_FIX=PASS
CLIENT_GOOGLE_LOGIN_POST_FIX=PASS
DRIVER_GOOGLE_LOGIN_POST_FIX=PASS
CLIENT_RELOAD_AFTER_DRIVER_GOOGLE_LOGIN=PASS
CLIENT_REMAINED_CLIENT_AFTER_RELOAD=SI
DRIVER_REMAINED_AUTHENTICATED=SI
WRONG_ROLE_NOTICE_POST_FIX=NO
HISTORICAL_CASE_B=FAIL
POST_FIX_CASE_B=PASS
ROOT_CAUSE_CONFIRMED=SI
ROOT_CAUSE_LAYER=GOOGLE_OAUTH_LEGACY_SESSION_COOKIE
REGRESSION_STATUS=HISTORICAL_FIX_INCOMPLETE
REGRESSION_INTRODUCED_BY_COMMIT=NONE
P2_T34_POST_PHYSICAL_LOG_GATE=PASS
P2_T34_R4_PHYSICAL_RECERTIFICATION_GATE=PASS
P2_T34_FINAL_GATE=PASS
P2_T34_STATUS=CLOSED_TESTING_CERTIFIED
F_P2_T31_R23B_01_STATUS=RESOLVED
FUNCTIONAL_FIX_COMMIT=38ac6d398fb1bdead11913a347c81162eb260666
PRODUCTION_TOUCHED=NO
SOURCE_CODE_CHANGED=NO
TEST_FILES_CHANGED=NO
PRISMA_CHANGED=NO
PRODUCTION_CONFIG_CHANGED=NO
NEXT_PRIORITY_CANDIDATES=P2-T52 Fase 4 (prioridad sin asignar, requiere autorización); P2-T23 (espera decisión/sonda); P2-T33/P2-T37 permanecen secuenciadas
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_NEXT_TASK_DECISION
```

Se actualizaron la matriz física, adendas R1/R2/R3, FINDINGS, ROADMAP, CODEX_REPORT, FULL_CONTEXT y COMPLETED_TASKS. La documentación relevante se sincroniza a `origin/testing-codex` mediante un único commit docs; no se inició otro task ni se tocó Production.
