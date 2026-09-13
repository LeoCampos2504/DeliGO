# COMPLETED TASKS — DeliGO (índice compacto)

## CURRENT COMPLETION AUTHORITY — POST-P2-T02-R6 (2026-09-13)

```text
P2_T29_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T30_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED
P2_T32_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T35_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T36_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T41_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T46_STATUS=CLOSED_PRODUCTION
P2_T48_STATUS=CLOSED_PRODUCTION
P2_T02_STATUS=CLOSED_TESTING_CERTIFIED
P2_T02_RELEASE_ELIGIBLE=SI
P2_T23_STATUS=FUTURE_NEXT_TASK_AFTER_T02
ACTIVE_BACKLOG_EXCLUDES_CLOSED_TASKS=SI
R4_NEXT_TASK_P2_T32_VALID=NO
R4_NEXT_TASK_RECOMMENDATION_STATUS=SUPERSEDED_BY_POST_T46_BACKLOG_RECONCILIATION
```

Los cierres se basan en los reportes de promoción/certificación más recientes
y no reabren tareas por snapshots históricos.

```
TASK_ID: P2-T02-R6 — FINAL PHYSICAL EVIDENCE RECONCILIATION + T02 CLOSEOUT DECISION
VERDICT: CLOSED_TESTING_CERTIFIED
RESULT: la evidencia física final reconcilió los gates de movimiento bajo/sobre umbral, stationary control, recorrido exterior real de kilómetros, background best-effort con stale UI honesta y detención completa del tracking después de Entregado.
P2_T02_OPERATOR_CERTIFICATION: PASS
P2_T02_EXTERIOR_CERTIFICATION: PASS
P2_T02_COMPLETION_CERTIFICATION: PASS
P2_T02_RELEASE_ELIGIBLE: SI
ANDROID_B3_PHYSICAL_FINAL: PASS
ANDROID_B4_PHYSICAL_FINAL: PASS
CLIENT_MARKER_MOVEMENT: STEPWISE_JUMPS / SMOOTH_INTERPOLATION=NO
T23_PHYSICAL_EVIDENCE: CONFIRMED
T24_CURVE_EVIDENCE: PARTIAL / CURVE_CORNER_BLOCKS_T02=NO
P2_T02_STATUS: CLOSED_TESTING_CERTIFIED / TEST_T02_ORDER_LEFT_ACTIVE=NO
PRODUCT_CODE_CHANGED: NO / TEST_CODE_CHANGED: NO / PRISMA_SCHEMA_CHANGED: NO / DATABASE_CHANGED: NO
COMMIT_CREATED: YES / PUSH_PERFORMED: YES / DEPLOY_PERFORMED: NO / PRODUCTION_TOUCHED: NO
NEXT_ACTION: P2_T23_AUDIT_AND_DESIGN (no iniciada)
REPORT: codex-reports/P2_T02_R6_FINAL_PHYSICAL_EVIDENCE_RECONCILIATION.md
```

```
TASK_ID: P2-T48-R2 — CURATED EXACT-SCOPE PRODUCTION PROMOTION + CHECKPOINT
VERDICT: CLOSED_PRODUCTION
RESULT: T48 fue aplicado por cherry-pick directo sobre release/p2-t48-curated basada en origin/main; sólo 4 paths T48, sin T02 ni unrelated.
SOURCE_T48_SHA: bb228ee43c89073a4355e6a012bb9aeaf3669dcb
RELEASE_T48_SHA: 946f8c2404df8be6a1e7252f3d7d2ba520d337f8
QUALITY: 13 focal PASS, 51 regresión PASS, 0 FAIL; typecheck 31 igual baseline, 0 nuevos; lint, diff-check y build PASS.
PROMOTION: main fast-forward 46a1d55..946f8c2, no force; Production 96ef5efc-4678-40cd-9a96-966c839201f1 SUCCESS/RUNNING exact commit; 0 migraciones pendientes; smoke read-only PASS.
CHECKPOINT: p2-t48-stable-2026-09-10 -> 946f8c2404df8be6a1e7252f3d7d2ba520d337f8
T02_FILES_IN_RELEASE_DIFF: 0 / T02_HUNKS_IN_RELEASE_DIFF: 0 / UNAUTHORIZED_POST_T48_DIFF: 0
P2_T42_STATUS: CLOSED_PRODUCTION / P2_T02_STATUS: WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE / TEST_T02_ORDER_LEFT_ACTIVE: SI
FINDINGS: Negocio refresh OPEN/TO_BE_RECONCILED; previous occupation orders OPEN/provisional P2-T46; ninguno implementado.
NEXT_RECOMMENDED_SOFTWARE_TASK: P2-T46
PRODUCTION_TOUCHED: SI (sólo promoción exacta T48) / PUBLIC_RELEASE_AUTHORIZED: NO
REPORT: codex-reports/P2_T48_R2_CURATED_PRODUCTION_PROMOTION.md
```

```
TASK_ID: P2-T48-R1 — OPERATOR PHYSICAL CERTIFICATION CLOSEOUT + NEW OCCUPATION FINDINGS REGISTRATION
VERDICT: CLOSED_TESTING_CERTIFIED
RESULT: el operador confirmó físicamente T48 en TESTING: caso A ocupación activa con 2 pedidos, caso B ocupación activa con 0 pedidos y caso C cierre de ocupación; los tres PASS.
P2_T48_OPERATOR_CERTIFICATION: PASS / P2_T48_RELEASE_ELIGIBLE: SI
NEW_FINDING_1: NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG=CONFIRMED_PHYSICAL / ROOT_CAUSE=UNKNOWN_PENDING_AUDIT / TARGET=TO_BE_RECONCILED
NEW_FINDING_2: PREVIOUS_OCCUPATION_OPEN_ORDERS_SURFACE_IN_NEXT_OCCUPATION=CONFIRMED_PHYSICAL / DATA_LOSS=NO / PROVISIONAL_TARGET=P2-T46 / AUTHORITY=UNKNOWN_PENDING_T46_AUDIT
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / DATABASE_CHANGED=NO / COMMIT_CREATED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO
P2_T42_STATUS=CLOSED_PRODUCTION / P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE / TEST_T02_ORDER_LEFT_ACTIVE=SI
NEXT_RECOMMENDED_ACTION=P2_T48_CURATED_PRODUCTION_PROMOTION
REPORT: codex-reports/P2_T48_R1_OPERATOR_CERTIFICATION_CLOSEOUT.md
```

```
TASK_ID: P2-T48 — SALON PERSONAL OCCUPATION STATE PARITY
VERDICT: IMPLEMENTED_TESTED_DEPLOYED_TESTING_WAITING_OPERATOR
RESULT: Salón Personal propaga su polling existente al MesaOccupancyControl compartido mediante refreshKey; la ocupación se sigue resolviendo exclusivamente desde Mesa.ocupacionActualId/SesionOcupacionMesa, independiente de pedidos.
QUALITY: 13 focal PASS, 51 regresión PASS, 0 FAIL; typecheck efectivo 31 igual al baseline, 0 nuevos; ESLint focal, diff-check y build PASS.
TESTING: commit bb228ee43c89073a4355e6a012bb9aeaf3669dcb; deployment d5497cb8-34a0-4835-b2f8-4c117c23a325 SUCCESS/RUNNING exacto; 0 migraciones pendientes; smoke read-only PASS.
FILES: 2 product + 2 test; Prisma/schema/migrations/backfill 0; unrelated product files 0.
P2_T42_STATUS: CLOSED_PRODUCTION / P2_T02_STATUS: WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE / TEST_T02_ORDER_LEFT_ACTIVE: SI
PRODUCTION_TOUCHED: NO / PUBLIC_RELEASE_AUTHORIZED: NO
NEXT_ACTION: una única certificación manual del caso 1 en Testing
REPORT: codex-reports/P2_T48_SALON_PERSONAL_OCCUPATION_STATE_PARITY.md
```

```
TASK_ID: P2-T42-R1 — FORMAL CLOSEOUT + CURATED EXACT-SCOPE PRODUCTION PROMOTION
VERDICT: CLOSED_PRODUCTION
RESULT: T42 fue aplicada como cherry-pick directo sobre release/p2-t42-curated, basada exactamente en origin/main y sin solapamiento con T02. El release commit 46a1d55634e8bd848e160302cdb64a32be241c89 fue promovido a main por fast-forward sin force.
QUALITY: 134 tests focales/regresión PASS, 0 FAIL nuevos tras rerun controlado; typecheck efectivo 31 igual al baseline, 0 errores nuevos; ESLint de los 18 entries, diff-check y build PASS.
PRODUCTION: autodeploy Git-triggered 08a9bc74-67df-4935-adb6-7de8e1a30c91 SUCCESS/RUNNING, commit exacto, 0 migraciones pendientes, logs limpios; smoke / 307->/cliente, /operaciones/pyr 200 y panel API sin sesión 401.
TAG: p2-t42-stable-2026-09-10 -> 46a1d55634e8bd848e160302cdb64a32be241c89
P2_T42_STATUS=CLOSED_PRODUCTION / P2_T42_OPERATOR_REVIEW=TODO_PASS
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE / TEST_T02_ORDER_LEFT_ACTIVE=SI
NEXT_RECOMMENDED_SOFTWARE_TASK=P2-T48 / PUBLIC_RELEASE_AUTHORIZED=NO
REPORTS: codex-reports/P2_T42_R1_FORMAL_CLOSEOUT_AND_CURATED_PRODUCTION_PROMOTION.md
```

```
TASK_ID: P2-T02-B4-R3-R1 — IOS PHYSICAL PASS CLOSEOUT + ROADMAP RECONCILIATION
VERDICT: IOS_PHYSICAL_FIX_CERTIFIED — B4 CROSS-PLATFORM Y P2-T02 GLOBAL ABIERTOS
RESULT: el operador confirmó IOS_ROUTE_INITIAL=PASS, IOS_GOOGLE_MAPS_OPEN=PASS, IOS_ROUTE_RECOVERY_ON_RETURN=PASS, IOS_ROUTE_RECOVERY_WITHOUT_PWA_RESTART=PASS e IOS_NAVIGATION_CLOSE_REOPEN=PASS sobre fb3e584259cb2c57605c783543c7fdb1dc845454, cuyo deploy exacto en TESTING ya estaba confirmado SUCCESS/RUNNING/logs clean.
PHYSICAL_EVIDENCE_PRESERVED: background rev 37→40, 3 updates, 62.30s, THROTTLED; lock rev 41→45, 5 updates, max observado 29.65s, gap final 90.64s no atribuible; unlock first rev 46, latency UNKNOWN, foreground recovery PASS.
P2_T02_B4_IOS_STATUS=PASS / P2_T02_B4_ANDROID_STATUS=PENDING_DEVICE_AVAILABILITY / P2_T02_B4_STATUS=IOS_CERTIFIED_ANDROID_PHYSICAL_PENDING
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE / TEST_T02_ORDER_LEFT_ACTIVE=SI
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / DATABASE_CHANGED=NO / COMMIT_CREATED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_SOFTWARE_TASK=P2_T42_FORMAL_CLOSEOUT_AND_CURATED_PROMOTION (no ejecutada; no promover HEAD completo ni B1/B3/B4/R3)
REPORTS: codex-reports/P2_T02_B4_R3_R1_IOS_PHYSICAL_PASS_CLOSEOUT.md
```

```
TASK_ID: P2-T02-B4-R3 — IOS RETURN-FROM-GOOGLE-MAPS ROUTE RECOVERY
VERDICT: IMPLEMENTED_TESTED_DEPLOYED_TESTING — PHYSICAL IOS RETEST PENDING
REASON: la evidencia física reprodujo que volver de Google Maps dejaba la vista en "Calculando ruta…" hasta reiniciar toda la PWA. La auditoría del código indicó guards de request recientes, AbortError sin estado terminal, ausencia de lifecycle recovery y falta de desmontaje real al cerrar.
RESULT: route lifecycle recovery con visibilitychange/pageshow/focus coalescidos, timeout 10s, SUCCESS/ERROR/ABORTED/TIMEOUT, retry, protección generacional contra respuestas stale y unmount real close/reopen. 29 focales PASS/0 FAIL, ESLint focal/build/diff-check PASS, TSC raw 31 con 0 errores nuevos. Commit fb3e584259cb2c57605c783543c7fdb1dc845454, push testing-codex y autodeploy exacto SUCCESS en TESTING (DeliGO Copy, b54f0214-69a0-4e93-8589-fc2f37054301), logs limpios y /repartidor 200.
STAGES: audit markers + focused fix + tests + quality gates + commit/push + exact Testing deploy reconciliation.
REPORTS: codex-reports/P2_T02_B4_R3_IOS_MAPS_RETURN_ROUTE_RECOVERY.md
PUSHED: SI (testing-codex) / DEPLOYED_TESTING: SI / DEPLOYED_PRODUCTION: NO / PRODUCTION_TOUCHED: NO
NOTA: IOS_B4_RETURN_FROM_GOOGLE_MAPS_ROUTE_RECOVERY=OPEN_PENDING_PHYSICAL_RETEST; no se avanza a screen lock en esta ronda.
```

```
TASK_ID: P2-T35-T36-PROMOTION-TO-MAIN-AND-PRODUCTION — CHECKPOINT PRODUCTION
VERDICT: COMPLETE_PRODUCTION_CHECKPOINTED — batch certificado P2-T35+P2-T36 promovido a main/Production, tag creado, ambos servicios relevantes SUCCESS en el primer intento
REASON: sexta aplicación de RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS — con T35 (static-contract hygiene, test-only) y T36 (PWA/Branding Hygiene, certificación física Android PASS completa en los 4 controles) ambos CLOSED_TESTING_CERTIFIED, se evaluó y promovió el batch. Preflight corrigió primero una redacción ambigua del reporte de cierre de T36 ("confirma en producción real") — la certificación física fue un dispositivo Android real contra el build de TESTING, nunca Production. Auditoría de árbol completo confirmó exactamente 23 archivos (3 T35 + 20 T36), ninguno inesperado, 0 archivos de manifest/ícono legacy de Empleado/Mozo/Salón — P2-T52 confirmado fuera del batch.
RESULT: quality gates re-ejecutados sobre el source exacto a promover — T35 242 pass+0 fail, T36 focal 46 pass+0 fail (recontado fresco, corrigiendo un 47 impreciso del reporte original), regresión push/SW/PWA 36 pass+0 fail (combinado 82 sin duplicar), TYPECHECK_RAW=24 (idéntico baseline), ESLint/diff-check/build limpios, 0 secretos, 0 PII nueva. Los 11 assets binarios de T36 (badge + 10 maskable) verificados byte-idénticos (mismo SHA256) contra los hashes ya certificados. Release commit vía `git commit-tree` (mismo método de las 5 promociones anteriores, sin merge genérico): tree=testing-codex@ea9edbc (verificado byte-igual), parent=origin/main@8011ee3, SHA=773664f8da80b2143cfd1443ed0467ace6c45a34. Push fast-forward por SHA exacto a main (sin force), testing-codex intacto. Autodeploy Git-triggered SUCCESS en el primer intento en ambos servicios relevantes (DeliGO + chat en vivo), commit exacto verificado en ambos, 0 migrations pendientes. Smoke 11/11 PASS contra https://deligo.ar real (manifests, sw.js con CACHE_NAME=deligo-v16 y DELIGO_BADGE confirmados, badge + 3 maskable icons con Content-Length byte-exacto), sin mutaciones. Tag `p2-t35-t36-stable-2026-09-10` creado y pusheado sólo después de confirmar deploy+commit-match+smoke. P2-T52 preservada READY_FUTURE, ninguna otra tarea del backlog mezclada en el release.
STAGES: baseline fresco + aclaración de evidencia física + auditoría de delta real (diff de árbol) + clasificación completa de los 23 archivos + verificación byte-exacta de assets binarios + re-ejecución de quality gates + release commit curado + push main + autodeploy + verificación de commit match + smoke no mutante + tag (todo en esta tarea).
REPORTS: codex-reports/P2_T35_T36_PROMOTION_TO_MAIN_AND_PRODUCTION.md
PUSHED: SI (main, fast-forward, sin force) / DEPLOYED_PRODUCTION: SI (SUCCESS ambos servicios relevantes, primer intento) / TAG: SI (p2-t35-t36-stable-2026-09-10)
NOTA: P2_T35_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED). P2_T36_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED). P2_T35_PLUS_P2_T36_RELEASE_STATUS=CLOSED_PRODUCTION_CHECKPOINTED. P2_T52_STATUS=READY_FUTURE (preservado, no cerrado). P2-T41 (Terminal Read-Only Action Authorization, P0) registrada como próxima tarea funcional, no iniciada. PUBLIC_RELEASE_AUTHORIZED=NO — checkpoint técnico, no lanzamiento público. DeliGO sigue sin lanzamiento público.
```

```
TASK_ID: P2-T36-PWA-BRANDING-HYGIENE
VERDICT: CLOSED_TESTING_CERTIFIED — certificación física Android PASS en los 4 controles solicitados, sin ningún cambio de código en el cierre
REASON: P2-T36 había quedado implementado, testeado (47 focales + 82 regresión push/SW/PWA + 242 T35) y desplegado a TESTING (commit ea9edbc) con `P2_T36_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION`. El operador ejecutó el checklist físico Android y reportó PASS global.
RESULT: los 4 controles quedan PASS explícito — (A) ícono del launcher de DeliGO Operaciones correcto, sin recorte, sin exigir instalación separada de Empleado/Salón/PyR/Terminal (consistente con la identidad única de Operaciones); (B) ícono grande de Push de Cliente sigue siendo role-specific, badge pequeño usa el nuevo monocromático compartido; (C) control corto sobre un segundo rol (Negocio o Repartidor, no especificado) confirma el mismo patrón; (D) cierre completo + reapertura de la PWA no muestra branding viejo por caché. `P2_T36_STATUS` avanza a `CLOSED_TESTING_CERTIFIED`. Se preservó la autoridad corregida de identidad PWA única de Operaciones (de la tarea de corrección inmediatamente anterior): P2-T52 sigue `READY_FUTURE` como "Operations PWA Identity Consolidation / Legacy Artifact Cleanup", `F-P2-T36-01=OPEN_FOLDED_INTO_P2_T52_CONSOLIDATION`, y la consolidación pendiente de la identidad separada de Mozo NO bloqueó el cierre (`P2_T36_BLOCKED_BY_T52=NO`). Se registró el batch `P2_T35_PLUS_P2_T36` como elegible para el próximo checkpoint Production (no ejecutado aquí), y P2-T41 (Terminal Read-Only Action Authorization, P0) como la próxima tarea funcional recomendada tras ese checkpoint.
STAGES: verificación de baseline sin drift + registro de los 4 controles físicos + cierre de P2-T36 + preservación de la autoridad de identidad PWA + registro de release candidate + reconciliación de documentos (todo documental, sin código/tests/commit/push/deploy).
REPORTS: codex-reports/P2_T36_PWA_BRANDING_HYGIENE.md, codex-reports/P2_OPERATIONS_SINGLE_PWA_IDENTITY_AUTHORITY_CORRECTION.md, codex-reports/P2_T36_PHYSICAL_CERTIFICATION_CLOSEOUT.md
PUSHED: NO (ya pusheado en la tarea de implementación previa, commit ea9edbc) / DEPLOYED_TESTING: NO (ya desplegado previamente, SUCCESS) / DEPLOYED_PRODUCTION: NO / PRODUCTION_TOUCHED: NO
NOTA: P2_T35_STATUS=CLOSED_TESTING_CERTIFIED (preservado). P2_T35_PLUS_P2_T36_RELEASE_ELIGIBLE=SI, NEXT_RELEASE_CANDIDATE=P2_T35_PLUS_P2_T36 (evaluación de promoción no ejecutada aquí). P2-T41..T52 preservadas sin cambios de alcance. NEXT_RECOMMENDED_ACTION=P2_T35_PLUS_P2_T36_PROMOTION_EVALUATION. DeliGO sigue sin lanzamiento público.
```

```
TASK_ID: P2-T35-IOS-PWA-STATIC-CONTRACT-HYGIENE
VERDICT: CLOSED_TESTING_CERTIFIED — 6 fallas estáticas preexistentes resueltas, test-only, cero cambio de producto
REASON: la tarea nace de una deuda preservada desde P2-T29/P2-T31 (5 fallas estáticas iOS/PWA conocidas). Baseline fresco encontró 6, no 5 (BASELINE_DRIFT=SI, documentado sin forzar el número): 5 causadas por `core.autocrlf=true` del checkout (CRLF real en `ios-keyboard-fix.tsx`/`ios-viewport-debug-panel.tsx`) rompiendo regex que anclaban saltos de línea literales o presupuestos de caracteres ajustados; la 6ta causada por P2-T32 (extrajo el mapa+GPS de Perfil a un nuevo `address-map-picker.tsx` sin que ningún contrato iOS lo siguiera). Auditoría confirmó, por lectura directa del runtime, que los invariantes protegidos (única autoridad de modo, timeline acotado post-teclado, wrapper `isolate` de stacking) están 100% intactos — ninguna de las 6 era una regresión real.
RESULT: fix exclusivamente en 3 archivos de test (0 archivos de producto): normalización CRLF→LF de las fuentes leídas en los tests r6/r8, y corrección de ruta (client-profile-panel.tsx → address-map-picker.tsx) en el test r4. Sanity-check ejecutado ANTES de editar, vía script Node desechable, probando cada regex contra el string crudo (falla) vs normalizado (pasa) — demuestra que el fix distingue el estado roto del corregido sin debilitar ningún invariante. Batería completa de 16 archivos reales (ios/pwa/standalone/viewport/keyboard/dock/safe-area/nav-occlusion) re-ejecutada: 236→242 pass, 6→0 fail, 0 regresión. Build/lint/typecheck (24 raw, idéntico baseline) limpios. Las 4 fallas de `repartidor-tracking-static-contract.test.ts` (P2-T02, MODEL-G1 vs MODEL-E1) preservadas completamente intactas — archivo no tocado, fuera de alcance.
STAGES: descubrimiento de los 16 archivos reales + baseline fresco + mapeo causa-raíz por falla (con evidencia, no "preexisting") + sanity-check pre-edición + fix test-only + re-ejecución focal y de regresión + quality gates + commit + push (todo en esta tarea, sin deploy).
REPORTS: codex-reports/P2_T35_IOS_PWA_STATIC_CONTRACT_HYGIENE.md
PUSHED: SI (testing-codex únicamente, commit 227ea27) / DEPLOYED_TESTING: NO (test-only, sin cambio runtime, no requerido) / DEPLOYED_PRODUCTION: NO / PRODUCTION_TOUCHED: NO
NOTA: P2_T35_STATUS=CLOSED_TESTING_CERTIFIED (era READY_TO_START). P2_T30_STATUS/P2_T32_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservados). P2-T34/T36/T38/T39/T40 sin cambios, ninguno mezclado. IPHONE_PHYSICAL_CERTIFICATION_REQUIRED=NO. NEXT_ACTION=recomendación solamente (P2-T36 o P2-T34), Operaciones/Salón sigue PENDING_OPERATOR_FINDINGS. DeliGO sigue sin lanzamiento público.
```

```
TASK_ID: P2-T30-T32-PROMOTION-TO-MAIN-AND-PRODUCTION — CHECKPOINT PRODUCTION
VERDICT: COMPLETE_PRODUCTION_CHECKPOINTED — batch certificado P2-T30+P2-T32 promovido a main/Production, tag creado, ambos servicios relevantes SUCCESS en el primer intento
REASON: quinta aplicación de RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS — con T30 (higiene de fixtures SuperAdmin, test-only) y T32 (unificación de formulario de dirección Cliente + deep-link, certificación física de 4 casos PASS) ambos CLOSED_TESTING_CERTIFIED, se evaluó y promovió el batch. Preflight obligatorio: diff de árbol completo `origin/main..origin/testing-codex` auditado ANTES de cualquier side effect — exactamente 8 archivos (1 test-only de T30 + 7 de T32), ninguno inesperado, sin schema/migración, sin documentos locales. La lista larga de ~90 commits de `git log` fue clasificada como ruido esperado (origin/main es un snapshot curado sin ancestría lineal compartida, mismo fenómeno de las 4 promociones anteriores del epic P2-T29).
RESULT: quality gates re-ejecutados sobre el source exacto a promover — T30 48 pass+4 skip+0 fail (DB TESTING real), T32 focal 26 pass+0 fail, regresión de vecinos 42 pass+0 fail, TYPECHECK_RAW=24 (idéntico baseline), ESLint/diff-check/build limpios, 0 secretos, 0 PII nueva. Release commit vía `git commit-tree` (mismo método de las 4 promociones anteriores, sin merge genérico): tree=testing-codex@2fb603b (verificado byte-igual a HEAD^{tree}), parent=origin/main@44af4ec, SHA=8011ee3716c93e62b4a85ce82e3a9646ac5302a5. Push fast-forward por SHA exacto a main (sin force), testing-codex intacto. Autodeploy Git-triggered SUCCESS en el primer intento en ambos servicios relevantes (DeliGO + chat en vivo), commit exacto verificado en ambos, 0 migrations pendientes ("30 migrations found... No pending migrations to apply"). Smoke 8/8 PASS contra https://deligo.ar real, sin mutaciones. Tag `p2-t30-t32-stable-2026-09-09` creado y pusheado sólo después de confirmar deploy+commit-match+smoke. P2-T38/P2-T39/P2-T40 preservados READY_FUTURE, ninguno mezclado en el release.
STAGES: baseline fresco + auditoría de delta real (diff de árbol, no por nombre de commit) + clasificación completa de los 8 archivos + re-ejecución de quality gates + release commit curado + push main + autodeploy + verificación de commit match + smoke no mutante + tag (todo en esta tarea).
REPORTS: codex-reports/P2_T30_T32_PROMOTION_TO_MAIN_AND_PRODUCTION.md
PUSHED: SI (main, fast-forward, sin force) / DEPLOYED_PRODUCTION: SI (SUCCESS ambos servicios relevantes, primer intento) / TAG: SI (p2-t30-t32-stable-2026-09-09)
NOTA: P2_T30_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED). P2_T32_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED). P2_T30_PLUS_P2_T32_RELEASE_STATUS=CLOSED_PRODUCTION_CHECKPOINTED. P2_T31_STATUS=CLOSED (preservado, sin cambios). P2_T38/P2_T39/P2_T40_STATUS=READY_FUTURE (preservados). PUBLIC_RELEASE_AUTHORIZED=NO — checkpoint técnico, no lanzamiento público. NEXT_ACTION=recomendación solamente (P2-T35 o P2-T34), Operaciones/Salón sigue PENDING_OPERATOR_FINDINGS. DeliGO sigue sin lanzamiento público.
```

```
TASK_ID: P2-T32-CLIENT-ADDRESS-UX-UNIFICATION-AND-PROFILE-DEEPLINK
VERDICT: CLOSED_TESTING_CERTIFIED — certificación física del operador PASS para los 4 casos del checklist, sin cambios de código en el cierre
REASON: `P2-T32` había quedado implementado, testeado (26 focales + 42 regresión) y desplegado a TESTING (`2fb603b`) con `P2_T32_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION`. El operador reportó explícitamente "TODAS LAS PRUEBAS SALIERON PERFECTAS" para los 4 casos físicos (A: deep-link desde Inicio a "Mis Direcciones" sin scroll manual; B: modal flotante de checkout con alias/GPS/mapa/guardado/autoselección/carrito intacto; C: checkout con dirección existente sin regresión; D: fallback manual al denegar geolocalización).
RESULT: los 10 sub-marcadores del checklist (MIS_DIRECCIONES_VISIBLE_DIRECTAMENTE, MODAL_FLOTANTE, NOMBRE_ALIAS, UBICACION_ACTUAL, MAPA_SELECCION, GUARDADO, AUTOSELECCION_NUEVA_DIRECCION, CARRITO_INTACTO, EXISTING_ADDRESS_CHECKOUT_REGRESSION, GEOLOCATION_DENIED_MANUAL_FALLBACK) quedan registrados PASS explícito. `P2_T32_STATUS` avanza a `CLOSED_TESTING_CERTIFIED`, `CODE_CHANGES_REQUIRED_FOR_CLOSE=NO`. En la misma tarea de cierre se auditó (grep, sin colisión) y formalizó backlog nuevo: P2-T38 (PWA Installation UX — Android completion-state + iOS guided tutorial, formaliza F-P2-T31-R23A-03) y P2-T39 (Admin/SuperAdmin Functional Review, funcional/UX, distinta de y previa a P2-T33, no reabre P2-T26), ambas `READY_FUTURE`, ninguna implementada. Se preservó el orden de dependencias duras del backlog activo sin renumerar IDs, se dejó Operaciones/Salón como revisión manual del operador en curso sin tarea nueva, y se documentó (sin fix) que Mozo/Salón ya tienen push moderno wireado mientras TerminalOperativa deliberadamente no es un actor Push por diseño (P2-T12/F-P0-05). Se registró el batch `P2_T30_PLUS_P2_T32` como elegible para una evaluación de promoción futura, sin ejecutarla.
STAGES: verificación de baseline sin drift + registro de certificación física + auditoría de IDs libres + formalización de P2-T38/P2-T39 + reconciliación de documentos (todo documental, sin código/tests/commit/push/deploy).
REPORTS: codex-reports/P2_T32_CLIENT_ADDRESS_UX_UNIFICATION_AND_PROFILE_DEEPLINK.md, codex-reports/P2_T32_PHYSICAL_CERTIFICATION_CLOSEOUT_AND_BACKLOG_ADDITIONS.md
PUSHED: NO (ya pusheado en la tarea de implementación previa, commit 2fb603b) / DEPLOYED_TESTING: NO (ya desplegado previamente, SUCCESS) / DEPLOYED_PRODUCTION: NO / PRODUCTION_TOUCHED: NO
NOTA: P2_T30_STATUS=CLOSED_TESTING_CERTIFIED (preservado). P2_T30_PLUS_P2_T32_RELEASE_ELIGIBLE=SI, NEXT_RELEASE_CANDIDATE=P2_T30_PLUS_P2_T32 (evaluación de promoción no ejecutada aquí). NEXT_RECOMMENDED_ACTION=P2_T30_PLUS_P2_T32_PROMOTION_EVALUATION. DeliGO sigue sin lanzamiento público.
```

```
TASK_ID: P2-CURRENT-AUTHORITATIVE-BACKLOG-RECONCILIATION
VERDICT: COMPLETE_BACKLOG_RECONCILED — tarea exclusivamente documental, sin código/tests/DB/Railway/commit/push/Production
REASON: tras el cierre de P2-T29 y P2-T30, el operador pidió consolidar una única vista autoritativa del backlog para evitar que tareas acordadas se pierdan, que históricas ya absorbidas reaparezcan, que findings cerrados se reabran, o que deuda diferida se trate como próxima tarea. Se formalizaron 6 tareas nuevas (P2-T32 Client Address UX Unification, P2-T33 Final Security Review STRIDE+ASVS, P2-T34 Android session isolation, P2-T35 iOS/PWA static-contract hygiene, P2-T36 PWA/branding hygiene agrupada, P2-T37 P2 Final Audit/Launch Readiness) sin colisión de IDs, ninguna implementada. Se auditaron con evidencia real (no por nombre) 4 históricos dudosos (19-G, 19-H, 19-B0.2, 24-B) y se verificó la capacidad de "solo delivery" (Dark Kitchen).
RESULT: 3 hallazgos mayores documentados sin cambiar código: (1) P2-T18 ya estaba CLOSED con recertificación completa — el prompt citaba un snapshot histórico superado, nunca reflejado en ROADMAP.md/FINDINGS.md hasta esta tarea; (2) Dark Kitchen tiene una implementación nombrada y dedicada (T20-DK1/DK2A-C) más fuerte que la premisa "indirecta" del operador; (3) Thermal Printing tiene un módulo funcional ya wireado (src/lib/thermal-print/ + mesa-cuenta-dialog.tsx), contradiciendo la premisa de "no iniciado" — decisión del operador preservada, discrepancia documentada. 19-G/19-H/19-B0.2 clasificados ABSORBED con evidencia de código real; 24-B sin ninguna evidencia, DECISION_REQUIRED. ROADMAP.md recibió una nueva sección "CURRENT AUTHORITATIVE BACKLOG" cerca del inicio.
STAGES: auditoría de baseline + normalización P2-T27 + audit P2-T18 + audit Dark Kitchen + audit legacy 19-G/19-H/19-B0.2/24-B + formalización de 6 tareas nuevas + reconciliación de documentos (todo en esta tarea, sin código).
REPORTS: codex-reports/P2_CURRENT_AUTHORITATIVE_BACKLOG_RECONCILIATION.md
PUSHED: NO / DEPLOYED_TESTING: NO / DEPLOYED_PRODUCTION: NO / PRODUCTION_TOUCHED: NO
NOTA: P2_T29_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado). P2_T30_STATUS=CLOSED_TESTING_CERTIFIED (preservado). P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (preservado). P2_T27_STATUS=MERGED_CLOSED_BY_T29A (confirmado sin conflicto). P2_T18_STATUS=CLOSED (corregido en FINDINGS.md, nunca reabierto). Backlog activo reconciliado en ROADMAP.md. NEXT_RECOMMENDED_ACTION=P2-T32 (Client Address UX Unification). DeliGO sigue sin lanzamiento público.
```

```
TASK_ID: P2-T30-SUPERADMIN-AUTH-TEST-FIXTURE-HYGIENE
VERDICT: CLOSED_TESTING_CERTIFIED — F-PRE-T29-03 resuelto con evidencia real, sin cambios de código de producto
REASON: `superadmin-auth.test.ts` usaba `deleteMany({})` sin scope en su `beforeEach`, asumiendo que `super_admins` era una tabla exclusiva del archivo — eso crasheaba en cuanto la DB compartida de TESTING tenía identidades reales ya vinculadas y referenciadas por una FK `Restrict` (confirmado empíricamente: 3 filas reales, 2 referenciadas por `SolicitudRevisionResena.revisadaPorSuperadminId`). Se rediseñaron los fixtures con ids únicos por corrida y cleanup exclusivamente por esos ids. Se descubrió además que 4 tests dependían estructuralmente de que la tabla completa no tuviera NINGUNA identidad vinculada — regla de negocio real y correcta de `resolverIdentidadSuperadminGoogle` (rechaza creación/vinculación apenas existe una identidad ajena), no un defecto — se marcaron con `test.skipIf()` explícito (nunca se borró la fila real para forzar su PASS) y su cobertura de lógica se preservó de forma permanente vía 4 tests nuevos que llaman directamente a la función pura de decisión con snapshots sintéticos. 2 tests OAuth end-to-end con el mismo bloqueo estructural se corrigieron sin necesidad de skip, pre-creando su propio fixture con el sub del JWT para resolver por "authenticate" en vez de "create".
RESULT: 48 pass + 4 skip explícito + 0 fail, repetido en 3 corridas consecutivas idénticas (sin dependencia de orden, sin fixtures residuales) + 77/77 en 7 archivos vecinos de SuperAdmin. Auditoría de residuos: 0 fixtures propios remanentes, las 3 filas reales y las 2 referencias FK intactas. Se descubrió un finding separado no atribuible a esta tarea (12 sesiones `Sesion` huérfanas preexistentes, F-P2-T30-01) — documentado, no tocado. Build/lint/typecheck (24 raw, idéntico baseline) limpios, secret scan limpio. Un único commit test-only (2fff459, parent a5109b0), push exclusivo a `testing-codex`. Sin deploy (test-only), Production intacta.
STAGES: audit de root cause (código + Prisma + DB real) + rediseño de fixtures + tests dedicados de aislamiento (sentinel) + ejecución 3x + regresión de vecinos + commit + push (todo en esta tarea).
REPORTS: codex-reports/P2_T30_SUPERADMIN_AUTH_TEST_FIXTURE_HYGIENE.md
PUSHED: SI (testing-codex únicamente) / DEPLOYED_TESTING: NO (test-only, no requerido) / DEPLOYED_PRODUCTION: NO / PRODUCTION_TOUCHED: NO
NOTA: P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado). P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado). P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado). P2_T29D_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado). P2_T29E_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado). P2_T29_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado). P2_T27_STATUS=MERGED_CLOSED_BY_T29A confirmado sin conflicto real entre autoridades (fragmentos históricos "QUEUED" en el archivo son snapshot anterior a T29A, no vigentes). P2_T30_STATUS=CLOSED_TESTING_CERTIFIED (era READY_TO_START). NEXT_ROADMAP_TASK=P2-T02 (WAITING_FOR_OPERATOR, no accionable) — ninguna otra tarea READY/QUEUED disponible. DeliGO sigue sin lanzamiento público.
```

```
TASK_ID: P2-T29D-T29E-PROMOTE-TO-MAIN-AND-PRODUCTION — EPIC P2-T29 (A-E) CHECKPOINTED EN PRODUCTION
VERDICT: COMPLETE — bloque final certificado P2-T29D+P2-T29E promovido a main/Production, tag creado, ambos servicios SUCCESS en el primer intento
REASON: quinta aplicación de RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS — con T29D y T29E ambos CLOSED_TESTING_CERTIFIED (incluida certificación física final del epic completo), se promovió el bloque restante (residual de notificación Cliente "aceptado" + auditoría/regresión final sin código) inmediatamente. Mismo método de release curado ya validado 4 veces (snapshot commit vía git commit-tree, sin merge genérico). Diff de promoción auditado: exactamente 3 archivos (el residual completo de T29D), T29E confirmado sin ningún archivo de código propio, 0 migrations.
RESULT: push fast-forward limpio a main (7a3a1dc->44af4ec). Production DeliGO Y chat en vivo desplegaron SUCCESS de inmediato en el commit exacto, ambos en el primer intento (sin hiccup), 0 migrations pendientes ("No pending migrations to apply" confirmado en logs reales). Batería focal de 163 tests (121 puro/mock-db + 42 DB real), 0 fallas — construida desde el inicio en 2 grupos por naturaleza de DB (lección aplicada de la contaminación de mock.module encontrada en la tarea T29E anterior). Build/lint/typecheck sin regresión (24 raw, idéntico baseline), secret scan limpio. Smoke HTTP completo PASS (8/8 rutas 200) contra el dominio real de Production (https://deligo.ar) — se detectó y corrigió que el CLI de Railway local estaba linkeado por defecto a TESTING, todos los comandos de verificación de Production usaron -e/-s explícitos desde entonces. main/Production coinciden exactamente (DeliGO + chat en vivo). Tag p2-t29-stable-2026-09-09 creado y pusheado apuntando al SHA exacto, sólo tras confirmar todo lo anterior.
STAGES: auditoría de baseline (Git + Railway explícito) + diff + release snapshot + tests + quality + secret scan + push main + Production deploy + smoke + tag (todo en esta tarea).
REPORTS: codex-reports/P2_T29D_T29E_PROMOTE_TO_MAIN_AND_PRODUCTION.md
PUSHED: SI (main, fast-forward, sin force) / DEPLOYED_PRODUCTION: SI (SUCCESS ambos servicios, primer intento) / TAG: SI (p2-t29-stable-2026-09-09)
NOTA: P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado). P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado). P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado). P2_T29D_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED). P2_T29E_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED). P2_T29_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (epic completo A-E, era CLOSED_TESTING_CERTIFIED) — el epic P2-T29 completo queda finalmente cerrado y en Production. NEXT_ROADMAP_TASK=P2-T30 (SUPERADMIN AUTH TEST FIXTURE HYGIENE), READY_TO_START, no iniciada. DeliGO sigue sin lanzamiento público.
```

```
TASK_ID: P2-T29E-FINAL-COMPATIBILITY-REGRESSION-AND-PHYSICAL-CERTIFICATION (+ cierre P2-T29E-AND-T29-FINAL-PHYSICAL-CERTIFICATION-CLOSEOUT) — EPIC P2-T29 COMPLETO
VERDICT: CLOSED_TESTING_CERTIFIED (certificación automática 218/218 + certificación física final del operador PASS, 2026-09-09) — epic P2-T29 cerrado en TESTING
REASON: fase final del epic — auditoría de compatibilidad canónica+legacy y regresión completa sin agregar funcionalidad, confirmando autoridad de transición única (5 consumidores, sin tablas duplicadas), grafos canónico/legacy domicilio/retiro/mesa cubiertos por test real, UI Negocio sin atajos legacy como CTA, timeline Cliente sin regresión. Batería final ampliada a 218 tests (incluyó por primera vez Operaciones/PyR/Salón y la suite de seguridad P2-T25/T08), 0 fallas nuevas — 1 fallo transitorio P2028 (archivo P2-T25 ajeno al diff) reproducido en aislamiento y con la batería completa reejecutada limpia, coincidiendo exactamente con el finding preexistente F-P2-TESTINFRA-01 (no reabierto, no regresión). Certificación física final del operador confirmó Domicilio completo (dos repartidores reales, single-winner), Retiro y Mesa sin regresión, notificaciones sin duplicados.
RESULT: sin ningún cambio de código en ninguna de las dos tareas (T29E_CODE_CHANGES_REQUIRED=NO) — build/lint/typecheck (24 raw, idéntico baseline) limpios, sin commit, sin push, sin deploy nuevo. Deployment TESTING existente (`a5109b0`) reconfirmado estable. Production intacta en toda la secuencia. `P2_T29E_STATUS` y `P2_T29_STATUS` (epic completo) avanzan a `CLOSED_TESTING_CERTIFIED` — T29D/T29E permanecen en checkpoint de TESTING, no de Production, hasta la próxima promoción. `RELEASE_BATCH=P2_T29D_PLUS_P2_T29E` queda `RELEASE_BATCH_READY_FOR_PROMOTION=SI`.
STAGES: auditoría final + batería 218 tests (2 grupos por naturaleza de DB, hallazgo de proceso propio documentado) + quality gates + reporte automático -> certificación física final del operador PASS -> cierre documental del epic (esta entrada, sin código).
REPORTS: codex-reports/P2_T29E_FINAL_COMPATIBILITY_REGRESSION_AND_PHYSICAL_CERTIFICATION.md, codex-reports/P2_T29E_AND_T29_FINAL_PHYSICAL_CERTIFICATION_CLOSEOUT.md
PUSHED: NO (sin commit en ninguna de las dos tareas) / DEPLOYED_TESTING: N/A (deployment existente reconfirmado) / DEPLOYED_PRODUCTION: NO / PRODUCTION_TOUCHED: NO
NOTA: P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado). P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado). P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado). P2_T29D_STATUS=CLOSED_TESTING_CERTIFIED (preservado, NO avanza a Production checkpoint todavía). P2_T29E_STATUS=CLOSED_TESTING_CERTIFIED (era WAITING_FOR_OPERATOR_FINAL_PHYSICAL_CERTIFICATION). P2_T29_STATUS=CLOSED_TESTING_CERTIFIED (epic completo, era IN_PROGRESS) — NO equivale a Production checkpoint ni a lanzamiento público. NEXT_RECOMMENDED_ACTION=PROMOTE_P2_T29D_PLUS_P2_T29E_TO_MAIN_AND_PRODUCTION (tarea separada, requiere autorización explícita). Findings ajenos a T29 (Android session isolation, P2-T02, deuda de íconos PWA) preservados sin resolver. DeliGO sigue sin lanzamiento público.
```

```
TASK_ID: P2-T29D-RESIDUAL-CLIENT-NOTIFICATIONS-TIMELINE-AUDIT-AND-IMPLEMENTATION (+ cierre P2-T29D-CIERRE-DEFINITIVO-DESPUES-DE-CERTIFICACION-FISICA)
VERDICT: CLOSED_TESTING_CERTIFIED (certificación física del operador PASS, 10/10 ítems, 2026-09-09)
REASON: FASE A auditó el scope histórico completo de T29D contra la autoridad de diseño original (P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md §10/§11, no sólo el NEXT_RECOMMENDED_ACTION de la tarea anterior) — de 6 requisitos originales, 5 ya estaban implementados/certificados/en Production (timeline 5 pasos, notificación "Buscando delivery", aviso a repartidores, notificación de asignación), quedando 1 residual real: la notificación Cliente para `recibido→aceptado`. Antes de implementarlo se detectó que su copy nunca había sido cerrado por ninguna autoridad (sólo un texto "(propuesto)" de una auditoría read-only) — se presentaron 3 opciones al operador vía pregunta directa en vez de inventar unilateralmente; el operador eligió `"${negocio} aceptó tu pedido"`. FASE B implementó el residual de forma mínima. Durante el audit también se detectó y corrigió una discrepancia aritmética documental (134 vs 137 tests) en el reporte de promoción previo, propagada sin re-verificar a 3 documentos más desde un subtotal mal transcrito en T29B-R1.
RESULT: implementación de 3 archivos (`src/lib/push.ts` con 1 key nueva en el mapa existente de `orderUpdateNotification`, `negocio/pedidos/[id]/estado/route.ts` con la eliminación de la supresión `isAcceptedWithoutClientCopy` que T29B había dejado, más el test correspondiente). 134 puros + 33 DB reverificados sin cambios de comportamiento + 5 tests T29D nuevos (domicilio, retiro, mesa=0, CAS-loser=0/double-tap=1, legacy=0), 0 fallas nuevas (1 fallo no-determinístico reproducido como flaky preexistente ajeno al fileset). Build/lint/typecheck/secret-scan limpios. 1 commit (`a5109b0`, parent `0c23008`), push exclusivo a `testing-codex`, deploy TESTING SUCCESS en el commit exacto (chat en vivo también), Production intacta. Certificación física posterior del operador: Domicilio 4/4 + Retiro 3/3 + Mesa 2/2 + notificación duplicada=NO + timeline sin regresión = 10/10 PASS. Cierre puramente documental (sin código, sin commit) tras el PASS físico.
STAGES: auditoría FASE A + decisión de producto vía pregunta al operador + implementación FASE B + tests + commit + push + deploy TESTING -> certificación física del operador PASS -> cierre documental (esta entrada, sin código).
REPORTS: codex-reports/P2_T29D_RESIDUAL_CLIENT_NOTIFICATIONS_TIMELINE_AUDIT_AND_IMPLEMENTATION.md, codex-reports/P2_T29D_PHYSICAL_CERTIFICATION_CLOSEOUT.md
PUSHED: SI (testing-codex únicamente) / DEPLOYED_TESTING: SI (SUCCESS, commit match) / DEPLOYED_PRODUCTION: NO / PRODUCTION_TOUCHED: NO
NOTA: P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado). P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado). P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado). P2_T29D_STATUS=CLOSED_TESTING_CERTIFIED (era WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION). P2_T29E_STATUS=READY_TO_START. P2_T29_STATUS=IN_PROGRESS (epic completo no se marca cerrado hasta T29E). RELEASE_BATCH=P2_T29D_PLUS_P2_T29E propuesto (T29D_STANDALONE_PROMOTION_REQUIRED=NO, residual pequeño, evaluación de promoción diferida hasta certificación física de T29E). DeliGO sigue sin lanzamiento público.
```

```
TASK_ID: P2-T29B-T29C-PROMOTE-TO-MAIN-AND-PRODUCTION
VERDICT: COMPLETE — bloque certificado P2-T29B+P2-T29B-R1+P2-T29C promovido a main/Production, tag creado, ambos servicios SUCCESS en el primer intento
REASON: cuarta aplicación de RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS — con T29B y T29C ambos CLOSED_TESTING_CERTIFIED (incluida certificación física con dos repartidores reales), se promovió el bloque funcional único (Negocio aceptado/preparando/esperando_repartidor + timeline Cliente/waiting-driver-notification + Repartidor waiting-driver acceptance con concurrencia real) inmediatamente, sin esperar a T29D/T29E. Mismo método de release curado ya validado 3 veces (snapshot commit vía git commit-tree, sin merge genérico). Diff de promoción auditado archivo por archivo: exactamente 22 archivos del bloque certificado, sin sorpresas, T29D/T29E confirmados ausentes, mini-services/chat-service y prisma/ sin tocar, 0 migrations.
RESULT: push fast-forward limpio a main (c45fd5e->7a3a1dc). Production DeliGO Y chat en vivo desplegaron SUCCESS de inmediato en el commit exacto, ambos en el primer intento (a diferencia de T29A, sin ningún hiccup de plataforma esta vez), 0 migrations pendientes. Batería focal de 181 tests (134 puros + 47 DB), 0 fallas nuevas — 1 fallo no-determinístico en un archivo NO tocado por este diff (order-transition-cas-concurrency.test.ts) se reprodujo en aislamiento (6/6 PASS) y se reejecutó la batería completa (47/47 PASS), confirmando ruido de infraestructura de test compartida, no una regresión. Build/lint/typecheck sin regresión, secret scan limpio. Smoke HTTP completo PASS + verificación semántica del commit desplegado (estado canónico, timeline 5 pasos, waiting-driver-boundary de Negocio ausente). main/Production coinciden exactamente. Tag p2-t29b-t29c-stable-2026-09-09 creado y pusheado apuntando al SHA exacto, sólo tras confirmar todo lo anterior.
STAGES: auditoría de baseline + diff + release snapshot + tests + quality + secret scan + push main + Production deploy + smoke + tag (todo en esta tarea).
REPORTS: codex-reports/P2_T29B_T29C_PROMOTE_TO_MAIN_AND_PRODUCTION.md
PUSHED: SI (main, fast-forward, sin force) / DEPLOYED_PRODUCTION: SI (SUCCESS ambos servicios, primer intento) / TAG: SI (p2-t29b-t29c-stable-2026-09-09)
NOTA: P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED preservado. P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED). P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED). P2_T29_STATUS=IN_PROGRESS (T29D/T29E pendientes, epic completo no se marca cerrado). P2_T29D_STATUS=READY_TO_START, con P2_T29D_REQUIRES_RESIDUAL_SCOPE_RECONCILIATION=SI — parte del alcance histórico de T29D (timeline segura + notificación "Buscando delivery") ya fue adelantado y certificado en T29B-R1/T29C, la próxima tarea debe auditar qué queda pendiente antes de implementar. DeliGO sigue sin lanzamiento público.
```

```
TASK_ID: P2-T29C-REPARTIDOR-WAITING-DRIVER-ACCEPTANCE-AND-CONCURRENCY
VERDICT: CLOSED_TESTING_CERTIFIED (certificación física del operador con DOS repartidores reales PASS, 11/11 ítems, 2026-09-09)
REASON: hizo que Repartidor consuma realmente `esperando_repartidor` (estado que T29B dejó alcanzable pero sin consumidor) en vez del `en_camino`+`repartidorId=null` legacy sobrecargado — domicilio pasa a operar recibido->aceptado->preparando->esperando_repartidor->en_camino->entregado. Query de disponibilidad, CAS de aceptación y auto-cancel migraron a una única autoridad compartida (`isAvailableForDriverAcceptance` en order-transitions.ts) que reconoce el estado canónico Y preserva compatibilidad legacy explícita (nunca ambigua — cada CAS compara contra el valor EXACTO leído, jamás un `estado: {in:[...]}` en la escritura), necesaria porque NEGOCIO_T29B_ROLLOUT_FORWARD_TRANSITIONS todavía acepta la arista directa preparando->en_camino durante el rollout. Cerró el GAP CRÍTICO que la auditoría original de P2-T29 identificó explícitamente ("la aceptación atómica del repartidor no tiene NINGÚN test de concurrencia real") con 2 tests de integración real (Promise.all contra Postgres de TESTING, dos repartidores compitiendo) + certificación física posterior con dos repartidores reales. Se corrigió además un hardcodeo de auditoría (PedidoEvento.estadoAnterior fijo a "en_camino", F-P2-T29C-01) y se movió el boundary de newDeliveryNotification de en_camino a preparando->esperando_repartidor, preservando el disparo legacy sin duplicar. Sin cambios de frontend Repartidor (ya dependía 100% del split servidor).
RESULT: ~90 tests nuevos/extendidos (7 order-transitions + 4 available-query + 12 aceptar-CAS incl. 2 de concurrencia real + 1 cancel-vs-accept-race + 4 auto-cancel + 4 new-delivery-boundary) + 142+27+12 reverificados sin cambios de comportamiento, 0 fallas nuevas. Build/lint/typecheck/secret-scan limpios. No se realizó verificación visual en navegador durante la implementación (la evidencia de concurrencia real vía Promise.all se consideró más rigurosa); la certificación física posterior con dos repartidores reales SÍ se ejecutó y confirmó PASS en los 11 ítems del checklist (single-winner, perdedor no asignado y desaparece tras poll, Cliente avanza a En camino, Negocio deja de buscar, nunca dos asignados, Retiro/Mesa excluidos, notificaciones correctas sin duplicados). 1 commit (0c23008, parent 155b4c4), push exclusivo a testing-codex, deploy TESTING SUCCESS en el commit exacto (chat en vivo también). Production intacta en toda la secuencia (implementación + cierre documental sin código).
STAGES: implementación T29C (query + CAS + auto-cancel + notification boundary) + tests (incluye concurrencia real de 2 repartidores) + commit + push + deploy TESTING -> certificación física del operador con dos repartidores reales PASS -> cierre documental (esta entrada, sin código).
REPORTS: codex-reports/P2_T29C_REPARTIDOR_WAITING_DRIVER_ACCEPTANCE_AND_CONCURRENCY.md, codex-reports/P2_T29C_PHYSICAL_CERTIFICATION_CLOSEOUT.md
PUSHED: SI (testing-codex únicamente) / DEPLOYED_TESTING: SI (SUCCESS, commit match) / DEPLOYED_PRODUCTION: NO / PRODUCTION_TOUCHED: NO
NOTA: P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado). P2_T29B_STATUS=CLOSED_TESTING_CERTIFIED (preservado). P2_T29C_STATUS=CLOSED_TESTING_CERTIFIED (era WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION). P2_T29_STATUS=IN_PROGRESS (T29D/T29E pendientes según autoridad del roadmap, epic completo no se marca cerrado). RELEASE_BATCH=P2_T29B_PLUS_P2_T29C queda RELEASE_BATCH_READY_FOR_PROMOTION=SI, PROMOTION_EVALUATION_POINT=NOW — pero esta tarea NO promueve nada a Production; PROMOTE_P2_T29B_PLUS_P2_T29C_TO_MAIN_AND_PRODUCTION queda como tarea separada.
```

```
TASK_ID: P2-T29B-NEGOCIO-ACCEPTED-PREPARING-WAITING-DRIVER-FLOW (+ fix focal P2-T29B-R1)
VERDICT: CLOSED_TESTING_CERTIFIED (certificación física del operador PASS, 10/10 ítems, 2026-09-09 — gate físico igual al ya aplicado en P2-T31)
REASON: activó en Negocio el flujo aceptado/preparando/esperando_repartidor sobre la autoridad que T29A dejó lista — creó NEGOCIO_T29B_ROLLOUT_FORWARD_TRANSITIONS (nuevo grafo, separado de ACTIVE_FORWARD_TRANSITIONS que el resto de los actores sigue usando sin cambios), con aristas legacy explícitas para compatibilidad durante el rollout. Activó como comportamiento real (ya no sólo autoridad pura) la cancelación de Cliente desde aceptado, adaptando tanto el endpoint como el gate de UI que decide mostrar el botón. Estableció el "waiting driver boundary": ninguna acción/botón/API de Negocio avanza esperando_repartidor a en_camino — exclusivo de T29C, todavía no implementado, comportamiento esperado y documentado. Durante la certificación física, el operador encontró que la timeline Cliente se apagaba en aceptado/esperando_repartidor (findIndex sobre array sin esos estados) y pidió una notificación dedicada para esperando_repartidor — corregido por el fix focal P2-T29B-R1 (mapping explícito estado->índice, 5 pasos domicilio con primer nodo dinámico Recibido->Aceptado, notificación "Buscando delivery") ANTES de la certificación final. Cero cambios en Repartidor/Push (salvo la nueva factory de notificación)/chat/SW/manifests/schema/migrations en toda la secuencia.
RESULT: 93 tests (T29B) + 142 tests (T29B-R1, incluye 13 nuevos de timeline puro + 3 nuevos de notificación) reales, 0 fallas nuevas en ninguna de las 2 tareas. Build/lint/typecheck/secret-scan limpios en ambas. Verificación visual LOCAL EN VIVO con clicks reales en T29B (Negocio sintético en TESTING); T29B-R1 se apoyó en cobertura de tests puros exhaustiva por estado, sin repetir la verificación visual. 2 commits (3d9f3b3 T29B, 155b4c4 T29B-R1), push exclusivo a testing-codex, deploy TESTING SUCCESS en ambos commits exactos (chat en vivo también). Production intacta en las 3 tareas (T29B, T29B-R1, y este cierre documental sin código). Certificación física final del operador: DOMICILIO 8/8 + RETIRO 2/2 = 10/10 PASS, 0 fallas.
STAGES: implementación T29B + tests + verificación visual + commit + push + deploy TESTING -> fix focal T29B-R1 (timeline + notificación) + tests + commit + push + deploy TESTING -> certificación física del operador PASS -> cierre documental (esta entrada, sin código).
REPORTS: codex-reports/P2_T29B_NEGOCIO_ACCEPTED_PREPARING_WAITING_DRIVER_FLOW.md, codex-reports/P2_T29B_R1_CLIENT_TIMELINE_AND_WAITING_DRIVER_NOTIFICATION.md, codex-reports/P2_T29B_PHYSICAL_CERTIFICATION_CLOSEOUT.md
PUSHED: SI (testing-codex únicamente, ambos commits) / DEPLOYED_TESTING: SI (SUCCESS, commit match en ambos) / DEPLOYED_PRODUCTION: NO / PRODUCTION_TOUCHED: NO
NOTA: P2_T29B_STATUS=CLOSED_TESTING_CERTIFIED (normalizado; era WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION). P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED preservado. P2_T29C_STATUS=CLOSED_TESTING_CERTIFIED (cerrado posteriormente, ver entrada P2-T29C arriba). P2_T29_STATUS=IN_PROGRESS. RELEASE_BATCH=P2_T29B_PLUS_P2_T29C — con ambas certificadas, RELEASE_BATCH_READY_FOR_PROMOTION=SI (ver entrada P2-T29C arriba para el detalle actualizado).
```

```
TASK_ID: P2-T29A-PROMOTE-TO-MAIN-AND-PRODUCTION
VERDICT: COMPLETE — checkpoint P2-T29A promovido a main/Production, tag creado
REASON: primera aplicación de la nueva política RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS (registrada en esta misma tarea) — en vez de esperar a acumular T29B-E antes de tocar main, se promovió el bloque pequeño y recién certificado de T29A (10 archivos) inmediatamente. Mismo método de release curado ya validado 2 veces (snapshot commit vía git commit-tree, sin merge genérico). Diff de promoción auditado: exactamente los 10 archivos de T29A, sin sorpresas, T29B/T29C confirmados ausentes de cualquier API/UX, 0 migrations nuevas. Batería focal (no la masiva PRE-T29): 81 tests reales (30 authority + 23 CAS + 14 order-security + 14 cancelación con 2 fallos preexistentes reproducidos idénticos contra el commit fuente sin modificar, protocolo del §12 aplicado exactamente).
RESULT: push fast-forward limpio a main (969ea77->c45fd5e). Production DeliGO desplegó SUCCESS de inmediato en el commit exacto, 0 migrations pendientes. El servicio "chat en vivo" (subdirectorio sin tocar por el diff) falló su primer intento sin causa de código — presentado al operador sin resolver unilateralmente, quien eligió reintentar el mismo commit; SUCCESS en el segundo intento, sin corte de servicio real en ningún momento (la versión anterior sirvió sin interrupción). Smoke completo PASS. main/Production coinciden exactamente en ambos servicios. Tag p2-t29a-stable-2026-09-09 creado y pusheado apuntando al SHA exacto, sólo tras confirmar todo lo anterior.
STAGES: auditoría + release + tests + push + deploy + reintento de chat + tag (todo en esta tarea).
REPORTS: codex-reports/P2_T29A_PROMOTE_TO_MAIN_AND_PRODUCTION.md
PUSHED: SI (main, fast-forward, sin force) / DEPLOYED_PRODUCTION: SI (SUCCESS ambos servicios tras 1 reintento de chat) / TAG: SI (p2-t29a-stable-2026-09-09)
NOTA: P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (avanzó desde CLOSED_TESTING_CERTIFIED). P2_T27_STATUS=MERGED_CLOSED_BY_T29A preservado. P2_T29B_STATUS=READY_TO_START. P2-T29 (completo) sigue AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION, NO se marca cerrado. Nueva política de cadencia de release registrada formalmente para aplicarse en tareas futuras.
```

```
TASK_ID: P2-T29A-ORDER-TRANSITION-AUTHORITY-CAS-AND-CONCURRENCY-TESTS
VERDICT: CLOSED_TESTING_CERTIFIED
REASON: implementó la primera fase de P2-T29 (diseñada en P2-T29-ESPERANDO-REPARTIDOR-ACCEPTANCE-REDESIGN-AUDIT-AND-DESIGN.md): extrajo src/lib/order-transitions.ts, autoridad de transición 100% pura (sin DB/HTTP/notificaciones/UI), con dos grafos deliberadamente separados — ACTIVE_FORWARD_TRANSITIONS (el vigente hoy, consumido por los endpoints) y TARGET_FORWARD_TRANSITIONS (P2-T29 con aceptado/esperando_repartidor, sin consumo productivo todavía). Cerró el gap de concurrencia que la auditoría había encontrado: Negocio usaba update() plano (sin CAS) para toda transición no-cancelación. Durante la implementación se encontró una CUARTA copia de las reglas de transición, no documentada por la auditoría original, en un endpoint de Negocio real y en uso (negocio/pedidos/route.ts PUT, usado por salon-tab.tsx) — migrada también, mismo tratamiento (F-P2-T29A-01, resuelto en la misma tarea). Operaciones/PyR y Operaciones/Salón (que ya tenían CAS completo) se migraron a consumir la misma autoridad sin cambiar comportamiento, verificado con tests mockeados dedicados.
RESULT: single-winner de CAS probado en 3 niveles (primitiva aislada sin lock vía Promise.all — simula multi-instancia Railway, la garantía real que motiva el CAS; cross-actor Negocio-vs-Operaciones/PyR; endpoint completo con lock+CAS, exactamente 1 PedidoEvento del ganador). 30 tests puros de autoridad (target graph DOMICILIO/RETIRO/MESA, cancelación en aceptado, mesa sin aceptado). Legacy compatibility verificada por integración real. 79 tests reales ejecutados (30+11+6+6+14+14 con matices), 0 fallas nuevas (2 fallos intermitentes en mesa-pedido-cancelacion.test.ts, sin ninguna relación con el fileset tocado, clasificados como la misma familia de F-P2-TESTINFRA-01). Build/lint/typecheck sin regresión. 1 commit (4b19954, parent 6c6fc58), push exclusivo a testing-codex, deploy TESTING SUCCESS en el commit exacto. Production intacta.
STAGES: implementación + tests + commit + push + deploy TESTING (todo en esta tarea).
REPORTS: codex-reports/P2_T29A_ORDER_TRANSITION_AUTHORITY_CAS_AND_CONCURRENCY_TESTS.md
PUSHED: SI (testing-codex únicamente) / DEPLOYED_TESTING: SI (SUCCESS, commit match) / DEPLOYED_PRODUCTION: NO / PRODUCTION_TOUCHED: NO
NOTA: P2_T29A_STATUS=CLOSED_TESTING_CERTIFIED (era PAUSED_PENDING_PRE_T29_PROMOTION -> READY_TO_START -> CLOSED). P2_T27_STATUS=MERGED_CLOSED_BY_T29A (T27 nunca se implementa como tarea separada). P2_T29B_STATUS=READY_TO_START (próxima fase: activar el flujo aceptado/esperando_repartidor en la API/UI de Negocio — NO implementado aquí). P2-T31/P2-T29(diseño) preservados sin cambios. Un finding de auditoría preexistente descubierto incidentalmente (F-P2-T29A-02, negocio/pedidos/route.ts nunca genera PedidoEvento) — no corregido, fuera de alcance, documentado para futuro hardening opcional.
```

```
TASK_ID: PRE-T29-PROMOTE-CERTIFIED-TESTING-TO-MAIN-AND-PRODUCTION-R2
VERDICT: COMPLETE — checkpoint pre-T29 promovido a main/Production, tag creado
REASON: tras el cierre físico de F-PRE-T29-02 (operador confirmó PASS/PASS en iPhone real), se reintentó la promoción detenida en R1 usando el nuevo HEAD certificado de testing-codex (6c6fc58) como source. Se reutilizó el método de release curado (snapshot commit vía git commit-tree, tree=source, parent=origin/main), esta vez bajo prohibición explícita total de git reset/stash/clean/rebase — la materialización del commit en el worktree aislado se logró recreándolo desde cero en vez del reset --hard usado en R1. Un hang de 15+ min en una batería de sanity-check (causado por una ruta de test inexistente en el comando, NO por el código) fue diagnosticado a fondo a pedido explícito del operador antes de continuar — sin procesos huérfanos, sin daño al worktree/repo, sin operación destructiva usada. Con autorización explícita para continuar, se reejecutó la batería completa (Push, chat, iOS/PWA, auth, legal, tracking, order/security, SuperAdmin) en grupos pequeños con timeouts finitos en foreground: 695 tests reales pasando, 0 fallas nuevas — los 6 fallos y 2 exclusiones de infraestructura se probaron 100% preexistentes reproduciéndolos idénticos contra testing-codex@6c6fc58 sin modificar (nuevo finding F-PRE-T29-03 registrado para la contaminación de datos de superadmin-auth.test.ts, no bloqueante).
RESULT: preflight final pre-push (fetch, baseline, tree, .env, secret scan) sin sorpresas. Push fast-forward limpio 1de0d3c1->969ea77 a main. Production (DeliGO + chat en vivo) desplegó SUCCESS en el commit exacto, 2 migrations aditivas aplicadas sin error, smoke no mutante PASS (4 rutas + 3 manifests + sw.js), manifest Cliente de Production confirmado start_url=/cliente sin iosDebug. testing-codex permanece intacto en 6c6fc58. Tag pre-t29-stable-2026-09-08 creado y pusheado apuntando exactamente a 969ea77, sólo después del SUCCESS+smoke.
STAGES: cierre físico F-PRE-T29-02 (evidencia del operador) + construcción de release + diagnóstico de hang + reejecución de batería + promoción completa (todo en esta tarea).
REPORTS: codex-reports/PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION_R2.md
PUSHED: SI (main, fast-forward, sin force) / DEPLOYED_PRODUCTION: SI (SUCCESS, commit match, 2 migrations) / TAG: SI (pre-t29-stable-2026-09-08)
NOTA: P2_T29A_STATUS avanza a READY_TO_START (era PAUSED_PENDING_PRE_T29_PROMOTION — el checkpoint se completó). P2-T31 preservado CLOSED_TESTING_CERTIFIED, P2-T29 preservado AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION. DeliGO sigue NOT_PUBLISHED — este checkpoint no constituye lanzamiento público. Findings de Android/PWA/lint-typecheck históricos preservados sin corregir.
```

```
TASK_ID: PRE-T29-FIX-MANIFEST-CLIENTE-IOSDEBUG-FLAG-TESTING
VERDICT: IMPLEMENTED_COMMITTED_PUSHED_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION (NO cierra F-PRE-T29-02 todavía — falta confirmación física en iPhone real)
REASON: corrigió el finding F-PRE-T29-02 (encontrado en PRE-T29-PROMOTE-CERTIFIED-TESTING-TO-MAIN-AND-PRODUCTION), que detuvo esa promoción: public/manifest-cliente.json tenía "start_url": "/cliente?iosDebug=1" hardcodeado, sin ningún condicional de entorno, lo que habría activado por defecto el panel de diagnóstico iOS en cualquier instalación nueva de la PWA Cliente en Production. Root cause confirmado por lectura directa (manifest estático, sin escritor runtime del flag, panel activado únicamente por query param). Fix: revertir únicamente ese campo a "/cliente", preservando el mecanismo manual (/cliente?iosDebug=1 sigue activando isIosDebugFlagEnabled sin cambios). Se auditaron los 7 manifests restantes (sin hallazgos), el Service Worker (nunca cachea URLs con "manifest", sin necesidad de bump), y se clasificaron todas las ocurrencias activas de "iosDebug" en el árbol (gates manuales legítimos vs. el único manifest default corregido). Se actualizó el contrato de test autoritativo (ios-pwa-debug-launch-static-contract.test.ts, incluye nuevo test de comportamiento real, no sólo texto fuente) y se revirtió pwa-identity.test.ts al valor canónico.
RESULT: 11/11 tests de contrato de manifest PASS, 87/89 de la batería ampliada de iOS/PWA (2 fallas confirmadas 100% preexistentes e idénticas antes/después vía git stash controlado del propio HEAD sin cambios), typecheck 24 raw idéntico (0 nuevos), lint/diff-check/build limpios. 1 commit (6c6fc581ad678883f4e9fbcb9dbf8e90ecf63912, parent 818b627), push exclusivo a testing-codex, deploy autodisparado a Railway TESTING/"DeliGO Copy" SUCCESS en el commit exacto, manifest servido verificado en vivo (start_url=/cliente, sin iosDebug), GET /cliente y GET /cliente?iosDebug=1 ambos 200. Production no fue tocada ni releída (mismo deployment bf242d3b, mismo commit 1de0d3c1).
STAGES: fix único + commit + push + deploy TESTING (esta tarea) — falta la confirmación física en iPhone real antes de reintentar la promoción.
REPORTS: codex-reports/PRE_T29_FIX_MANIFEST_CLIENTE_IOSDEBUG_FLAG_TESTING.md
PUSHED: SI (testing-codex únicamente) / DEPLOYED_TESTING: SI (SUCCESS, commit match) / DEPLOYED_PRODUCTION: NO / PRODUCTION_TOUCHED: NO
NOTA: F-PRE-T29-02 pasa de OPEN a FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION — sigue bloqueando la promoción y cualquier lanzamiento público hasta el PASS físico. P2_T29A_STATUS permanece PAUSED_PENDING_PRE_T29_PROMOTION. Próxima acción tras el PASS físico: reintentar PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION usando 6c6fc58 como nuevo RC source.
```

```
TASK_ID: PRE-T29-PROMOTE-CERTIFIED-TESTING-TO-MAIN-AND-PRODUCTION
VERDICT: STOPPED_BEFORE_PUSH_BY_OPERATOR_DECISION (NI CLOSED NI ROLLED_BACK_FAILED — la tarea llegó lejos en la construcción del release pero se detuvo antes de cualquier push, por decisión explícita del operador tras encontrar un bug real)
REASON: tarea de promoción real, autorizada explícitamente (MAIN_PUSH_AUTHORIZED=SI, PRODUCTION_DEPLOY_AUTHORIZED=SI, TAG_CREATE/PUSH_AUTHORIZED=SI, PUBLIC_RELEASE_AUTHORIZED=NO), siguiendo el método de release curado ya documentado en OPERATIONS_SECURITY_PRODUCTION_PROMOTION_R1.md. Se construyó y verificó exitosamente, en un worktree aislado, un commit snapshot (git commit-tree, tree=testing-codex@818b627, parent=origin/main tip) con trailers Source-Head/Source-Merge-Base — TREE_EQUIVALENCE_TO_TESTING_HEAD=SI (byte a byte), T29_PRODUCT_IMPLEMENTATION_PRESENT=NO, SECRET_LEAK=NO, dependencias sin drift. Durante la revisión focal de diagnósticos iOS que la propia tarea exige, se encontraron 2 gaps: (1) Production carecía de preDeployCommand para ejecutar las 2 migraciones aditivas pendientes — resuelto con autorización explícita del operador (AskUserQuestion), agregando el mismo mecanismo ya probado en TESTING vía railway api serviceInstanceUpdate, sin disparar deploy no deseado; (2) public/manifest-cliente.json tiene ?iosDebug=1 hardcodeado en start_url, sin condicional de entorno — activaría el panel de diagnóstico iOS por defecto en instalaciones NUEVAS del Cliente PWA en Production (seguro, sin PII/secretos, pero comportamiento no intencional). Presentado al operador sin resolver unilateralmente; el operador eligió la opción MÁS conservadora: detener la promoción por completo y corregir el manifest en testing-codex primero, en vez de un fix en vivo o promover tal cual.
RESULT: el release commit construido (245abcfa8, LOCAL únicamente) fue descartado sin pushear; branch y worktree temporales eliminados. testing-codex, origin/testing-codex y origin/main quedaron confirmados exactamente en su SHA de partida (818b627.../1de0d3c1...) — cero push, cero tag, cero deploy de código nuevo. El preDeployCommand de Production agregado permanece vigente (fix independiente, retenido). Nuevo finding F-PRE-T29-02 registrado (BLOQUEA esta promoción y cualquier lanzamiento público hasta corregirse).
STAGES: construcción de release + 2 decisiones de operador (esta tarea) — el reintento de esta misma promoción requiere primero una tarea separada en testing-codex que corrija el manifest.
REPORTS: codex-reports/PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION.md
PUSHED: NO / DEPLOYED_TESTING: NO / DEPLOYED_PRODUCTION: NO / PRODUCTION_TOUCHED: SI (sólo preDeployCommand, config, sin deploy de código nuevo)
NOTA: P2_T29A_STATUS permanece PAUSED_PENDING_PRE_T29_PROMOTION (NO pasa a READY_TO_START — la promoción no se completó). P2-T31 preservado CLOSED_TESTING_CERTIFIED, P2-T29 preservado AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION.
```

```
TASK_ID: PRE-T29 (Production Env Precondition) — GOOGLE_OAUTH_PENDING_SECRET
VERDICT: BLOCKER_RESOLVED (NO cierra ni ejecuta la promoción de código — sólo resuelve la precondición de entorno que la bloqueaba)
REASON: PRE_T29_PRODUCTION_PROMOTION_READINESS_AUDIT.md encontró un único blocker (PROMOTION_READY=NO): `GOOGLE_OAUTH_PENDING_SECRET`, requerida sin fallback por src/lib/google-oauth-pending.ts, ausente en las variables de Railway Production. Esta tarea generó un secret NUEVO y DEDICADO (CSPRNG local, 64 caracteres, nunca reutilizado de TESTING ni de otro secret existente) y lo aplicó EXCLUSIVAMENTE a Railway Production/servicio "DeliGO" — confirmando el target explícitamente antes de mutar (el contexto CLI enlazado por defecto apuntaba a TESTING, no a Production). El valor nunca se expuso en ningún output/reporte — presencia verificada por conteo de nombre, longitud verificada aritméticamente.
RESULT: PRODUCTION_GOOGLE_OAUTH_PENDING_SECRET_PRESENT=SI (longitud 64, válida). El cambio disparó un redeploy automático del MISMO commit (1de0d3c1, SUCCESS, sin cambio de código), smoke no mutante PASS en las 4 rutas principales de deligo.ar. TESTING y el resto de variables de Production confirmadas sin cambios (diff de nombres: +1 exacto, 0 removidas/modificadas). `PREVIOUS_PROMOTION_BLOCKER_RESOLVED=SI`, `PRE_T29_PROMOTION_CAN_NOW_PROCEED=SI` — de las 17 condiciones de PROMOTION_READY, todas quedan satisfechas ahora.
STAGES: precondición única (esta tarea) — la promoción real de código requiere su propia tarea futura, con autorización explícita de commit/push/deploy.
REPORTS: codex-reports/PRE_T29_PRODUCTION_GOOGLE_OAUTH_PENDING_SECRET_PRECONDITION.md
PUSHED: NO / DEPLOYED_TESTING: NO / DEPLOYED_PRODUCTION: NO (mismo código, sólo redeploy por cambio de env) / PRODUCTION_TOUCHED: SI (1 variable de entorno)
NOTA: Esta entrada NO promueve código — registra la resolución de la única precondición pendiente. main y Production siguen exactamente en 1de0d3c1. P2-T29A sigue sin iniciar.
```

```
TASK_ID: PRE-T29 (Production Promotion Readiness) — AUDITORÍA
VERDICT: PROMOTION_READY=NO (NO cierra ni ejecuta ninguna promoción — sólo la auditoría de disponibilidad)
REASON: auditoría exhaustiva read-only de si el HEAD certificado de testing-codex (818b627) puede promoverse técnicamente a main/Production antes de iniciar P2-T29A. Encontró que la historia de main/testing-codex está DIVERGIDA (4 commits exclusivos de main, 61 de testing-codex) — pero confirmó, con evidencia directa (trailers `Source-Commit:` en los 4 commits de main + el reporte histórico `OPERATIONS_SECURITY_PRODUCTION_PROMOTION_R1.md`), que DeliGO ya usa una convención establecida de "release curado" (verificado byte a byte, aplicado sobre el HEAD real de main, nunca un merge de toda la historia) — no una divergencia problemática. Un merge genérico, simulado 100% read-only vía `git merge-tree --write-tree` (sin tocar working tree/index/HEAD), produciría 4 conflictos textuales reales, confirmando que la convención curada sigue siendo la correcta. Auditó migrations (2 nuevas, ambas aditivas y ya certificadas en TESTING), schema, dependencias (idénticas), variables de entorno (comparación segura por nombre, sin leer valores), diagnósticos de TESTING (revalidados como seguros post-promoción), secretos (scan limpio del diff completo de 222 archivos), y corrió una batería de 1177 tests + build + typecheck sobre el RC candidato, sin ninguna falla nueva (9 preexistentes ya documentadas).
RESULT: PROMOTION_READY=NO por un ÚNICO blocker, mecánico y acotado: `GOOGLE_OAUTH_PENDING_SECRET` (requerido por el callback de Google OAuth para identidades nuevas, sin fallback) está ausente en las variables de Railway de Production — confirmado por nombre, sin leer ningún valor. De las 17 condiciones de cierre de la tarea, 16 ya se cumplen. Se diseñó (sin ejecutar) la estrategia completa de la futura tarea de promoción: release curado, tag `pre-t29-stable-2026-09-08`, mecanismo de deploy (autodeploy Git + preDeployCommand de Prisma), smoke checklist no mutante, plan de rollback. Se distinguió explícitamente "promoción técnica pre-lanzamiento" de "listo para lanzamiento público" — DeliGO NO está publicado, el finding de aislamiento de sesión Android Cliente/Repartidor sigue bloqueando lo segundo, no lo primero.
STAGES: auditoría única (esta tarea) — la promoción real requiere una tarea futura separada, con autorización explícita de mutación de variables Railway (paso 1: agregar la variable faltante) y de commit/push/deploy a Production.
REPORTS: codex-reports/PRE_T29_PRODUCTION_PROMOTION_READINESS_AUDIT.md
PUSHED: NO / DEPLOYED_TESTING: NO / DEPLOYED_PRODUCTION: NO / PRODUCTION_TOUCHED: NO
NOTA: Esta entrada NO promueve nada — registra la auditoría de disponibilidad como completa. P2-T29A sigue sin iniciar; la promoción a Production, si se autoriza, debe ocurrir ANTES de T29A según el objetivo del operador.
```

```
TASK_ID: P2-T29 (Esperando Repartidor Acceptance Redesign) — AUDITORÍA Y DISEÑO
VERDICT: AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION (NO implementado — esta entrada NO cierra P2-T29, sólo su fase de diseño)
REASON: auditoría profunda read-only del lifecycle completo de pedidos, 100% desde código real (schema, 3 copias independientes de reglas de transición, endpoint de aceptación atómica de repartidor, notificaciones, UI de los 3 roles, tests existentes). Reconstruyó el grafo actual y probó, leyendo código, que `en_camino` está sobrecargado (significa tanto "negocio buscando repartidor" como "repartidor asignado en camino", con evidencia de UI ambigua en `orders-tab.tsx`). Diseñó el grafo objetivo: DOMICILIO y RETIRO reciben `aceptado`; MESA no (sin ventana de decisión remota que lo justifique). Estado de espera canónico recomendado: `esperando_repartidor` (mecanismo real es polling pasivo de 8s, no dispatch activo). `estado` es un `String` Prisma sin enum/CHECK — cero migration necesaria. La aceptación atómica del repartidor ya usa un CAS real (`updateMany` con condición de estado en el WHERE) y es segura hoy, pero no tiene ningún test de concurrencia — gap crítico para la fase de implementación. P2-T27 (nunca implementado, `QUEUED` desde su creación) se recomienda fusionar a T29A en vez de precederlo. P2-T28 estableció que sólo `cancelado` usa CAS — T29A cierra ese residual.
RESULT: P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION. Diseño completo entregado: matriz de notificaciones (10 transiciones), matriz de UI por rol, matriz de cancelación por estado/actor, timeouts (auto-cancel de 30 min ya existe y es seguro), plan de compatibilidad legacy sin backfill, inventario de tests (casi nulo para transiciones), y 5 fases de implementación (T29A autoridad+CAS+tests → T29B Negocio → T29C Repartidor → T29D Cliente/notificaciones → T29E compatibilidad/regresión/TESTING). 2 preguntas de producto quedan explícitamente abiertas para el operador (cancelación de Cliente en `aceptado`; si mesa también recibe `aceptado`) — ninguna implementación empieza sin esas respuestas. Cero cambios de producto/tests/DB.
STAGES: auditoría y diseño único (esta tarea) — próxima etapa real es T29A, no iniciada.
REPORTS: codex-reports/P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md
PUSHED: NO / DEPLOYED_TESTING: NO / PRODUCTION_TOUCHED: NO
NOTA: Esta entrada NO cierra P2-T29 — registra la fase de diseño/auditoría como completa. La implementación (T29A-E) requiere una tarea futura separada, con autorización explícita de commit/push/deploy, y resolución previa de las 2 preguntas de producto abiertas.
```

```
TASK_ID: P2-T31 (Notification Switch + Web Push) — CIERRE FINAL (R21)
VERDICT: CLOSED_TESTING_CERTIFIED
REASON: R21 (auditoría final read-only) verificó las 8 condiciones de cierre: (1) matriz física de Push completa en los 3 roles/2 plataformas (Cliente CERTIFIED_TESTING iPhone+Android; Negocio/Repartidor CERTIFIED_TESTING iPhone, PASS/short-smoke Android); (2) routing de íconos por rol físicamente PASS (R22A); (3) tap de notificación de chat físicamente PASS Android+iPhone cold+warm (R23C); (4) safe-area de chat en iOS físicamente PASS — listado, conversación, teclado, control Android (R24); (5) sin diagnóstico temporal peligroso/visible a usuario normal; (6) sin exposición de secretos/PII; (7) sin cleanup obligatorio de Push pendiente; (8) todo residual restante es no-bloqueante/epic-separado/deuda-UX. Inventario exhaustivo de diagnósticos R6/R6A/R6B/R7/R19R1 (PushDebugPanel, trace timeline, snapshot, bootstrap) verificado por lectura DIRECTA del código real como `SAFE_TESTING_DIAGNOSTIC` (gate server-side fail-closed 404 en Production, fingerprints no reversibles, sólo lectura, sin salir del origen) — la condición de retención de R10 (hasta certificación física de Android) ya se cumplió, pero en vez de disparar un cleanup se reclasificó a retención PERMANENTE, porque retirar código seguro y bien diseñado sería desperdicio. `P2_T31_R21A_CLEANUP_REQUIRED=NO` — no se diseñó ninguna tarea de cleanup adicional.
RESULT: P2_T31_STATUS=CLOSED_TESTING_CERTIFIED. FINAL_PUSH_DIAGNOSTICS_DISPOSITION=RETAIN_SAFE_PERMANENT_ONLY. Recheck read-only de suites focales sin regresión: chat-provider-deep-link-hydration 21/21, sw-notificationclick-target-routing 6/6, chat-ios-safe-area-static-contract 12/12, Push completa 607/607 (34 archivos). Findings preservados SEPARADOS del cierre (no pertenecen al pipeline de Push, no bloquean T31): ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (production readiness general, causa raíz diferida a tarea futura), ANDROID_PWA_INSTALL_COMPLETION_UX_FINDING=OPEN (UX general), PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN, ANDROID_MONOCHROME_BADGE_UX_TASK_REQUIRED=SI, SW_ICON_CACHE_BYPASS_SUBSTRING_FINDING=OPEN_NON_BLOCKING, UNSUBSCRIBE_STALE_GUARD_FINDING=OPEN_NON_BLOCKING_QUEUED, 5 fallas preexistentes en ios-standalone-post-keyboard-nav-occlusion-r6-static-contract.test.ts (no introducidas por ninguna tarea reciente).
STAGES (epic completo): R1-R20 (implementación/hardening/diagnóstico de la certificación Push cross-platform) -> R22 (root-cause de routing de íconos, PROVEN) -> R22A (fix + TESTING deploy, commit ed58ca4) -> R23 (confirmación física de íconos + nuevo finding de chat tap) -> R23A (fix de hidratación de chat, commit 23c038a, retest físico FALLÓ) -> R23B (causa raíz adicional PROVEN vía reproducción de código real, read-only) -> R23C (fix del guard de useChatActorReset, commit 1bd953a, TESTING deploy) -> R24 (auditoría y fix de iOS Chat safe-area, commit 818b627, TESTING deploy) -> R21 (reconciliación física final de R23C y R24, disposición de diagnósticos, CIERRE)
FINAL_CERTIFIED_TESTING_COMMIT: 818b627b472e03e80034c047a51dfd3491f3add3
FINAL_CERTIFIED_TESTING_DEPLOYMENT: 1f025eba-02ed-469c-9412-3c3c740d4550 (DeliGO Copy, SUCCESS, commit exacto confirmado)
PRODUCTION_TOUCHED: NO (Production permanece en 1de0d3c153eaf3be068adeb004ea43feb42fc40e — ningún commit de P2-T31 fue promovido; decisión de promoción fuera de alcance de R21, sin autorizar)
REPORTS: codex-reports/P2_T31_R21_FINAL_DIAGNOSTICS_DISPOSITION_AND_CLOSEOUT.md (síntesis final — ver también las entradas de sub-etapa abajo para el detalle histórico completo)
NOTA: Esta entrada CIERRA el epic completo P2-T31. La entrada de sub-etapa "R22/R22A" justo abajo permanece como registro histórico del routing de íconos específicamente — su NOTA original ("P2-T31 sigue IN_PROGRESS") queda SUPERADA por esta entrada.
```

```
TASK_ID: P2-T31 (Notification Switch + Web Push) — SUB-ETAPA R22/R22A (Android Push Notification Icon Routing)
VERDICT: PASS_SUBSTAGE_ICON_ROUTING_ONLY (P2-T31 en sí NO cierra — ver P2-T31-R23 justo abajo, que abrió un finding nuevo e independiente de tap de chat)
REASON: R22 probó, ejecutando el `sw.js` real, que `order_update`/`review`/`chat` son notifType compartidos entre roles y que el Service Worker resolvía el ícono de notificación SÓLO por `notifType` (ignorando `data.role`, ya existente y ya entregado) — causando que Android Cliente/Repartidor vieran el ícono de Negocio en algunos casos. R22A implementó el fix mínimo (usar `data.role` como criterio primario, fallback legacy intacto), lo desplegó a TESTING (commit ed58ca4) y R23 reconcilió la confirmación física final: los 3 roles (Cliente, Negocio, Repartidor) PASS en Android.
RESULT: ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING. R22A_CLIENT_ICON_PHYSICAL=PASS, R22A_NEGOCIO_ICON_PHYSICAL=PASS, R22A_REPARTIDOR_ICON_PHYSICAL=PASS. Backend sin cambios (data.role ya existía). notificationclick/delivery/subscription/dedupe sin tocar. 30 tests nuevos (26 ejecutando el sw.js real en VM sandbox + 4 de data.role directo), suite Push 607/607, sin regresiones. Production intacta.
FINDING_FOR_FUTURE: durante la confirmación física de R22A, el operador reportó un finding NUEVO e independiente: el TAP de la notificación de chat (Cliente→Negocio) no abre el chat correcto, ni en Android ni en iPhone — auditado en P2-T31-R23 (causa STRONGLY_SUPPORTED, fix de hidratación diseñado), IMPLEMENTADO y desplegado a TESTING en R23A (commit 23c038a), pero el retest físico del operador FALLÓ de nuevo en ambas plataformas. R23B (read-only) probó, con reproducción de código real, una causa raíz ADICIONAL e independiente, PROVEN: `useChatActorReset` (`src/providers/chat-provider.tsx`) borraba el chat-store en el mismo commit de React en que `useChatDeepLink` lo abría, cuando `auth-store` rehidrata `user`+`_hasHydrated` sincrónicamente. R23C implementó y desplegó el fix de ese root cause (commit 1bd953a) — `useChatActorReset` ya no resetea en la transición `null -> primer actor real`, preservando el reset en cualquier cambio de actor genuino o logout. El fix de R23A tampoco se tocó ni se revirtió. **R24 reconcilió la confirmación física final: 4/4 combinaciones (Android/iPhone x cold/warm) PASS — este finding queda CERRADO** (`PUSH_CHAT_NOTIFICATION_TAP_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING`). Además, R23C corrigió formalmente el finding de sesión Cliente/Repartidor Android: la evidencia física ampliada descartó que la cuenta de Google fuera el factor discriminante (falla en Android con la misma cuenta Y con cuentas distintas; en iPhone la misma cuenta SÍ funciona) — re-registrado como `ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING`, causa raíz diferida a tarea futura (SIGUE abierto, no relacionado al finding de chat). R24 auditó y corrigió, con fix desplegado a TESTING pendiente de confirmación física, el finding SEPARADO de iOS Chat safe-area (`F-P2-T31-R23A-02`) — ESE es el finding que mantiene P2-T31 abierto ahora.
STAGES: R22 (root-cause audit, causa PROVEN) -> R22A (fix implementado + testeado + commit ed58ca4 + TESTING deploy) -> R23 (confirmación física reconciliada + nuevo finding de chat tap auditado, no corregido en R23) -> R23A (fix de hidratación implementado + desplegado, commit 23c038a, retest físico FALLÓ) -> R23B (read-only, causa raíz adicional PROVEN vía reproducción de código real, fix de R23C diseñado pero no implementado) -> R23C (fix del guard de useChatActorReset implementado + testeado + commit 1bd953a + TESTING deploy; finding Google corregido) -> R24 (R23C confirmado físicamente 4/4 PASS, CERRADO; auditoría y fix de iOS Chat safe-area implementado + testeado + commit 818b627 + TESTING deploy, pendiente confirmación física)
COMMIT: ed58ca47a522b8190c41283818d1742887f24d31 "fix: route push notification icons by recipient role" (3 archivos)
REPORTS: codex-reports/P2_T31_R22_ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_ROOT_CAUSE_AUDIT.md, codex-reports/P2_T31_R22A_ANDROID_PUSH_NOTIFICATION_ROLE_ICON_ROUTING_FIX_TESTING_DEPLOY.md, codex-reports/P2_T31_R23_CHAT_PUSH_NOTIFICATION_TAP_DEEPLINK_ROOT_CAUSE_AUDIT.md
PUSHED: SI (testing-codex only)
DEPLOYED_TESTING: SI (DeliGO Copy, deployment 34f5cf79-25bd-4d7a-855c-287d8bacdc4a, commit exacto confirmado)
PRODUCTION_TOUCHED: NO
NOTA: Esta entrada cierra específicamente el SUB-finding de routing de íconos. P2-T31 (el epic completo) fue CERRADO por R21 — ver la entrada "CIERRE FINAL (R21)" arriba (`P2_T31_STATUS=CLOSED_TESTING_CERTIFIED`). Esta nota histórica ("sigue IN_PROGRESS, bloqueado por chat tap") queda SUPERADA — se preserva sin editar como registro de lo que se sabía en ese momento.
```

```
TASK_ID: DELIGO-BRANDING-R1/R1A (PWA Role Icon Refresh)
VERDICT: DEPLOYED_TESTING_PENDING_PHYSICAL_VISUAL_CHECK (no CLOSED — el operador debe confirmar visualmente el launcher/ícono instalado antes de considerar esto certificado)
REASON: Refresh completo de los 5 íconos de rol (Cliente naranja, Negocio turquesa, Repartidor azul, Admin violeta, Operaciones rojo) con los assets oficiales provistos por el operador, implementado local (R1), revisado independientemente contra Git/archivos reales, commiteado y desplegado a TESTING (R1A)
RESULT: 4 roles (Cliente/Negocio/Repartidor/Admin) refrescaron contenido en el mismo path de archivo de siempre (cero cambio de wiring); Operaciones dejó de prestar el ícono de Negocio (paths nuevos icon-operaciones-192x192.png/512x512.png); CACHE_NAME de sw.js subido deligo-v14->deligo-v15 con evidencia directa de que su bypass de cache para íconos nunca funcionaba; 52 tests focales + 577 Push en 0 fail; 16 smokes HTTP post-deploy pasaron con bytes idénticos al commit. Sin cambios de lógica Push/auth/pedidos. Esta es la PRIMERA tarea de todo el historial en trackear un archivo de codex-reports/ en git (el propio reporte de R1) — explícitamente autorizado por R1A, no una decisión unilateral.
FINDING_FOR_FUTURE: (1) PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN — los assets nuevos son 100% opacos con texto de rol cerca del borde, sin margen de safe-zone auditable sin inventar fondo; bloquea certificación de Production futura, no bloquea TESTING. (2) SW_ICON_CACHE_BYPASS_SUBSTRING_FINDING=OPEN_NON_BLOCKING — el bug del substring roto en sw.js sigue sin corregirse, requerirá repetir el bump de CACHE_NAME en cualquier refresh futuro. (3) ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=OPEN — Android Cliente mostró el ícono de Negocio en una notificación Push real; iPhone equivalente correcto; causa raíz no auditada; este finding bloquea el closeout de P2-T31 (epic separado, no de esta tarea).
STAGES: R1 (implementación local + tests, blocked inicialmente por assets fuente no accesibles, resuelto) -> R1A (review independiente + commit + push + TESTING deploy + smokes + reconciliación, incluyendo evidencia física NUEVA de Push por rol reportada por el operador durante la review)
COMMIT: 1d3f58a1ea5487d254b51fa8627b5935065bce3a "feat: refresh DeliGO role icons" (15 archivos)
REPORTS: codex-reports/DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md, codex-reports/DELIGO_BRANDING_R1A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY.md
PUSHED: SI (testing-codex only)
DEPLOYED_TESTING: SI (DeliGO Copy, deployment 976a7fa7-b607-40e2-8cb4-22907f005d22, commit exacto confirmado)
PRODUCTION_TOUCHED: NO
NOTA: Esta tarea NO es parte de la numeración P2-Txx ni de P2-T31 — es un workstream de branding independiente. No cierra ni avanza P2-T31; el finding (3) de arriba lo mantiene abierto.
```

```
TASK_ID: P2-T31 (Notification Switch + Web Push) — SUB-ETAPA R10/R11 (tarea completa AÚN NO CERRADA — ver VERDICT)
VERDICT: PASS_SUBSTAGE_CLIENT_ONLY (R10 declaró CLOSED_TESTING_CERTIFIED; CORREGIDO por R11 — ver NOTA DE CORRECCIÓN)
DATE: 2026-09-06
REASON: R10 certificó físicamente la matriz Cliente C1-C8 en un iPhone Home-Screen PWA real contra el commit TESTING vigente, tras dos fixes funcionales (R7 flicker de estado inicial, R8 rate-limit 429 + semántica de error de status) y la instrumentación de diagnóstico R6/R6A/R6B. R10 declaró esto suficiente para cerrar TODO P2-T31. R11 auditó la autoridad original (P2_T31_TESTING_DEPLOY_PENDING_IPHONE_MATRIX_CERTIFICATION.md) y determinó que esa autoridad exigía, en lenguaje imperativo y sin excepción, evidencia física de los TRES roles (Cliente C1-C8, Negocio N1-N7, Repartidor R1-R7) para cerrar P2-T31 — código/tests compartidos entre roles NO sustituyen ese gate físico. El cierre de R10 fue, por tanto, prematuro para el alcance GLOBAL (la certificación de Cliente en sí es válida y se preserva intacta).
RESULT (preservado, válido): IPHONE_CLIENT_PUSH_MATRIX=C1_THROUGH_C8_PASS (C1 clean first enable con prompt nativo real; C2 rapid toggle vía stress R8; C3 remounts 5/5 sin flicker; C4 cold reopen sin falso OFF; C5 persistencia OFF básica + stress 8/8 ciclos sin 429; C6/C7 push real foreground/background; C8 tap de notificación a destino correcto). IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (alcance: Cliente, TESTING — no Production). ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED (sin dispositivo físico disponible). Residuales no bloqueantes preservados: AUTH_HYDRATION_PUSH_RACE (OPEN_STRUCTURAL_GAP_PROVEN_IMPACT_PLAUSIBLE_NOT_CONFIRMED), PUSH_LIMITER_DISTRIBUTION_MODEL=IN_MEMORY_PROCESS_LOCAL.
NOTA DE CORRECCIÓN (R11, 2026-09-06): F-P2-T31-R10-01 reclasificado de OPEN_NON_BLOCKING_SCOPE_NOTE a OPEN_BLOCKING_MISSING_REQUIRED_PHYSICAL_MATRIX. P2_T31_STATUS corregido de CLOSED_TESTING_CERTIFIED a IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX. Evidencia incidental nueva registrada (no cierra el gate): Leonardo probó Negocio informalmente tras R7/R8 y las notificaciones — antes rotas — ahora funcionan (BUSINESS_PUSH_INCIDENTAL_EVIDENCE=PASS_OBSERVED), sin la estructura de diagnóstico completa que exige un N#=PASS formal. R11 preparó (sin ejecutar) la matriz N1-N7/R1-R7 e instrucciones exactas para Leonardo, reutilizando los diagnósticos ya desplegados sin reinstalar la PWA. DECISIÓN DEL OPERADOR (vigente): los diagnósticos R6/R6A/R6B se RETIENEN intactos — PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE — sin cleanup. Producto no modificado en R9/R10/R11 (audit-only); Production nunca tocada por T31 (sigue en 1de0d3c1...).
STAGES: R1 (fix switch-state, 3 roles) -> R2 (cross-remount registry) -> R3 (VAPID stale audit) -> R4 (arquitectura, sin código) -> R5 (VAPID validation, 4 superficies) -> R5A (failure-contract hardening) -> DEPLOY (a8ac961b) -> R6/R6A/R6B (diagnóstico físico, instrumentación) -> R7 (fix flicker estado inicial + DEPLOY 6380ba2) -> R8 (fix rate-limit 429 + semántica de error + DEPLOY 70d3f826) -> R9 (reconciliación evidencia física C2-C8, C1 identificado pendiente) -> R10 (nueva evidencia física C1, cierre GLOBAL prematuro) -> R11 (auditoría de autoridad, corrección: P2-T31 REABIERTO, Cliente preservado)
COMMIT: 70d3f826bef291f403f0e42e007187eb1b5d6688 "fix: separate push status and mutation limits" (TESTING commit vigente; cadena completa de commits en codex-reports/GIT_DEPLOY_HISTORY.md)
REPORTS: codex-reports/P2_T31_NOTIFICATION_SWITCH_PERSISTENCE_STATE_SYNC_R1.md, .../P2_T31_R2_FIRST_SUBSCRIBE_REMOUNT_STATE.md, .../P2_T31_R3_ANDROID_WEB_PUSH_DELIVERY_CROSS_ENV_AUDIT.md, .../P2_T31_R4_WEB_PUSH_REFERENCE_ARCHITECTURE_CONFORMANCE_AUDIT.md, .../P2_T31_R5_VAPID_STALE_SUBSCRIPTION_VALIDATION_EXTENSION.md, .../P2_T31_R5A_PUSH_SUBSCRIPTION_FAILURE_CONTRACT_HARDENING.md, .../P2_T31_TESTING_DEPLOY_PENDING_IPHONE_MATRIX_CERTIFICATION.md, .../P2_T31_R6_INTERMITTENT_IPHONE_PUSH_LIFECYCLE_DIAGNOSTIC.md, .../P2_T31_R6A_PUSH_LIFECYCLE_TIMELINE_DIAGNOSTIC.md, .../P2_T31_R6B_STANDALONE_PWA_DEBUG_ACCESS_AND_COLD_BOOTSTRAP.md, .../P2_T31_R6B_TESTING_DIAGNOSTIC_DEPLOY_PENDING_PHYSICAL_TRACE.md, .../P2_T31_R7_PUSH_INITIAL_UNKNOWN_STATE_FLICKER_FIX.md, .../P2_T31_R7_TESTING_DEPLOY_PENDING_C4_PHYSICAL_RETEST.md, .../P2_T31_R8_PUSH_RATE_LIMIT_429_STATE_CONSISTENCY_FIX.md, .../P2_T31_R8_TESTING_DEPLOY_PENDING_STRESS_PHYSICAL_RETEST.md, .../P2_T31_R9_IPHONE_PHYSICAL_CERTIFICATION_RECONCILIATION.md, P2_T31_R10_IPHONE_CERTIFICATION_FINAL_CLOSEOUT.md, P2_T31_R11_MULTIROLE_PHYSICAL_SCOPE_AUTHORITY_CORRECTION.md
NOTA: P2-T31 continúa IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX — NO está en esta lista como tarea completa; esta entrada documenta el estado de la sub-etapa R10/R11 y su corrección, tal como se hizo con la entrada R1 más abajo. Se moverá a un cierre real de P2-T31 sólo cuando Negocio y Repartidor tengan evidencia física formal (o una autoridad explícita los exima).
```

```
TASK_ID: P2-T26 (SuperAdmin Notifications End-to-End)
VERDICT: CLOSED_TESTING_CERTIFIED
REASON: Auditoría completa + remediación de 5 tipos faltantes + normalización de catálogo + certificación runtime de las 6 categorías finales contra TESTING desplegado
RESULT: Catálogo final = 6 triggers (negocio_pendiente, denuncia_nueva, destacado_solicitud, negocio_deuda, review_moderation nueva solicitud, review_moderation información adicional); `superadmin_identidad_nueva` retirado del catálogo runtime tras probarse matemáticamente inerte (recipients siempre []) en el modelo de identidad actual; 6/6 implementados y 6/6 certificados con trigger runtime explícito contra TESTING; aislamiento de rol, badge/read, payload sin PII sensible verificados; sólo in-app, sin Web Push; Production intacta
STAGES: R1 (auditoría) -> R2 (remediación) -> R2A (prueba de inercia de identidad) -> R2B (normalización de catálogo) -> R2-COMMIT-TESTING-DEPLOY -> R2C (certificación runtime del trigger restante)
COMMIT: 642da152cbc29fb8880ef4dc7bd3a7c6d6ca42f7 "feat: complete superadmin in-app notifications" (12 archivos)
REPORTS: codex-reports/P2_T26_SUPERADMIN_NOTIFICATIONS_END_TO_END_AUDIT_R1.md, .../P2_T26_R2_SUPERADMIN_NOTIFICATIONS_REMEDIATION.md, .../P2_T26_R2A_SUPERADMIN_IDENTITY_NOTIFICATION_WIRING_CERTIFICATION.md, .../P2_T26_R2B_SUPERADMIN_NOTIFICATION_CATALOG_NORMALIZATION.md, .../P2_T26_TESTING_DEPLOY_CERTIFICATION.md, .../P2_T26_R2C_REVIEW_ADDITIONAL_INFO_RUNTIME_CERTIFICATION.md
PUSHED: SI (testing-codex only)
DEPLOYED_TESTING: SI (DeliGO Copy, commit exacto confirmado)
PRODUCTION_TOUCHED: NO
```

```
TASK_ID: P2-T28 (Order State Lock Ownership Hardening)
VERDICT: CLOSED_TESTING_CERTIFIED_NO_BUG
REASON: La sospecha inicial (mismo patrón de foreign-lock-release que P2-T25-R2C) resultó ser un falso positivo — estructuralmente distinta, ya segura
RESULT: `acquireLock` en estado/route.ts vive FUERA del try/finally (a diferencia del bug real corregido en pedidos/route.ts) — un acquire fallido nunca llega al finally, nunca libera un lock ajeno; confirmado empíricamente (no sólo por lectura) vía un seam de test dedicado (PATCH_FOR_TESTS/PedidoEstadoRouteTestHooks); test permanente de regresión agregado; sin cambio de comportamiento de producto; TESTING certificado
FINDING_FOR_FUTURE: las transiciones de estado NO-cancelación no tienen DB-level CAS (dependen sólo del lock process-local) — sólo `cancelado` tiene CAS; antes de escalar a >1 réplica de la app, esto necesita optimistic concurrency real (relevante para P2-T27)
COMMIT: 913d20e7f88375675b870e2adf9216fe56edcee0 "test: certify order state lock ownership" (2 archivos)
REPORTS: codex-reports/P2_T28_ORDER_STATE_LOCK_OWNERSHIP_HARDENING_R1.md, .../P2_T28_TESTING_DEPLOY_CERTIFICATION.md
PUSHED: SI (testing-codex only)
DEPLOYED_TESTING: SI (DeliGO Copy, commit exacto confirmado)
PRODUCTION_TOUCHED: NO
```

```
TASK_ID: P2-T25 (Order Creation Abuse Resistance)
VERDICT: CLOSED_TESTING_CERTIFIED
REASON: Corrige un bug real de foreign-lock-release (R2C) además de implementar rate limiting de 3 buckets independientes + idempotency + locking de creación de pedido
RESULT: cuenta 5/5min, IP 15/5min, negocio 30/5min (buckets independientes); idempotency replay NO consume el bucket de negocio; concurrencia con la misma idempotency key protegida por lock process-local; rotación de sesión da 429 en runtime; idempotency 201->200 con el mismo id; conflicto real da 409; IP en runtime está parcialmente limitada por confianza de proxy/XFF (Railway) — pendiente de endurecer `getClientIp`; el bucket de negocio 30/5min sólo se hizo smoke-test en runtime, requiere validación de producto/operaciones antes de promoción a Production; capa de challenge (CAPTCHA/similar) NO implementada
LIMITATION: rate limiter y locks son PROCESS-LOCAL (memoria del proceso Node) — no hay scaling horizontal seguro todavía; una segunda réplica de la app duplicaría los límites reales
STAGES: R1 (auditoría) -> R2 (hardening) -> R2A (semántica de bucket compartido de idempotency) -> R2B (race de concurrencia del bucket de negocio) -> R2C (bug real de foreign-lock-release) -> COMMIT-TESTING-DEPLOY
COMMIT: 1b69ee878e540d537c1b3a14d79ad88ded8d16e9 "fix: harden order creation abuse controls" (3 archivos: src/app/api/pedidos/route.ts, src/lib/rate-limit.ts, src/app/api/pedidos/order-rate-limit-buckets.integration.test.ts)
REPORTS: codex-reports/P2_T25_ORDER_ABUSE_RESISTANCE_AUDIT_R1.md, .../P2_T25_R2_ORDER_ABUSE_HARDENING.md, .../P2_T25_R2A_IDEMPOTENCY_SHARED_BUCKET_SEMANTICS_FIX.md, .../P2_T25_R2B_CONCURRENT_IDEMPOTENCY_BUSINESS_BUCKET_RACE.md, .../P2_T25_R2C_ORDER_LOCK_OWNERSHIP_RELEASE_RACE.md, .../P2_T25_R2_TESTING_DEPLOY_CERTIFICATION.md
PUSHED: SI (testing-codex only)
DEPLOYED_TESTING: SI (DeliGO Copy, commit exacto confirmado)
PRODUCTION_TOUCHED: NO
```

```
TASK_ID: P2-T31-R1 (Notification Switch Persistence State Sync — sub-etapa CERRADA dentro de P2-T31, que sigue IN_PROGRESS)
VERDICT: PASS_SUBSTAGE (no cierra P2-T31 completo)
REASON: Fix real de estado de switch para Cliente/Negocio; Repartidor ya estaba sano
RESULT: Cliente: stale seed desde `perfil.pushSubscription` (React Query nunca invalidada tras toggle) + blind spot de reconciliación (nunca podía autocorregirse cuando la verdad real era `false`); Negocio: stale closure de React post-await (patrón F-P2-T05-23 nunca portado a este componente); Repartidor: binding directo al hook, sin bug
COMMIT: 989785a3cb1613bcda3a6c67f96472058bc876b0 "fix: sync push notification switch state" (5 archivos)
REPORTS: codex-reports/P2_T31_NOTIFICATION_SWITCH_PERSISTENCE_STATE_SYNC_R1.md, .../P2_T31_TESTING_DEPLOY_PENDING_ANDROID_CERTIFICATION.md
PUSHED: SI (testing-codex only)
DEPLOYED_TESTING: SI (DeliGO Copy, commit exacto confirmado)
PRODUCTION_TOUCHED: NO
NOTA: esta era la sub-etapa R1 de P2-T31; R2 a R10 (ver la entrada de cierre de P2-T31 al inicio de este archivo) son etapas POSTERIORES a este commit. P2-T31 cerró CLOSED_TESTING_CERTIFIED en R10 (2026-09-06).
```

```
TASK_ID: PRODUCTION-SYNC-R6-R0
VERDICT: BLOCKED
REASON: Scheduler externo de Chat Cleanup no probado; requiere evidencia de operador UI
RESULT: Backup post-27 restaurable PASS; Review/Mesa auditados; cero mutaciones Railway/DB/jobs/Git
REPORT: codex-reports/PRODUCTION_SYNC_R6_R0.md
R6_R0_RAILWAY_MUTATION_COUNT: 0
R6_R0_PRODUCTION_JOB_EXECUTION_COUNT: 0
R6_R0_PRODUCTION_DB_WRITE: NO
R6_R0_GIT_PUSH_COUNT: 0
R6_R0_CODE_DEPLOY_COUNT: 0
NEXT_TASK_ID: PRODUCTION-SYNC-R6-R1
NEXT_TASK_STATUS: BLOCKED_AWAITING_OPERATOR_CHAT_CLEANUP_SCHEDULER_EVIDENCE
```

```
TASK_ID: PRODUCTION-SYNC-R5
VERDICT: PASS
REASON: Final contract migration #27 aplicada y Production certificada completa
RESULT: 27/27/0; terminales_salon presente; pushSubscription ausente; schema 47/514/102/139; datos y runtime sanos
REPORT: codex-reports/PRODUCTION_SYNC_R5.md
PRODUCTION_DB_WRITE: SI (una migración autorizada)
R5_MIGRATE_DEPLOY_ATTEMPT_COUNT: 1
R5_GIT_PUSH_COUNT: 0
R5_CODE_DEPLOY_COUNT: 0
R5_RAILWAY_SERVICE_RESTART_COUNT: 0
NEXT_TASK_ID: PRODUCTION-SYNC-R6
NEXT_TASK_STATUS: READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

```
TASK_ID: PRODUCTION-SYNC-R5-R0-R1
VERDICT: PASS
REASON: Backup lógico PostgreSQL 18.6 fresco, legible y completamente restaurable certificado
RESULT: Dump custom fuera del repo; restore scratch 18.6 PASS; 26/0/#27 pendiente; Production unchanged
REPORT: codex-reports/PRODUCTION_SYNC_R5_R0_R1.md
NEXT_TASK_ID: PRODUCTION-SYNC-R5
NEXT_TASK_STATUS: READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

```
TASK_ID: PRODUCTION-SYNC-R5-R0
VERDICT: BLOCKED
REASON: No hay pg_dump/pg_restore PostgreSQL 18 ni Docker/Podman; sólo PostgreSQL 12, no utilizado
RESULT: Production read-only post-26/pre-27 certificado; sin backup, restore, scratch ni mutaciones
REPORT: codex-reports/PRODUCTION_SYNC_R5_R0.md
NEXT_TASK_STATUS: BLOCKED_PG_DUMP_18_UNAVAILABLE
```

```
TASK_ID: PRODUCTION-SYNC-R4-R2-R2
VERDICT: PASS
REASON: Ambos servicios Production desplegaron el commit exacto; logs, smokes y DB post-26/pre-27 certificados
RESULT: DeliGO SUCCESS; chat SUCCESS en main; 26 migraciones exitosas, 0 fallidas, #27 única pendiente
REPORT: codex-reports/PRODUCTION_SYNC_R4_R2_R2.md
NEXT_TASK_ID: PRODUCTION-SYNC-R5
NEXT_TASK_STATUS: READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

```
TASK_ID: PRODUCTION-SYNC-R4-R2-R1
VERDICT: BLOCKED
REASON: Railway CLI no puede cambiar sólo la rama de chat preservando de forma demostrable repo, root y autodeploy
RESULT: 8/8 variables certificadas; gate PASS; un push FF; DeliGO SUCCESS en commit objetivo; chat pendiente de UI manual
REPORT: codex-reports/PRODUCTION_SYNC_R4_R2_R1.md
NEXT_TASK_STATUS: BLOCKED_AWAITING_MANUAL_CHAT_BRANCH_CHANGE
```

```
TASK_ID: PRODUCTION-SYNC-R4-R2
VERDICT: BLOCKED
REASON: Railway Production DeliGO muestra ausentes las tres PRIVATE_EVIDENCE_CLOUDINARY_* declaradas creadas por el operador
RESULT: Gate local PASS; pre-push bloqueado; sin push/deploy/mutaciones adicionales
REPORT: codex-reports/PRODUCTION_SYNC_R4_R2.md
NEXT_TASK_STATUS: BLOCKED_LIVE_RAILWAY_VARIABLE_STATE_CONTRADICTS_OPERATOR_AUTHORITY
```

```
TASK_ID: PRODUCTION-SYNC-R4-R1
VERDICT: BLOCKED
REASON: Credenciales exactas PRIVATE_EVIDENCE_CLOUDINARY_* requieren provisión manual dedicada de Production; chat branch/root no expuestos por metadata
RESULT: REALTIME_INTERNAL_SERVICE_URL resuelto y escrito con --skip-deploys; sin push/deploy
REPORT: codex-reports/PRODUCTION_SYNC_R4_R1.md
NEXT_TASK_STATUS: BLOCKED_AWAITING_MANUAL_PRIVATE_EVIDENCE_CLOUDINARY_CONFIGURATION
```

```
TASK_ID: PRODUCTION-SYNC-R4
VERDICT: BLOCKED
REASON: Faltan tres secretos exactos de evidencia privada; REALTIME_INTERNAL_SERVICE_URL no tiene estrategia inequívoca; rama Production de chat en vivo no probada
REPORT: codex-reports/PRODUCTION_SYNC_R4.md
PUSH: NO
DEPLOY: NO
NEXT_TASK_STATUS: BLOCKED_AWAITING_EXPLICIT_AUTHORIZATION_FOR_MISSING_PRODUCTION_DEPLOY_PREREQUISITES
```

```
TASK_ID: PRODUCTION-SYNC-R3-R3-R1
VERDICT: PASS
RESULT: Production baselined en 0_init y migrada exactamente hasta #26; #27 pendiente
REPORT: codex-reports/PRODUCTION_SYNC_R3_R3_R1.md
NEXT_TASK: PRODUCTION-SYNC-R4 (requiere autorización explícita)
```

```
TASK_ID: PRODUCTION-SYNC-R3-R3
VERDICT: BLOCKED
REASON: psql ignoró el archivo SQL por invocación incorrecta; no hubo escritura ni retry automático
NEXT_TASK_STATUS: BLOCKED_AWAITING_NEW_EXPLICIT_AUTHORIZATION
REPORT: codex-reports/PRODUCTION_SYNC_R3_R3.md
```

```
TASK_ID: PRODUCTION-SYNC-R3-R2-R1
VERDICT: PASS
RESULT_SUMMARY: Completion semántica de 0_init, baseline scratch y replay
aislado #2-#26 certificados; 26/26 exitosas, #27 único pendiente.
REPORT: codex-reports/PRODUCTION_SYNC_R3_R2_R1.md
PRODUCTION_DB_WRITE: NO
NEXT_TASK: PRODUCTION-SYNC-R3-R3 READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

```
TASK_ID: PRODUCTION-SYNC-R3-R2
VERDICT: BLOCKED
RESULT_SUMMARY: Recheck read-only confirmó cinco tablas faltantes y además
empleados.cuentaOperativaId con sus índices/FK faltantes en una tabla existente.
El hard rule impide el patch exacto; no se ejecutó completion, resolve ni deploy.
REPORT: codex-reports/PRODUCTION_SYNC_R3_R2.md
```

```
TASK_ID: PRODUCTION-SYNC-R3-R1
VERDICT: BLOCKED
RESULT_SUMMARY: Reconciliación completamente read-only. Production tiene 31
tablas/352 columnas frente a 36/399 declaradas por 0_init; faltan exactamente
cinco tablas del subsistema de terminales/cuentas. Prefijo contiguo de
baseline: 0. No se ejecutó resolve, deploy, backup ni DB write.
NEXT_TASK: NOT_SET — requiere decisión explícita sobre cómo materializar el
schema faltante antes de cualquier baseline.
```

Cronológico. Detalle extenso: `codex-reports/archive/LEGACY_FULL_REPORT_20260826.md`.

```
TASK_ID: PRODUCTION-SYNC-R3
VERDICT: BLOCKED
RESULT_SUMMARY: Preflight Git/Railway/Prisma y data checks read-only. Bundle
aislado con exactamente 26 migraciones, SQL byte-idéntico y sin la #27.
Production tiene 27 pendientes y no tiene _prisma_migrations; 0_init choca
con tablas base existentes. No se ejecutó resolve, backup, migración, DB
write, deploy, push ni cambio de código.
NEXT_TASK: PRODUCTION-SYNC-R3-R1 — decisión explícita sobre baseline 0_init
```

```
TASK_ID: P0/P1 (todas las tareas)
VERDICT: CLOSED
RESULT_SUMMARY: fases P0 y P1 completas — ver archive para detalle si se necesita.

TASK_ID: P2-T02-STAGE1..6M (tracking GPS delivery)
VERDICT: PAUSED_EXTERNAL_DEPENDENCY (no fallido — bloqueado por falta de
  hardware Android con GPS confiable para Stage6N)
RESULT_SUMMARY: implementación completa, certificación runtime pendiente
  de hardware físico. Retomar como P2-T02-STAGE6N-RETRY cuando esté
  disponible.

TASK_ID: P2-T05-STAGE1..STAGE2H
VERDICT: PASS
RESULT_SUMMARY: diseño e implementación inicial del modelo de
  subscripciones Push normalizadas + legacy dual-write.
COMMIT: b05b4ff (feat: add normalized push subscription model)

TASK_ID: P2-T05-STAGE3..STAGE3D
VERDICT: PASS (con correcciones intermedias Stage3B/3B2/3B3/R1/R2)
RESULT_SUMMARY: validación HTTP unificada, SERVER_DETACH_ONLY con async
  staleness guard, LatestOperationGate, precommit/postcommit recertification.
COMMIT: f544b29 (feat: integrate normalized multi-device push subscriptions),
  20209f5 (fix: harden push subscription input and detach)

TASK_ID: P2-T05-STAGE3E
VERDICT: PASS
RESULT_SUMMARY: push + TESTING deploy + bounded runtime smoke del fan-out
  multi-device.
COMMIT: 6dfb539 (feat: fan out push notifications across devices)

TASK_ID: P2-T05-STAGE4..STAGE4F
VERDICT: PASS
RESULT_SUMMARY: certificación runtime multi-device real (fanout, dedupe,
  legacy fallback) con dispositivos físicos reales (PC + iPhone).

TASK_ID: P2-T05-POST-STAGE4-HARDENING-PLAN
VERDICT: PASS
RESULT_SUMMARY: planificación read-only del orden de hardening
  H1(F19+F20) -> H2(F21) -> H3(F18+F15) -> H4(F22).

TASK_ID: P2-T05-HARDENING-H1 (implementation + precommit review + local commit + postcommit/prepush)
VERDICT: PASS (con 1 hallazgo real de reporte corregido en precommit review, sin defecto de código)
FINDINGS: F19, F20 RESOLVED
COMMIT: c66df8d (fix: harden push fanout channel and key handling)
RESULT_SUMMARY: PushSubscriptionCleanup discriminated union + sameFanoutSubscriptionKeys
  fail-closed cross-owner conflict detection.

TASK_ID: P2-T05-HARDENING-H2 (implementation + precommit review + local commit + postcommit/prepush)
VERDICT: PASS
FINDINGS: F21 RESOLVED
COMMIT: 47a630e (perf: batch push fanout and bound concurrency)
RESULT_SUMMARY: batch de subscripciones + concurrencia acotada (mapWithConcurrency cap 8).
  Implementado y committeado por otra sesión/proceso en paralelo — verificado
  independientemente, no asumido.

TASK_ID: P2-T05-HARDENING-H1+H2-CHECKPOINT (push exacto + TESTING deploy + smoke)
VERDICT: PASS
RESULT_SUMMARY: push de ambos commits H1+H2, DeliGO Copy + chat en vivo
  desplegados y verificados sanos en TESTING.

TASK_ID: P2-T05-HARDENING-H3 (Claude external Chrome+CDP precheck de F18)
VERDICT: COMPLETED_REAL_RUNTIME_REPRODUCTION (Case C — bloqueado antes de
  editar código, per decision gate)
RESULT_SUMMARY: reprodujo F18 en un browser externo real, root-caused a un
  defecto independiente de stale closure — registrado como nuevo finding
  F-P2-T05-23. No implementó F15 en esta etapa (esperaba el fix de F23).

TASK_ID: P2-T05-HARDENING-H3B (implementation + precommit review + precommit
  completion + local commit + postcommit/prepush review + testing checkpoint)
VERDICT: PASS en todas las sub-etapas (con 1 defecto real encontrado y
  corregido en la precommit review: actor-change podía dejar loading
  atascado)
FINDINGS: F23, F15 RESOLVED; F18 RESOLVED (runtime-certified)
COMMIT: 9394b605611deb4f10b8028a41a8bd19f7687314 (fix: reconcile personal push ui state)
RESULT_SUMMARY: PushMutationResult contract, actor-change loading fix,
  push + TESTING deploy + certificación real con Chrome externo
  (first-enable/disable/re-enable consistentes, SERVER_DETACH_ONLY
  preservado en runtime).
ARCHIVE_REFERENCE: archive legacy, secciones "## H3B — ..." (múltiples)

TASK_ID: P2-T05-HARDENING-H4 (implementation)
VERDICT: PASS
FINDINGS: F22 IMPLEMENTED_LOCAL_AWAITING_PRECOMMIT_REVIEW
RESULT_SUMMARY: canonical auth-mock singleton helper
  (src/lib/test-helpers/auth-mock.ts) resolviendo la colisión process-global
  de mock.module("@/lib/auth"). 7 archivos migrados. 123/123 (7 archivos) y
  522/522 (34 archivos) en combined run, orden normal e invertido, sin
  exclusiones. Sin commit todavía.
ARCHIVE_REFERENCE: archive legacy, sección "## H4 — F22 ... LOCAL IMPLEMENTATION"

TASK_ID: P2-T05-HARDENING-H4-PRECOMMIT-REVIEW
VERDICT: PASS
FINDINGS: F22 PRECOMMIT_REVIEW_PASS_READY_FOR_LOCAL_COMMIT (sin defecto de código real)
RESULT_SUMMARY: (A) migración del sistema de reportes a esquema distribuido —
  legacy archivado byte-a-byte (SHA-256 verificado), root CODEX_REPORT.md
  compactado. (B) auditoría adversarial completa del diff H4: 7/7 consumidores
  revisados, helper auditado en 24 puntos, assertion immutability re-derivada
  desde Git (0 remociones), TSC por identidad 31=31 (0 nuevos), 7 focales
  123/123, 7 combined normal+reversed 123/123 ambos, 34 aislados 522/522,
  34 combined normal+reversed 522/522 ambos, sin exclusiones, sin síntoma
  de F22 en ningún orden. Nota de proceso: un ciclo git stash/pop usado
  para la comparación TSC A/B introdujo una conversión CRLF de line-ending
  (autocrlf de Windows) en los 7 archivos — detectado, diagnosticado y
  restaurado a los bytes LF originales exactos (hash SHA-256 re-verificado
  idéntico); no fue un defecto de código, sólo un artefacto del propio
  proceso de verificación.
ARCHIVE_REFERENCE: codex-reports/archive/P2-T05-H4-PRECOMMIT-REVIEW.md

TASK_ID: P2-T05-HARDENING-H4-LOCAL-COMMIT
VERDICT: PASS
FINDINGS: F22 LOCAL_COMMIT_COMPLETE_AWAITING_POSTCOMMIT_PREPUSH_REVIEW
RESULT_SUMMARY: commit-only. Bytes de los 8 archivos H4 verificados
  hash-idénticos a los certificados en la revisión pre-commit inmediatamente
  anterior antes de stagear — batería completa de tests NO re-ejecutada
  (reutilización legítima de autoridad). Stage exacto de 8 paths, cached
  diff releído completo (1139 líneas), commit único creado.
COMMIT: f5571f14e73155f7a4828dfe014230b95c795115 (parent 9394b605...) —
  LOCAL ONLY, NO push, NO deploy.
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md (detalle completo de esta tarea)
```

TASK_ID: P2-T05-HARDENING-H4-F22-RESET-ISOLATION-CORRECTION-PRECOMMIT-REVIEW
VERDICT: PASS
FINDINGS: F22 CORRECTION_PRECOMMIT_REVIEW_PASS_READY_FOR_COMMIT_STRATEGY
RESULT_SUMMARY: auditoría adversarial independiente del diff local. Confirmó
  la causa raíz pre-fix, corrigió la lectura histórica 4/7 a 5/7, validó RED
  exacta y GREEN, reset completo de state/hooks, ordering de logout, mozo y
  salón, y ausencia de defectos secundarios. 124/124 en 7 suites y 523/523
  en 34 archivos, aislado/normal/reverso. TSC queda UNRESOLVED_LIMITED sin
  diagnósticos nuevos H4; ESLint/build PASS. Sin stage/commit/push/deploy.
RECOMMENDED_COMMIT_STRATEGY: AMEND_EXISTING_H4
COMMIT_STRATEGY_RATIONALE: correction directamente perteneciente al H4 local,
  no publicado ni desplegado; mantener H4 como unidad atómica es más coherente.
NEXT_TASK: P2-T05-HARDENING-H4-F22-RESET-ISOLATION-CORRECTION-AMEND
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T12-STAGE5F
VERDICT: PASS
FINDINGS: F-P0-05 RESOLVED; P2-T12 CLOSED
RESULT_SUMMARY: cierre final read-only reconstruido contra archives Stage1–Stage5E,
  Git real, schema, TESTING DB, Railway y health HTTP. Phase1 y Phase2 fueron
  reconciliadas; schema y DB ya no contienen TerminalOperativa.pushSubscription,
  T12 history es exactamente 1, successful 1, pending/failed 0, deployment
  Phase2 SUCCESS y runtime terminal heredado de Stage5E PASS. Git permanece
  HEAD=origin en testing-codex, sin cambios tracked ni índice staged. No hubo
  DB writes, fixtures, migrations, commit, amend, push, deploy, Production ni
  acceso a 32 en Stage5F.
COMMIT: 7822d84ac5ac841978a77ebef76ad93630b69f42 (histórico; no se modificó)
PUSH: NO
DEPLOY: NO
DB_WRITE: NO
F_P0_05_STATUS: RESOLVED
P2_T12: CLOSED
PRODUCTION: NO
NEXT_TASK: P2-T11 — Native Socket Post-Logout TTL Hardening
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T12-STAGE4E
VERDICT: PASS
FINDINGS: F-P0-05 TWO_PHASE_ROLLOUT_PHASE1_TESTING_CERTIFIED
RESULT_SUMMARY: push exacto una sola vez de Phase1 a testing-codex y autodeploy
TESTING certificado con el commit bebd36c841f588fc9e4c74099e38a95d37d58982.
La columna física pushSubscription permaneció presente, no se aplicó DROP T12,
y el deployment nuevo quedó SUCCESS con instancia RUNNING y la antigua
REMOVED. El smoke runtime real pasó login, creación, activación, contexto,
reuso negativo genérico, revocación y rechazo posterior con fixtures
TEST_T12_PHASE1_ aisladas; limpieza completa y sin Push enviado.
COMMIT: bebd36c841f588fc9e4c74099e38a95d37d58982
PUSH: EXACTLY_ONCE_PASS
DEPLOY: TESTING_AUTODEPLOY_PASS
RAILWAY_MUTATION: NO
PRODUCTION: NO
DB_REAL_WRITE: ONLY_ISOLATED_FIXTURES
NEXT_TASK: P2-T12-STAGE5A
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T13-STAGE1
VERDICT: PASS
FINDINGS: F-P0-06 scope reconciled; residual stale-detach race reproduced
RESULT_SUMMARY: audit desde cero del código actual. RACE-A register/register
queda cubierta por UNIQUE + upsert y DB09 histórico 10/10; RACE-C conserva
MODEL-C1 multi-bind y aislamiento por channel. RACE-B sí reproduce: V1 stale
detach endpoint-only elimina la fila V2 rotada. Fix mínimo diseñado como
compare-and-delete atómico por owner/channel/endpoint/p256dh/auth, sin schema
ni migration.
SOURCE_MUTATION: NO
TEST_MUTATION: NO
DB: NO
NEXT_TASK: P2-T13-STAGE2

TASK_ID: P2-T05-FINAL-CLOSEOUT
VERDICT: PASS
FINDINGS: F15/F18/F19/F20/F21/F22/F23 resolved; NEW_BLOCKING_FINDING_COUNT=0
RESULT_SUMMARY: cierre adversarial documental confirmado por evidencia
convergente: regresión final 523/523 en aislado, normal y reversed, sin
exclusiones; Stage4F vigente; Git HEAD=origin con ahead/behind 0/0; Railway
TESTING alineado al commit e172cd7 con DeliGO Copy y chat en vivo SUCCESS;
cleanup H3 certificado; P2-T13 preservado separado.
COMMIT: e172cd7ac8245d32db89f96cf6c86ca31bb43cf2
PUSH: ya certificado en checkpoint previo; sin nueva acción Git
TESTING_DEPLOY: PASS
BOUNDED_SMOKE: PASS
P2_T05_CLOSED: SI
NEXT_TASK: P2-T13
NEXT_TASK_STATUS: NOT_STARTED
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T05-FINAL-TESTING-CHECKPOINT
VERDICT: PASS
FINDINGS: F15/F18/F19/F20/F21/F22/F23 SUSTAINED; NEW_BLOCKING_FINDING_COUNT=0
RESULT_SUMMARY: push fast-forward único del commit e172cd7; HEAD y
origin/testing-codex quedaron alineados 0/0. DeliGO Copy y chat en vivo
autodesplegaron el commit exacto en Railway TESTING con SUCCESS, sin loop ni
errores fatales. Smoke HTTP acotado PASS: Copy root/login/repartidor y chat
/health devolvieron 200. Sin producción, DB, real push ni mutación de permisos.
COMMIT: e172cd7ac8245d32db89f96cf6c86ca31bb43cf2
PUSH: SI — un único fast-forward
TESTING_DEPLOY: PASS
BOUNDED_SMOKE: PASS
NEXT_TASK: P2-T05-FINAL-CLOSEOUT
P2_T05_CLOSED: NO

TASK_ID: P2-T05-HARDENING-H4-F22-RESET-ISOLATION-CORRECTION-AMEND
VERDICT: PASS
FINDINGS: F22 AMENDED_H4_LOCAL_AWAITING_POSTAMEND_POSTCOMMIT_RECERTIFICATION
RESULT_SUMMARY: amend local exacto y único sobre el H4 no publicado; mismo
  parent y subject, nuevo hash e172cd7ac8245d32db89f96cf6c86ca31bb43cf2.
  El commit final contiene exactamente los 8 paths H4, incluyendo el helper,
  resets de Mozo/Salón, hook de logout por beforeEach y la regresión net-new.
  Quick gates post-amend normal/reverso: 124/124; la autoridad completa de
  34 archivos queda pendiente de recertificación post-amend. Sin push,
  deploy, Railway ni DB.
OLD_COMMIT: f5571f14e73155f7a4828dfe014230b95c795115
COMMIT: e172cd7ac8245d32db89f96cf6c86ca31bb43cf2 (parent 9394b605...)
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T05-HARDENING-H4-F22-RESET-ISOLATION-POSTAMEND-RECERTIFICATION
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T05-HARDENING-H4-F22-RESET-ISOLATION-CORRECTION
VERDICT: PASS
FINDINGS: F22 CORRECTION_IMPLEMENTED_LOCAL_AWAITING_PRECOMMIT_REVIEW
RESULT_SUMMARY: confirmado por código real el defecto de reset incompleto y
  hook global. Regression RED exacta antes del fix; GREEN después. El helper
  ahora limpia authMockHooks y las siete suites tienen reset en beforeEach;
  logout reinstala su hook sólo después del reset. 124/124 en las 7 suites y
  523/523 en la autoridad literal de 34, aislado/normal/reverso. Sin source
  productivo, sin DB, sin commit/amend/push/deploy.
COMMIT: none — working-tree correction over f5571f14e73155f7a4828dfe014230b95c795115
NEXT_TASK: P2-T05-HARDENING-H4-F22-RESET-ISOLATION-CORRECTION-PRECOMMIT-REVIEW
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T05-HARDENING-H4-F22-RESET-ISOLATION-POSTAMEND-RECERTIFICATION
VERDICT: PASS
FINDINGS: F22 RESOLVED_H4_AMENDED_AND_POSTAMEND_CERTIFIED
RESULT_SUMMARY: recertificación completa contra el commit real e172cd7. El
  commit conserva exactamente los 8 paths permitidos; el delta respecto de
  H4 anterior toca exactamente 4 archivos de corrección. Reset de estado y
  hooks, semántica de referencias, ordering y regresión net-new quedaron
  verificados. Las 7 suites pasan 124/124 y la autoridad literal de 34
  archivos pasa 523/523 en aislado, combinado normal y combinado reverso.
  TSC conserva el baseline UNRESOLVED_LIMITED sin diagnósticos H4 nuevos;
  ESLint y build PASS. Sin source productivo, DB, push, deploy o Railway.
COMMIT: e172cd7ac8245d32db89f96cf6c86ca31bb43cf2 (parent 9394b605...)
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T05-FINAL-ACCUMULATED-REGRESSION
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T05-FINAL-ACCUMULATED-REGRESSION
VERDICT: PASS
FINDINGS: F15/F18/F19/F20/F21/F22/F23 SUSTAINED; NEW_BLOCKING_FINDING_COUNT=0
RESULT_SUMMARY: auditoría final independiente contra e172cd7. La cadena
  H1/H2/H3B/H4 es ancestro válida; las 34 rutas literales actuales cubren
  todas las categorías históricas sin exclusiones. Focos: Stage4 65/65,
  repository/HTTP 225/225, UI 59/59. Regresión total: 523/523 en aislado,
  combined normal y combined reversed. Cap WebPush 8, máximo observado 8;
  batch, dedupe, legacy, cleanup 404/410, non-404, F19, F20 y F22 PASS.
  TSC conserva UNRESOLVED_LIMITED (31/24, 0 H4); ESLint y build PASS.
  Sin DB real, source/test changes, push, deploy, Railway ni producción.
COMMIT: e172cd7ac8245d32db89f96cf6c86ca31bb43cf2 (local; parent 9394b605...)
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T05-FINAL-TESTING-CHECKPOINT
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T13-STAGE2
VERDICT: PASS
FINDINGS: P2-T13 IMPLEMENTED_LOCAL_AWAITING_PRECOMMIT_REVIEW
RESULT_SUMMARY: implementación local mínima del compare-and-delete de
generación para el detach normalizado; stale V1 no elimina V2, V2 sí elimina,
inputs incompletos no hacen fallback a endpoint-only y los cinco callers
productivos pasan keys server-derived. Focal 146/146 y regresión P2-T05 de
34 archivos 526/526 en orden normal e invertido. Sin DB, schema/migration,
Railway, deploy, commit ni push.
COMMIT: none — source/test diff remains local
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T13-STAGE3
ARCHIVE_REFERENCE: codex-reports/archive/P2-T13-STAGE1.md

TASK_ID: P2-T13-STAGE3
VERDICT: PASS
FINDINGS: Race-B FIX_PRECOMMIT_CERTIFIED; NEW_BLOCKING_FINDING_COUNT=0
RESULT_SUMMARY: revisión adversarial pre-commit del compare-and-delete de
  generación. Predicate atómico ownerType+ownerId+channel+endpoint+p256dh+auth;
  cinco callers normalizados, cero callers user endpoint-only. Focal 146/146;
  autoridad de 34 archivos 526/526 aislado, normal y reverso. Prisma validate,
  Prisma generate, ESLint y build PASS; TSC conserva baseline sin diagnósticos
  en paths modificados. P2-T05 permanece CLOSED.
COMMIT: none — Stage 3 review-only; source/test diff remains local
PUSH: NO
DEPLOY: NO
RAILWAY_MUTATION: NO
PRODUCTION: NO
NEXT_TASK: P2-T13-STAGE4
ARCHIVE_REFERENCE: codex-reports/archive/P2-T13-STAGE3.md

TASK_ID: P2-T13-STAGE4
VERDICT: PASS
FINDINGS: Race-B FIX_COMMITTED_LOCAL_AWAITING_POSTCOMMIT_CERTIFICATION; NEW_BLOCKING_FINDING_COUNT=0
RESULT_SUMMARY: commit-only. Continuidad exacta desde Stage 3 re-verificada
  (HEAD/origin sin cambio, ahead/behind 0/0, índice vacío, diff de 483 líneas
  idéntico a lo revisado; gate focal 146/146 re-ejecutado, no asumido).
  Stage exacto de los 10 paths permitidos, cached diff idéntico al pre-stage,
  commit único creado. Blobs committeados re-leídos y confirmados idénticos
  al cached diff. Árbol de trabajo limpio tras el commit; HEAD 1 commit
  adelante de origin, 0 atrás. Sin push, deploy, Railway, DB, schema ni
  migration.
COMMIT: 44b9da06ff2fa099cf7eb5fb971b13454f33f308 (parent e172cd7ac8245d32db89f96cf6c86ca31bb43cf2) — LOCAL ONLY, NO push, NO deploy.
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T13-STAGE5
ARCHIVE_REFERENCE: codex-reports/archive/P2-T13-STAGE4.md

TASK_ID: P2-T13-STAGE5
VERDICT: PASS
FINDINGS: Race-B FIX_COMMITTED_AND_POSTCOMMIT_CERTIFIED; NEW_BLOCKING_FINDING_COUNT=0
RESULT_SUMMARY: recertificación adversarial READ/TEST/AUDIT-ONLY directamente
  sobre los blobs del commit 44b9da0 (nunca sobre el working tree como
  sustituto). Predicate CAS confirmado atómico (un único deleteMany, sin
  select-then-delete). Inventario exhaustivo: exactamente 5 callers
  productivos, 0 endpoint-only. RED reproducido de forma independiente
  contra el código real del parent en un worktree temporal aislado (fuera
  del repo, eliminado por completo al terminar), confirmando la causa raíz
  con la firma original. Batería completa re-ejecutada contra HEAD: focal
  146/146, 34 archivos 526/526 en aislado, combinado normal y combinado
  reverso. Prisma validate/generate, ESLint, build y TSC (31/24, 0 nuevos)
  PASS. Concluye que se requiere certificación PostgreSQL real y un flujo
  HTTP mínimo antes de cerrar P2-T13, pero NO WebPush real. Sin
  modificación de source/test, sin stage, sin commit/amend, sin push,
  deploy, Railway, DB real ni producción.
COMMIT: 44b9da06ff2fa099cf7eb5fb971b13454f33f308 (sin cambios; no se creó ni
  modificó ningún commit en esta tarea)
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T13-STAGE6
ARCHIVE_REFERENCE: codex-reports/archive/P2-T13-STAGE5.md

TASK_ID: P2-T13-STAGE6
VERDICT: PASS
FINDINGS: Race-B FIX_PUSHED_TESTING_DEPLOYED_REAL_POSTGRES_HTTP_CERTIFIED; NEW_BLOCKING_FINDING_COUNT=0
RESULT_SUMMARY: publicó el commit ya certificado (44b9da0) a
  origin/testing-codex mediante un único push fast-forward; ambos servicios
  TESTING (DeliGO Copy, chat en vivo) autodesplegaron exitosamente al
  commit exacto. Certificó la corrección en dos niveles runtime reales: (A)
  repository primitive contra PostgreSQL real de TESTING — stale V1 nunca
  borra V2, current V2 sí se detacha, 10/10 rondas concurrentes reales
  terminan siempre en V2 (0 rechazos, 0 torn, 0 V1 final), cross-actor/
  channel/multi-device/register-sanity PASS; (B) flujo HTTP real
  autenticado (actor Cliente TEST vía la función productiva de sesión real,
  sin bypass) a través de /api/push/subscribe + /api/push/unsubscribe
  desplegados: subscribe V1, rotación V2, stale unsubscribe preserva V2,
  current unsubscribe la elimina, malformed fail-closed, owner/channel
  authority confirmada. Sin WebPush real, sin fallback a DATABASE_URL,
  cleanup total verificado (0 filas remanentes en ambas campañas), sin
  5xx/Prisma/fatal nuevos en logs.
COMMIT: 44b9da06ff2fa099cf7eb5fb971b13454f33f308 (publicado, sin amend)
PUSH: SI — único fast-forward, exit 0
DEPLOY: SUCCESS (DeliGO Copy + chat en vivo, autodeploy git-triggered)
NEXT_TASK: P2-T13-STAGE7
ARCHIVE_REFERENCE: codex-reports/archive/P2-T13-STAGE6.md

TASK_ID: P2-T13-STAGE7
VERDICT: PASS
FINDINGS: F-P0-06/Race-B RESOLVED_P2_T13_REAL_POSTGRES_HTTP_CERTIFIED; NEW_BLOCKING_FINDING_COUNT=0
RESULT_SUMMARY: cierre adversarial final, read/audit/report-only. Reconstruyó
  y confrontó toda la cadena Stage1→Stage6 contra Git real, findings,
  decisiones/invariantes, test authority, deploy history y roadmap — no
  cerró sólo porque Stage6 declarara READY. Los 28 gates de la matriz de
  cierre pasaron (Stage1-6 gates, Postgres sequential/concurrency/final-
  siempre-V2, cross-actor/channel/multi-device/register-sanity, HTTP
  subscribe/rotate/stale/current/malformed/authority, cleanup, MODEL-C1,
  SERVER_DETACH_ONLY, dead-sweep boundary, Git/Railway alignment, 0
  blockers, P2-T05 preservado). Único hallazgo: gap de trazabilidad
  documental de Stage1 (archivo de archive nunca existió pese a la
  afirmación de Stage2) — no bloqueante, conclusiones corroboradas por
  otras fuentes. Corrigió texto obsoleto en FINDINGS.md. Determinó la
  siguiente tarea canónica del roadmap (P2-T12) sin ejecutarla.
COMMIT: ninguno — sin mutación de código/tests/Git/Railway/DB en esta tarea
PUSH: NO
DEPLOY: NO
P2_T13_STATUS: CLOSED
NEXT_TASK: P2-T12 (TerminalOperativa.pushSubscription Cleanup) — no ejecutado
ARCHIVE_REFERENCE: codex-reports/archive/P2-T13-STAGE7.md

TASK_ID: P2-T12-STAGE1
VERDICT: PASS
FINDINGS: F-P0-05 CURRENT_STATE_CONFIRMED_DISPOSITION_DROP_INERT_COLUMN; NEW_BLOCKING_FINDING_COUNT=0
RESULT_SUMMARY: audit desde cero de TerminalOperativa.pushSubscription, sin
  asumir el título histórico. Confirmado: el campo existe desde el primer
  commit del feature terminal, nunca tuvo writer ni reader en toda la
  historia de git ni en el estado actual (verificado por forma exacta de
  cada query Prisma, no sólo grep), sin send-path, sin ownerType
  normalizado, sin UI/flujo cliente de Push. La revocación explícita de
  terminal no toca el campo (2 paths de revocación identificados: explícito
  y cascada por borrado de negocio). Exclusión de P2-T05 confirmada
  deliberada vía comentario de migración real. Disposition:
  DROP_INERT_COLUMN_IMPLEMENTATION_REQUIRED — matriz de 4 candidatos
  comparada, DROP es el único sustentado por evidencia. Rollout de un solo
  stage justificado (cero referencias que retirar primero). No se accedió
  a TESTING DB (la decisión no habría cambiado). Sin mutación de
  código/tests/schema/migration/Git/Railway/DB.
COMMIT: ninguno
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T12-STAGE2 (dead column local schema/migration removal + regression tests)
ARCHIVE_REFERENCE: codex-reports/archive/P2-T12-STAGE1.md

TASK_ID: P2-T12-STAGE2
VERDICT: PASS
FINDINGS: F-P0-05 DEAD_COLUMN_REMOVAL_IMPLEMENTED_LOCAL_AWAITING_ROLLOUT_CERTIFICATION; NEW_BLOCKING_FINDING_COUNT=0
RESULT_SUMMARY: revalidó independientemente toda la evidencia de Stage1
  contra el repo real antes de modificar (nada había cambiado). Removió
  `pushSubscription` de `TerminalOperativa` en el schema (1 línea) y creó
  una migración local `DROP COLUMN IF EXISTS` (no aplicada a ninguna DB).
  Prisma validate/generate, TSC (0 nuevos diagnósticos sobre baseline
  31/24), build: todos PASS. Diff puro — 0 archivos de producción/test
  tocados (0 readers/writers productivos del campo). Hallazgo material:
  2 de 11 call-sites productivos de `terminalOperativa` usan `update()`
  sin `select` explícito, por lo que el Prisma Client viejo pediría la
  columna eliminada en su RETURNING — riesgo real de rollout si el DROP
  se aplica junto con el schema removal mientras una instancia vieja
  sigue sirviendo. No se corrigió (fuera del allowlist de Stage2); se
  deja como evidencia explícita para decisión adversarial de Stage3.
  Sin DB real, sin commit, sin push, sin deploy, sin Railway.
COMMIT: ninguno
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T12-STAGE3 (pre-commit destructive migration / rolling-deploy compatibility review)
ARCHIVE_REFERENCE: codex-reports/archive/P2-T12-STAGE2.md

TASK_ID: P2-T12-STAGE3
VERDICT: PASS
FINDINGS: F-P0-05 DEAD_COLUMN_REMOVAL_LOCAL_VALIDATED_TWO_PHASE_ROLLOUT_REQUIRED; NEW_BLOCKING_FINDING_COUNT=0
RESULT_SUMMARY: auditoría adversarial del diff local Stage2 — no confió en
  su PASS como autorización de commit. Re-derivó desde cero los 11
  call-sites productivos de TerminalOperativa (no confió en el conteo de
  Stage2) y demostró mecánicamente, vía el tipo
  $TerminalOperativaPayload.scalars del cliente Prisma generado (sin DB),
  que 2 de ellos (update() sin select en activar/route.ts y
  operaciones-terminal-auth.ts) harían que el cliente ya desplegado
  (44b9da0) solicite la columna eliminada en su RETURNING SQL. Sin prueba
  de que Railway drene la instancia vieja antes del preDeploy, y
  confirmado que un select agregado a un commit nuevo no protege un
  proceso ya en ejecución, concluyó que el diff combinado de Stage2 no es
  seguro de commitear/desplegar como una sola unidad. Diseñó el modelo de
  rollout de dos fases completo (Phase1 schema-only, Phase2 DROP físico
  separado) con gates, matriz de comparación y plan de stages futuros. Sin
  DB real, sin commit, sin push, sin deploy, sin Railway, sin modificar
  schema/migration/source/tests.
COMMIT: ninguno
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T12-STAGE4A (phase1 contract local preparation)
ARCHIVE_REFERENCE: codex-reports/archive/P2-T12-STAGE3.md

TASK_ID: P2-T12-STAGE4A
VERDICT: PASS
FINDINGS: F-P0-05 TWO_PHASE_ROLLOUT_PHASE1_LOCAL_PREPARED; NEW_BLOCKING_FINDING_COUNT=0
RESULT_SUMMARY: preparó localmente Phase1 del rollout de contrato decidido
  en Stage3. Preservó el SQL completo + SHA-256 de la migración DROP de
  Stage2 (nunca tracked) en el reporte, y la eliminó del árbol activo —
  el único diff tracked que queda es la remoción de 1 línea
  (pushSubscription) en prisma/schema.prisma. Demostró mecánicamente, sin
  DB, inspeccionando el tipo $TerminalOperativaPayload.scalars del cliente
  Prisma regenerado, que las 11 queries productivas reales (incluidas las
  2 antes riesgosas) ya no pueden solicitar la columna eliminada — sin
  tocar ningún archivo TS. Prisma validate/generate, TSC (0 nuevos
  diagnósticos), build: todos PASS. Test estático de terminal 26/26 sin
  regresión. Sin DB real, sin commit, sin push, sin deploy, sin Railway.
COMMIT: ninguno
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T12-STAGE4B (phase1 schema-only pre-commit adversarial review)
ARCHIVE_REFERENCE: codex-reports/archive/P2-T12-STAGE4A.md

TASK_ID: P2-T12-STAGE4B
VERDICT: PASS
FINDINGS: F-P0-05 TWO_PHASE_ROLLOUT_PHASE1_PRECOMMIT_CERTIFIED; NEW_BLOCKING_FINDING_COUNT=0
RESULT_SUMMARY: revisión adversarial pre-commit de la Phase1 schema-only —
  no aceptó el PASS de Stage4A como autorización de commit. Re-derivó
  desde cero los 11 call-sites productivos de TerminalOperativa, re-
  confirmó mecánicamente (sin DB) que el cliente Prisma regenerado ya no
  puede solicitar pushSubscription para ninguna de las 11 queries,
  confirmó que los 2 archivos antes riesgosos siguen byte-idénticos a
  HEAD (sin select agregado), y confirmó que la migración DROP de Stage2
  sigue completamente ausente del árbol activo con su blueprint (SQL +
  SHA-256) intacto. Re-ejecutó Prisma validate/generate, TSC (0 nuevos),
  build y el test de terminal ejecutable sin DB (26/26) de forma
  independiente — mismo resultado que Stage4A, sin drift de herramientas.
  Verificó convención real del repo para proponer subject de commit
  ("chore:", 6 precedentes vs. 1 de "refactor:"). Certificó el diff (1
  archivo, prisma/schema.prisma) listo para commit local exacto. Sin DB
  real, sin commit, sin push, sin deploy, sin Railway.
COMMIT: ninguno
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T12-STAGE4C (phase1 schema-only exact local commit)
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T12-STAGE4C
VERDICT: PASS
FINDINGS: F-P0-05 TWO_PHASE_ROLLOUT_PHASE1_COMMITTED_LOCAL
RESULT_SUMMARY: commit local exacto de Phase1 schema-only. Commit
  bebd36c841f588fc9e4c74099e38a95d37d58982, parent 44b9da06ff2fa099cf7eb5fb971b13454f33f308,
  subject exacto; contiene únicamente prisma/schema.prisma con la eliminación
  de TerminalOperativa.pushSubscription. Quick test 26/26 y Prisma validate
  PASS sin DB real. Reportes, migrations, TS, lockfiles y 32 quedaron fuera.
COMMIT: bebd36c841f588fc9e4c74099e38a95d37d58982
PUSH: NO
DEPLOY: NO
RAILWAY_MUTATION: NO
PRODUCTION: NO
NEXT_TASK: P2-T12-STAGE4D
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T12-STAGE4D
VERDICT: PASS
FINDINGS: F-P0-05 TWO_PHASE_ROLLOUT_PHASE1_POSTCOMMIT_CERTIFIED
RESULT_SUMMARY: auditoría exact-blob del commit local Phase1. El commit
  bebd36c841f588fc9e4c74099e38a95d37d58982 tiene parent
  44b9da06ff2fa099cf7eb5fb971b13454f33f308, subject exacto y sólo
  prisma/schema.prisma. Parent contiene pushSubscription y el blob committed
  no; no hay migration T12, TS, reportes, package, tests ni 32. Generated
  Prisma client sin scalar, 11 callers compatibles, test terminal 26/26,
  Prisma validate/generate y build PASS, TSC sin diagnósticos nuevos.
COMMIT: bebd36c841f588fc9e4c74099e38a95d37d58982
PUSH: NO
DEPLOY: NO
RAILWAY_MUTATION: NO
PRODUCTION: NO
NEXT_TASK: P2-T12-STAGE4E
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T12-STAGE5A
VERDICT: PASS
FINDINGS: F-P0-05 TWO_PHASE_ROLLOUT_PHASE2_MIGRATION_LOCAL_PREPARED
RESULT_SUMMARY: Phase2 fue recreada localmente como una única migration
append-only con el directory original y una sentencia DROP COLUMN IF EXISTS.
El bloque archivado fue reproducido en 2134 bytes con SHA-256 exacto
cbd4a4684aceb41895f3d0b47335147c5470c80a90d2c434ecf51bf0ca43623d. Mapping
terminales_salon.pushSubscription confirmado desde parent y migration inicial.
Prisma validate/generate PASS; schema, TS y tests sin cambios; DB real no
accedida; no migration aplicada, commit, push ni deploy.
COMMIT: NO
PUSH: NO
DEPLOY: NO
RAILWAY_MUTATION: NO
PRODUCTION: NO
DB_REAL_READ: NO
DB_REAL_WRITE: NO
NEXT_TASK: P2-T12-STAGE5B
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T12-STAGE5C
VERDICT: PASS
FINDINGS: F-P0-05 TWO_PHASE_ROLLOUT_PHASE2_MIGRATION_COMMITTED_LOCAL
RESULT_SUMMARY: commit local exacto de Phase2 DROP. El commit
  7822d84ac5ac841978a77ebef76ad93630b69f42 tiene parent
  bebd36c841f588fc9e4c74099e38a95d37d58982, subject exacto y únicamente
  prisma/migrations/20260826230000_drop_terminal_operativa_push_subscription/migration.sql.
  El archivo conserva 2134 bytes y SHA-256
  cbd4a4684aceb41895f3d0b47335147c5470c80a90d2c434ecf51bf0ca43623d;
  no se modificaron schema, TS, tests, otras migrations ni 32. No se accedió
  DB, no se aplicó migration, no hubo push, deploy ni Railway.
COMMIT: 7822d84ac5ac841978a77ebef76ad93630b69f42
PUSH: NO
DEPLOY: NO
RAILWAY_MUTATION: NO
PRODUCTION: NO
DB_REAL_READ: NO
DB_REAL_WRITE: NO
MIGRATION_APPLIED: NO
NEXT_TASK: P2-T12-STAGE5D
ARCHIVE_REFERENCE: codex-reports/archive/P2-T12-STAGE5B.md

TASK_ID: P2-T12-STAGE5D
VERDICT: PASS
FINDINGS: F-P0-05 TWO_PHASE_ROLLOUT_PHASE2_POSTCOMMIT_CERTIFIED
RESULT_SUMMARY: auditoría adversarial post-commit desde el blob exacto de
  7822d84ac5ac841978a77ebef76ad93630b69f42. Parent, subject y fileset son
  exactos; el commit contiene únicamente la migration T12. Blob, bytes, SHA,
  encoding, estructura, comentarios, SQL, target físico, schema Phase1/Phase2,
  history purity, two-phase proof y Prisma validate pasaron. No hubo DB, apply,
  push, deploy ni Railway.
COMMIT: 7822d84ac5ac841978a77ebef76ad93630b69f42
PUSH: NO
DEPLOY: NO
RAILWAY_MUTATION: NO
PRODUCTION: NO
DB_REAL_READ: NO
DB_REAL_WRITE: NO
MIGRATION_APPLIED: NO
NEXT_TASK: P2-T12-STAGE5E
ARCHIVE_REFERENCE: codex-reports/archive/P2-T12-STAGE5C.md

TASK_ID: P2-T12-STAGE5E
VERDICT: PASS
FINDINGS: F-P0-05 TWO_PHASE_ROLLOUT_PHASE2_TESTING_CERTIFIED_AWAITING_CLOSEOUT
RESULT_SUMMARY: gates fresh de TESTING pasaron con exactamente una migration
  pendiente T12, cero fallidas, history T12 en cero y columna física presente.
  Se ejecutó exactamente un push fast-forward de Phase2; Railway TESTING
  autodesplegó el commit exacto, el preDeploy aplicó la migration DROP y el
  deployment terminó SUCCESS. Post-DROP: history exactamente 1, successful 1,
  pending/failed 0 y columna ausente. Smoke HTTP real autenticado: raíz/login,
  login negocio, creación/activación terminal, contexto 200, replay 400,
  revocación 200 y contexto revocado 401; sin exposición de salonActivo, sin
  Push/WebPush. Fixture aislada eliminada por ID exacto; negocio, terminal y
  auditoría quedaron en cero filas. Sin cambios de source/schema/tests,
  segundo push, redeploy manual, Production ni acceso a 32.
COMMIT: 7822d84ac5ac841978a77ebef76ad93630b69f42 (ya existente; no se creó ni modificó)
PUSH: SI — único fast-forward, exit 0
DEPLOY: SUCCESS — deployment cf5cca9a-e5f3-4a35-8b56-d6b90ec0c2b9
MIGRATION_APPLIED: SI_TESTING_ONLY
DB_URL_REQUIRED_VARIABLE_VALUE_PRINTED: NO
DATABASE_URL_FALLBACK: NO
PRODUCTION: NO
NEXT_TASK: P2-T12-STAGE5F
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T11-STAGE1
VERDICT: PASS
FINDINGS: F-P2-T11-01 CURRENT_STATE_AUDITED_HARDENING_REQUIRED (severity MEDIUM)
RESULT_SUMMARY: auditoría completa (read-only) de la arquitectura de auth
  de Socket.IO nativo: tokens socket-actor (TTL 300s) y room-capability
  (TTL 120s), sin re-chequeo de sesión ni revocación server-side en
  connect-time, logout que detiene sólo el manager de la pestaña actual sin
  invalidar credenciales ya emitidas en otras conexiones. Identificó el gap
  de propagación multi-tab. No resolvió aún reconnect-revocation ni
  existing-socket-revocation (quedaron UNRESOLVED para Stage1B). Sin DB
  real, sin mutación de código/tests/schema/Git/Railway.
COMMIT: ninguno
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T11-STAGE1B (native socket post-logout TTL hardening —
  distributed revocation design freeze)
ARCHIVE_REFERENCE: codex-reports/archive/P2-T11-STAGE1.md

TASK_ID: P2-T11-STAGE1B
VERDICT: PASS
FINDINGS: F-P2-T11-01 DESIGN_FROZEN_H1_HYBRID_SELECTED_AWAITING_IMPLEMENTATION
RESULT_SUMMARY: congeló el diseño completo de revocación post-logout sin
  dejar ningún ítem UNRESOLVED. Descubrimiento clave: el claim `sid` de
  cada JWT ya es `Sesion.id` (PK), permitiendo un chequeo de revocación en
  connect-time sin ningún cambio de schema/migration. Diseño seleccionado
  "H1": endpoint interno HMAC monolito↔chat-service (reusa el patrón ya
  existente de `realtime-publish.ts`) para rechazo inmediato de reconnect
  con sesión revocada; TTL de actor 300s→120s; TTL de room-capability sin
  cambio; nuevo listener nativo de evento `storage` para propagación
  cross-tab del logout (gap identificado en Stage1). La terminación
  forzada e inmediata de un socket ya conectado en otra instancia del
  chat-service queda explícitamente fuera de T11 — es el mandato de
  P2-T09 (frontera documentada explícitamente, sin absorberla). Se
  congelaron también: matriz de seguridad de 9 escenarios, inventario
  exacto de archivos a modificar/crear, contrato de tests (unit/chat-auth/
  integration/timing con reloj inyectable, sin sleeps reales), 4 modelos
  de carrera (R1-R4), rollout de dos fases (monolito primero, chat-service
  después) y matriz de compatibilidad de rollback (incluyendo una
  restricción asimétrica real: el chat-service debe revertirse con o antes
  que el monolito, nunca después). Se corrigió también una ambigüedad de
  higiene en el root `CODEX_REPORT.md` (markers de T12 sin prefijo
  colisionando con los de T11 activos). Sin DB real, sin mutación de
  código/tests/schema/migration/package/Git/Railway/Production.
COMMIT: ninguno
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T11-STAGE2 (implementation preparation — no ejecutado)
ARCHIVE_REFERENCE: codex-reports/archive/P2-T11-STAGE1B.md

TASK_ID: P2-T11-STAGE1B-R1
VERDICT: PASS
FINDINGS: F-P2-T11-01 DESIGN_FROZEN_H1_RECONCILED_CONNECTED_SOCKET_BOUND_PROVEN
RESULT_SUMMARY: auditó una posible contradicción en el diseño H1 de
  Stage1B: reducir el TTL del JWT a 120s no acota por sí solo un socket
  ya conectado, salvo que exista un mecanismo server-side que lo
  desconecte al llegar `exp`. Confirmó, tanto por lectura de código
  (`mini-services/chat-service/index.js:327-332`, un `setTimeout`
  programado en connect-time con el `exp` real del JWT) como por la
  ejecución real de un test existente
  (`mini-services/chat-service/test/security.test.js`, 12/12 PASS,
  incluyendo el caso específico "disconnects an already-connected socket
  when the actor token expires"), que ese mecanismo YA EXISTE en
  producción — no es trabajo nuevo de Stage2. El claim de Stage1B
  ("bounded by reduced TTL deferred to T09") queda `VALID`, con una
  corrección de precisión: el residual máximo se mide desde la EMISIÓN
  del token, nunca desde el instante del logout. Se construyó además un
  inventario exhaustivo de todo chequeo post-connect (room-cap TTL propio
  independiente del actor, recheck por-evento de cada room grant,
  ausencia de heartbeat que revalide auth, ausencia de reauth proactivo
  cliente-side), y una matriz de residual por 5 escenarios (same-tab,
  segunda pestaña, JWT viejo reconectando, réplica remota, room ya
  unida). La frontera con P2-T09 se mantiene intacta y con un propósito
  real: T11 provee un acotamiento por TTL ya vigente hoy; T09 provee
  terminación forzada instantánea cross-instance antes del vencimiento
  natural. Ningún archivo requiere cambios nuevos para el mecanismo de
  auto-expiración — el inventario de archivos de Stage2 se mantiene sin
  cambios salvo esa aclaración. Sin DB real, sin mutación de
  código/tests/schema/migration/package/Git/Railway/Production — el
  único test ejecutado (existente, no modificado) sirvió sólo como
  verificación empírica.
COMMIT: ninguno
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T11-STAGE2 (implementation preparation — no ejecutado)
ARCHIVE_REFERENCE: codex-reports/archive/P2-T11-STAGE1B-R1.md

TASK_ID: P2-T11-STAGE2
VERDICT: PASS
FINDINGS: F-P2-T11-01 IMPLEMENTATION_CONTRACT_FROZEN_READY_FOR_PHASE_A
RESULT_SUMMARY: congeló la especificación de implementación ejecutable
  del diseño H1, sin decisiones abiertas. Endpoint interno nuevo
  `POST /api/internal/realtime/session` (monolito), verificado vía HMAC
  con un secreto DEDICADO (`REALTIME_SESSION_CHECK_SECRET`) tras un
  análisis explícito de expansión de privilegio que descartó reusar
  `REALTIME_INTERNAL_PUBLISH_SECRET`. Nuevo helper de sólo lectura
  `isSesionActiveById` en `src/lib/auth.ts`, reusando exactamente la
  misma regla de vigencia que `validateSession` (fila existe +
  `expiresAt` futuro), sin el borrado lazy-expiry. Descubrió y registró
  un literal `expiresIn: 300` hardcodeado en `src/app/api/realtime/
  token/route.ts` que habría quedado desincronizado al bajar el TTL —
  corregido en el contrato para importar la constante en vez de
  duplicar el número. Congeló tres fases de rollout con una única
  dependencia dura (B requiere A ya vivo en TESTING, de lo contrario
  fail-closed rechaza el 100% de conexiones nuevas) y confirmó, vía el
  historial de despliegue ya registrado en este mismo sistema de
  reportes, que Railway despliega ambos servicios del monorepo a cada
  push sin filtrado por paths — por lo que el orden de fases se logra
  con secuencia de commits, no con despliegue selectivo. Descubrió que
  la propagación cross-tab NO necesita ninguna key de storage nueva ni
  matching de sesión: reusa la key `deligo-auth` YA escrita por Zustand
  persist (que nunca contiene tokens/secretos) y, dado que
  `deligo_session` es una cookie de origen compartida por todas las
  pestañas del mismo browser, sólo puede existir una sesión activa por
  navegador — eliminando la necesidad de cualquier estrategia de
  correlación. Congeló un allowlist exacto de 13 archivos (nuevos +
  modificados) repartidos en 3 fases, un contrato de tests completo
  (endpoint interno: 10 casos; chat-service: 12 casos; cliente: 6
  aserciones estáticas), una matriz de compatibilidad con un único caso
  UNSAFE evitado por el orden de rollout, una matriz de rollback, y 4
  modelos de carrera clasificados sin prometer linealizabilidad falsa
  (toda conexión aceptada por una carrera queda acotada por el mismo
  TTL ya reconocido, nunca un hueco nuevo). Sin DB real, sin mutación de
  código/tests/schema/migration/package/Git/Railway/Production.
COMMIT: ninguno
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T11-STAGE3A (phase A monolith internal session validation local implementation — no ejecutado)
ARCHIVE_REFERENCE: codex-reports/archive/P2-T11-STAGE2.md

TASK_ID: P2-T11-STAGE3A
VERDICT: PASS
FINDINGS: F-P2-T11-01 PHASE_A_LOCAL_IMPLEMENTED_AWAITING_PRECOMMIT_REVIEW
RESULT_SUMMARY: implementó localmente y EXCLUSIVAMENTE Phase A del
  contrato congelado en Stage2. Archivos: `src/lib/internal-session-
  check-auth.ts` (nuevo, verificación HMAC dedicada, puerto directo de
  `internal-publish-auth.js` con secreto propio `REALTIME_SESSION_
  CHECK_SECRET`, nunca reusa el del bridge de publish); `src/app/api/
  internal/realtime/session/route.ts` (nuevo, `POST /api/internal/
  realtime/session`, sólo acepta `{sid}`, responde siempre `{valid:
  boolean}`, fail-closed ante secreto ausente/HMAC inválido/replay);
  `src/app/api/internal/realtime/session/route.test.ts` (nuevo, 14/14
  PASS, mocks de `@/lib/db` ejerciendo la lógica real del helper, no un
  stub del helper mismo); `src/lib/auth.ts` (agrega `isSesionActiveById`,
  13 líneas, misma regla de vigencia que `validateSession` pero de sólo
  lectura). Verificado: 0 errores nuevos de TSC (baseline 31 sin
  cambio) ni de ESLint; `next build` PASS con la ruta nueva en el
  manifiesto; `mini-services/**` sin ningún cambio (chat-service
  permanece completamente inerte frente al endpoint nuevo); TTL del
  actor sigue en 300s; sin listener cross-tab; sin schema/migration/
  package/lockfile. Diff real = subset exacto del allowlist de Phase A
  (4 archivos, ni uno más). Revisión de seguridad estática: sin auth
  bypass, sin fallback de secreto, comparación constant-time, sin
  enumeración de sesión, sin fuga de secretos/MAC en logs, ruta GET no
  expuesta. Un artefacto incidental (`tsconfig.tsbuildinfo`) generado
  por la propia verificación de TSC fue detectado y eliminado antes del
  chequeo final. Sin DB real, sin commit/push/deploy/Railway/Production.
COMMIT: ninguno
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T11-STAGE3B (phase A local implementation pre-commit adversarial review — no ejecutado)
ARCHIVE_REFERENCE: codex-reports/archive/P2-T11-STAGE3A.md

TASK_ID: P2-T11-STAGE3B
VERDICT: PASS
FINDINGS: F-P2-T11-01 PHASE_A_PRECOMMIT_CERTIFIED_READY_FOR_LOCAL_COMMIT
RESULT_SUMMARY: auditoría adversarial de los 4 archivos locales de Phase
  A, con mandato explícito de intentar demostrar que la implementación
  estaba mal — no se confió en el `14/14 PASS`/`BUILD=PASS` reportado por
  Stage3A. Releyó los 4 archivos completos, re-ejecutó tests/lint/TSC/
  build de forma independiente (mismo resultado exacto: 14/14, 0
  errores nuevos, build PASS), y ejecutó un script adversarial temporal
  (creado y eliminado dentro de la misma tarea, nunca stageado ni
  commiteado, verificado limpio después) con 19 casos nuevos usando un
  mock de `db.sesion.findUnique` que cuenta invocaciones: secreto de
  firma incorrecto, corrupción de un carácter de una firma REAL (más
  riguroso que el propio test de Stage3A, que usaba una firma
  trivialmente inválida), tamper del body manteniendo la firma original,
  timestamps límite en ambas direcciones de la ventana de skew, secreto
  ausente/corto, excepción forzada del lookup de sesión, y variantes de
  body malformado (array, null, `sid` numérico/gigante/con caracteres de
  path-traversal/intento de contaminación vía `__proto__`). Los 19 casos
  confirmaron: cero lecturas de sesión en cada rama de rechazo, y
  fail-closed genuino ante excepción (nunca `{valid:true}` por defecto).
  Confirmó también, por grep repo-wide, que Phase A permanece
  completamente inerte (cero referencias desde `mini-services/**` o
  cualquier código cliente) y que ningún secreto se reutiliza entre los
  dos canales internos. No se encontró auth bypass, fail-open, debilidad
  de canonicalización/replay, reuso de secreto, enumeración de sesión,
  consulta DB antes de autenticar, fuga en respuesta/logs, scope drift ni
  activación prematura de Phase B. Propuso el subject de commit
  `feat: add internal realtime session validation endpoint` (consistente
  con la convención real del repo). Certificó Phase A lista para un
  commit local exacto de los mismos 4 archivos. Sin DB real, sin
  mutación de código/tests/schema/migration/package/Git/Railway/
  Production.
COMMIT: ninguno
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T11-STAGE3C (phase A exact local commit — no ejecutado)
ARCHIVE_REFERENCE: codex-reports/archive/P2-T11-STAGE3B.md

TASK_ID: P2-T11-STAGE3C
VERDICT: PASS
FINDINGS: F-P2-T11-01 PHASE_A_LOCAL_COMMIT_COMPLETE_AWAITING_POSTCOMMIT_PREPUSH_REVIEW
RESULT_SUMMARY: convirtió la implementación de Phase A, ya certificada
  adversarialmente en Stage3B, en exactamente un commit local. Preflight
  fresco confirmó HEAD=origin=7822d84a sin drift; hashes de los 4
  archivos reconfirmados sin mutación desde Stage3B; snapshot de
  invariantes (endpoint, helper, secreto dedicado, TTL 300/120,
  ausencia de listener cross-tab) confirmado antes de stagear; test
  focal re-ejecutado (14/14 PASS, no reutilizado ciegamente). Stage
  exacto vía `git add -- <4 paths>` (nunca `-A`/`.`); auditoría
  inmediata del índice confirmó exactamente 4 archivos staged, sin
  reportes/`32`/schema/chat-service; contenido leído directamente desde
  el índice (`git show :<path>`) antes de commitear. Commit único
  (`git commit`, exit 0, sin amend, sin segundo intento): hash
  `d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1`, parent
  `7822d84ac5ac841978a77ebef76ad93630b69f42`, subject exacto `feat: add
  internal realtime session validation endpoint`. Post-commit: leyó los
  blobs del commit directamente (`git show HEAD:<path>`), confirmando
  contenido idéntico al certificado y ausencia total de reportes/`32`/
  schema/migration/package/chat-service/archivos de Phase C dentro del
  commit; confirmó desde `HEAD` que TTL del actor sigue en 300s, TTL de
  room-cap en 120s, y que no existe listener cross-tab — Phase A sigue
  siendo desplegable de forma aislada sin ningún riesgo nuevo. Git final:
  `AHEAD=1`/`BEHIND=0` respecto de `origin/testing-codex`, que no
  cambió durante la tarea; working tree limpio, índice vacío. Sin
  push/deploy/Railway/DB real.
COMMIT: d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T11-STAGE3D (phase A post-commit / pre-push exact-blob review — no ejecutado)
ARCHIVE_REFERENCE: codex-reports/archive/P2-T11-STAGE3C.md

TASK_ID: P2-T11-STAGE3D
VERDICT: PASS
FINDINGS: F-P2-T11-01 PHASE_A_POSTCOMMIT_CERTIFIED_READY_FOR_TESTING_PUSH
RESULT_SUMMARY: recertificó de forma independiente el commit local
  `d0ba59d` directamente desde los objetos Git, sin confiar en Stage3B/
  3C. Derivó los 4 blob IDs vía `git ls-tree HEAD` y leyó el contenido
  completo de cada uno vía `git show HEAD:<path>` — byte-idéntico a lo
  certificado (helper `isSesionActiveById`, endpoint con orden
  HMAC-antes-que-DB, secreto dedicado `REALTIME_SESSION_CHECK_SECRET`
  sin fallback, 14 tests sin `.skip`/`.only`/`.todo`). Re-ejecutó de
  forma independiente: test focal (14/14 PASS), lint (0 errores nuevos),
  TSC (31 baseline sin cambio, 0 nuevos en Phase A), build (`next build`
  PASS, ruta en el manifiesto), y un script adversarial temporal (19/19
  PASS, reutilizado desde el scratchpad, copiado brevemente al repo,
  ejecutado y eliminado de inmediato, verificado limpio por `git
  status`). Confirmó, vía `git grep` directamente sobre el árbol de
  `HEAD` (no el working tree), que Phase A permanece completamente
  inerte — cero referencias desde `mini-services/**` o cualquier código
  cliente — y que el secreto dedicado no es leído por ningún otro
  archivo del repo. Confirmó desde los blobs que TTL del actor sigue en
  300s, room-cap en 120s, y no existe listener cross-tab. Confirmó que
  el working tree coincide exactamente con el commit (`git diff HEAD`
  vacío) y que origin no cambió durante la tarea (`AHEAD=1`/`BEHIND=0`).
  Certificó Phase A lista para el push de Stage3E. Sin DB real, sin
  mutación de código/tests/schema/migration/package/Git/Railway/
  Production — ni commit nuevo ni amend.
COMMIT: d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1 (sin cambios; no se creó ni modificó ningún commit en esta tarea)
PUSH: NO
DEPLOY: NO
NEXT_TASK: P2-T11-STAGE3E (phase A fresh testing gates / exact push + deploy certification — no ejecutado)
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T18-STAGE1
VERDICT: PASS
FINDINGS: F-P1-01 REPRODUCED (acceptance contract frozen); F-P1-02 REPRODUCED (acceptance contract frozen); P2-T18 BASELINE_SCOPE_FROZEN
RESULT_SUMMARY: recuperó textualmente F-P1-01/F-P1-02 desde
  codex-reports/archive/LEGACY_FULL_REPORT_20260826.md (única autoridad —
  ausentes de los seis registros activos post-reorganización). Re-derivó el
  estado ACTUAL de forma independiente (no copió el histórico OPEN): lectura
  exhaustiva del código real confirmó ambos root causes sin cambio desde
  hace un año (chat-service/index.js excluye sólo por socket.id, nunca por
  actor, en typing/stop-typing/mark-read; chat-sheet.tsx nunca filtra por
  identidad propia; el callback de messages-read sigue vacío). Auditó fix
  incidental: P2-T04 tocó un subsistema adyacente (chatRevision) pero
  documentó explícitamente preservar sin cambio el no-op de messages-read.
  Clasificó ambos REPRODUCED, UI_POLISH, sin relación con seguridad ni con
  P2-T11 (preservado CLOSED). Congeló contratos de aceptación independientes
  y un allowlist candidato de 1 archivo de producto (chat-sheet.tsx, dos
  guardas de identidad de una línea, client-side, sin tocar el servidor de
  chat). No usó navegador real ni fixture (decisión justificada: mecanismo
  determinista por código, no dependiente de timing/compositing). No
  implementó ningún fix — sólo auditoría/baseline/scope freeze.
COMMIT: ninguno — sin mutación de código/tests/Git/Railway/DB en esta tarea
PUSH: NO
DEPLOY: NO
P2_T18_STATUS: BASELINE_SCOPE_FROZEN
NEXT_TASK: P2-T18-STAGE2 (CHAT CROSS-TAB UI POLISH — F-P1-01 / F-P1-02 LOCAL IMPLEMENTATION) — no ejecutado
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T11-STAGE5G
VERDICT: PASS
FINDINGS: F-P2-T11-01 RESOLVED; P2-T11 CLOSED
RESULT_SUMMARY: cierre final read/audit/report-only. Reconstruyó y confrontó
  toda la cadena Stage1->Stage5F contra Git real, los seis registros
  canónicos y los archives de diseño (Stage1/Stage1B/Stage1B-R1/Stage2), sin
  contradicción. Confirmó que Phase A (d0ba59d), Phase B (e8d2171) y Phase C
  (f6ca24f) forman una cadena estrictamente aditiva (diff byte-a-byte ya
  probado en Stage5D). Construyó la matriz de los 10 puntos de aceptación
  congelados en Stage2 -- 10/10 PASS con evidencia runtime real server-side
  (PostgreSQL + HTTP + socket) y de navegador real (Chromium/CDP). Evaluó el
  residual de logout tardío bajo timing patológico de navegador contra un
  modelo de amenaza de 4 preguntas (resurrección de sesión, reautorización de
  actor, acceso no autorizado, escalación de privilegio) -- las 4 NO -- y lo
  dispuso como ACCEPTED_LOW_NON_SECURITY_BLOCKING_LIMITATION, con política de
  reapertura explícita, sin forzar RESOLVED ni IMPOSSIBLE. Terminación forzada
  cross-instance permanece fuera de este cierre, mandato de P2-T09. Sin
  mutación de código/tests/schema/migration/package/Git/Railway/Production.
COMMIT: ninguno — sin mutación de código/tests/Git/Railway/DB en esta tarea
PUSH: NO
DEPLOY: NO
P2_T11_STATUS: CLOSED
NEXT_TASK: P2-T18-STAGE1 (Chat Cross-Tab UI Polish, complejidad 2/10) — no ejecutado
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T18-BLOCKER-AUTH2-R13-R4
VERDICT: PASS
FINDINGS: F-P2-T18-AUTH02 pasa de LOCAL_IMPLEMENTED_PRECOMMIT_CERTIFIED
  (con una excepción temporal de infraestructura de TESTING aceptada por el
  usuario en R13-R3-RETRY-2-R2-R1A, EX-P2-T18-SEC-BLOCK-1-P2028) a
  LOCAL_COMMIT_COMPLETE
RESULT_SUMMARY: conversión exacta a commit del candidato AUTH02 ya
  certificado (14 paths, 7 producto + 7 test) — sin mutar ni un solo byte.
  Rehash pre-stage 14/14 idéntico a la autoridad certificada; staging
  explícito vía `git add --` de exactamente esos 14 paths; probado
  staged==worktree==certificado 14/14 por blob hashing directo antes de
  commitear; un único `git commit` sin amend; recertificado postcommit
  desde los objetos Git (diff-tree, blobs 14/14 contra HEAD) sin confiar
  sólo en el exit code.
COMMIT: fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f ("fix: scope shared auth
  requests by actor family", parent a1579f11e79a41b90c6df4d2e8573ca9a669b856)
PUSH: NO
DEPLOY: NO
P2_T18_STATUS: BLOCKED_AUTH02_LOCAL_COMMIT_COMPLETE_AWAITING_R13_R5
NEXT_TASK: P2-T18-BLOCKER-AUTH2-R13-R5 (POSTCOMMIT PREPUSH EXACT BLOB REVIEW) — no ejecutado
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T18-BLOCKER-AUTH2-R13-R5
VERDICT: PASS
FINDINGS: F-P2-T18-AUTH02 pasa de LOCAL_COMMIT_COMPLETE a
  POSTCOMMIT_CERTIFIED_READY_FOR_FRESH_TESTING_PREPUSH
RESULT_SUMMARY: recertificación INDEPENDIENTE del commit `fe0e11d0` (R13-R4)
  leyendo objetos Git directamente desde HEAD — sin confiar en el resumen
  de R13-R4, sin re-ejecutar ningún test (0 test runs, 0 acceso a DB).
  Fileset commiteado derivado por 2 métodos Git (diff-tree, show
  --name-only) — 14 paths exactos, 0 rutas prohibidas. 14 blob IDs vía
  `git ls-tree HEAD` — 14/14 idénticos a los certificados. Lectura directa
  de los 14 blobs confirmó el contrato de selector de proxy.ts, el
  contrato de Chat/Push, y las protecciones M9/M19. Diff commiteado
  completo revisado (33 hunks, 0 sin clasificar/incidental). 0 diferencia
  de working tree contra HEAD.
COMMIT: ninguno nuevo — sólo lectura/verificación del commit fe0e11d0 ya
  existente
PUSH: NO
DEPLOY: NO
P2_T18_STATUS: BLOCKED_AUTH02_POSTCOMMIT_CERTIFIED_AWAITING_R13_R6
NEXT_TASK: P2-T18-BLOCKER-AUTH2-R13-R6 (FRESH PREPUSH + TESTING PUSH/DEPLOY CERTIFICATION) — no ejecutado
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T18-BLOCKER-AUTH2-R13-R6
VERDICT: PASS
FINDINGS: F-P2-T18-AUTH02 pasa de POSTCOMMIT_CERTIFIED_READY_FOR_FRESH_TESTING_PREPUSH
  a DEPLOYED_TESTING_AWAITING_FULL_REAL_BROWSER_REPLAY
RESULT_SUMMARY: gate final de entrega server-side, lean por prioridad
  explícita del usuario. Continuidad de blobs 14/14 contra R13-R5. Focal
  fresco (única corrida): 117 pass / 0 fail / 280 expect() calls,
  idéntico al histórico. ESLint limpio; TSC 31/24 idéntico a la baseline
  vigente (0 nuevo en los 14 paths de AUTH02); git show --check y npm run
  build limpios. Railway confirmado read-only amiable-rejoicing/TESTING,
  sin deploy concurrente, health prepush limpio. Ejecutó exactamente un
  `git push origin testing-codex` (a1579f1..fe0e11d, sin --force).
  Observó read-only el autodeploy Git-triggered: DeliGO Copy y chat en
  vivo ambos SUCCESS en fe0e11d0 exacto (confirmado desde metadata real
  de Railway). Health/logs postdeploy limpios, 0 errores materiales.
COMMIT: ninguno nuevo — sólo push del commit fe0e11d0 ya existente
PUSH: SI (a1579f11e79a41b90c6df4d2e8573ca9a669b856..fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f)
DEPLOY: SI (Git-triggered autodeploy, TESTING — DeliGO Copy + chat en vivo, ambos SUCCESS)
P2_T18_STATUS: BLOCKED_ONLY_BY_FULL_REAL_BROWSER_REPLAY_AND_REMAINING_CHAT_UI_ACCEPTANCE
NEXT_TASK: P2-T18-BLOCKER-AUTH2-R13-R7 (FULL REAL-BROWSER REPLAY FROM ZERO) — no ejecutado
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T18-BLOCKER-AUTH2-R13-R7
VERDICT: PASS
FINDINGS: F-P2-T18-AUTH01 RESOLVED, F-P2-T18-AUTH02 RESOLVED
RESULT_SUMMARY: repitió desde cero, con Chrome real (Claude in Chrome,
  "Browser 2") contra el commit desplegado fe0e11d0, la matriz histórica
  de 18 casos de R13 — 0/18 de crédito heredado. Fixtures TESTING
  frescas (prefijo P2T18_AUTH2_R13_R7_) vía harness externo que replica
  hashPassword(). Resultado: 18/18 PASS, incluyendo el ataque directo a
  AUTH01 (Cliente sobrevive sin recarga al login de Negocio, CASE_05) y
  la recreación directa del síntoma AUTH02 (chat/push 401 con ambos
  actores coexistiendo — no reproducido, CASE_09). Dos correcciones de
  control documentadas (dentro del presupuesto máximo de 2). Cleanup
  completo: 0 filas residuales DB, 0 tabs remanentes.
COMMIT: ninguno — etapa de sólo aceptación con navegador real, sin
  mutación de producto/test
PUSH: NO
DEPLOY: NO
P2_T18_STATUS: BLOCKED_ONLY_BY_REMAINING_CHAT_UI_REAL_BROWSER_ACCEPTANCE_F_P1_02_THEN_F_P1_01
NEXT_TASK: P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE — no ejecutado
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE
VERDICT: BLOCKED_REAL_BROWSER_TYPING_CONTROL_INVALID
FINDINGS: F-P1-02 REAL_BROWSER_TYPING_CONTROL_INVALID (ni PASS ni FAIL); F-P1-01 sin cambio (no ejecutado)
RESULT_SUMMARY: intentó certificar con Chrome real (Browser 2) el fix
  ya desplegado de F-P1-02 (commit 1adcc01f) contra fe0e11d0.
  AUTH01/AUTH02 preservados RESOLVED sin reabrir. Fixture fresca
  TESTING, topología X1/X2 (mismo Cliente) + Y1 (Negocio distinto),
  baseline de chat bidireccional PASS. La matriz de typing (Y1→X1/X2,
  X1→Y1), repetida con room-grants recién renovados en cada intento,
  nunca mostró el indicador en el receptor en ninguna dirección —
  confirmado por lectura de código que el emisor sí disparaba
  sendTyping, y descartado un problema visual/CSS vía body.innerText.
  Sin control remoto positivo válido: CONTROL_INVALID, no FAIL ni
  PASS de producto. Ningún fix intentado.
COMMIT: ninguno — sin mutación de producto/test
PUSH: NO
DEPLOY: NO
P2_T18_STATUS: BLOCKED_ONLY_BY_REMAINING_CHAT_UI_REAL_BROWSER_ACCEPTANCE_F_P1_02_THEN_F_P1_01
NEXT_TASK: P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R1 — no ejecutado
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

TASK_ID: P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R1
VERDICT: PASS_DIAGNOSIS_GENUINE_TYPING_CHANNEL_DEFECT_ISOLATED
FINDINGS: F-P2-T18-TYPING-CHANNEL-01 created (DIAGNOSED_FIRST_HOP_ISOLATED_ROOT_CAUSE_UNKNOWN); F-P1-02 status changed to BLOCKED_BY_TYPING_CHANNEL_DEFECT
RESULT_SUMMARY: diagnóstico acotado (máximo 3 observaciones) aisló el
  primer tramo roto del pipeline de typing. Observation 1 (harness
  externo, socket.io-client real, dos actores reales) confirmó el
  chat-service 100% sano en ambas direcciones. Observation 2 (Browser 2
  real, espera deliberada de 5s antes de escribir) descartó timing/
  room-grant. Observation 3 (observador temporal de solo lectura de
  WebSocket, excepción puntual del prompt) confirmó, corroborado por
  read_network_requests, que el navegador nunca intenta conectar al
  chat-service pese a que /realtime/token y /realtime/authorize
  devuelven 200. FIRST_BROKEN_HOP=HOP_B,
  R1_CLASSIFICATION=SENDER_CLIENT_EGRESS_DEFECT. No es el guard de
  auto-eco de F-P1-02 el que falla. Ningún fix intentado — causa raíz
  interna queda pendiente por presupuesto agotado.
COMMIT: ninguno — etapa de sólo diagnóstico, sin mutación de producto/test
PUSH: NO
DEPLOY: NO
P2_T18_STATUS: BLOCKED_ONLY_BY_REMAINING_CHAT_UI_REAL_BROWSER_ACCEPTANCE_F_P1_02_THEN_F_P1_01
NEXT_TASK: PENDING_USER_DISPOSITION (sin R2 automático — requiere elegir entre investigar/corregir ahora, diferir y avanzar a F-P1-01, o diferir ambos y cerrar P2-T18 con residual aceptado)
ARCHIVE_REFERENCE: codex-reports/CURRENT_TASK.md

---

## PRODUCTION-VS-TESTING-CODEX-SYNC-AUDIT — 2026-08-29

TASK: Auditoría completa de sincronización entre Production y
testing-codex, solicitada por el usuario tras pausar P2-T18. Incluyó
una consolidación posterior con máximo detalle estructurado tras un
prompt formal del usuario que detuvo explícitamente cualquier avance
automático hacia P2-T06.
RESULT: COMPLETE — código (241 commits/673 archivos de drift),
schema (15 tablas ausentes, 27 migraciones categorizadas
individualmente), variables (9 sólo-TESTING, 3 secretos compartidos
con match interno confirmado), y un hallazgo crítico
(`REALTIME_INTERNAL_SERVICE_URL`) verificado y clasificado
`INCONCLUSIVE` con evidencia completa.
SOURCE_MUTATION: NO
TEST_MUTATION: NO
PRODUCTION_DB_WRITE: NO
RAILWAY_CONFIG_MUTATION: NO
COMMIT: NO
PUSH: NO
DEPLOY: NO
P2_T06_STATUS: NOT_STARTED (scope no definido, ejecución no autorizada, sin avance automático — instrucción explícita del usuario)
NEXT_TASK: PENDING_USER_PROMPT (el usuario revisará codex-reports/PRODUCTION_SYNC_AUDIT.md y definirá la siguiente acción)
ARCHIVE_REFERENCE: codex-reports/PRODUCTION_SYNC_AUDIT.md, codex-reports/CURRENT_TASK.md

## BUSINESS-HOURS-TIMEZONE-PRODUCTION-PROMOTION-R1 — COMPLETADA

`SOURCE_COMMIT_CREATED_THIS_TASK=NO`; commit promovido: `a178140ef5167dce1b596edeb58e17cc7029beaf`. Production migration count `1`, business data write count `0`, DB final `28/28/0`, Railway deployment PASS, API/catalogue demo PASS, backup post-timezone restaurable PASS. No public launch authorization.

## P2-T41-TERMINAL-READ-ONLY-ACTION-AUTHORIZATION — 2026-09-10

TASK: Terminal Operativa (Salón, incl. perfil default de solo lectura
"pantalla") podía cancelar pedidos de mesa y cerrar la cuenta comercial
igual que Cuenta Operativa personal — reversión de política de
producto por autoridad explícita del operador sobre un diseño previo
deliberado (23-A1), no corrección de un bug accidental.
RESULT: COMPLETE (implementación) — Terminal ahora resuelve con su
propio tipo de actor (`salon_terminal`) en `resolverActorCancelacionMesa`
y `resolveMesaOccupancyCloseActor`; ambos endpoints de mutación
(cancelar pedido, cerrar cuenta comercial) lo deniegan 403 server-side;
UI retira "Cancelar pedido" y oculta "Cerrar cuenta" en
`/operaciones/salon`; cierre técnico y PyR sin cambios de
comportamiento.
TESTS: 229 pass / 0 fail real-DB combinados (72 existentes actualizados
+ 61 contract/client/ui-contract + 7 nuevo focal
`p2-t41-terminal-cierre-cuenta.test.ts` + 89 regresión dirigida).
QUALITY: TYPECHECK_RAW=31 (0 nuevos), ESLint 0 nuevos (1 preexistente
fuera de alcance), BUILD_PASS=SI, DIFF_CHECK_PASS=SI.
SOURCE_MUTATION: SI (8 archivos: 5 producto + 3 test)
COMMIT: fb404a2d510998f53f305ba497b9c543ef4cee53
PUSH: SI (testing-codex únicamente)
DEPLOY: SUCCESS (TESTING, deployment 03774f34-75a1-493b-9bc2-0a6a7e4670bb, commit match confirmado)
P2_T41_STATUS: IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_OPERATOR_CERTIFICATION — no se declara CLOSED_TESTING_CERTIFIED porque cambia acciones visibles de Terminal; requiere control físico/browser del operador (checklist corto en el reporte) — **SUPERADO abajo**: el operador certificó PASS, ver entrada `P2-T41-OPERATOR-CERTIFICATION-CLOSEOUT` más abajo — `P2_T41_STATUS=CLOSED_TESTING_CERTIFIED`
NEXT_TASK: OPERATOR_TERMINAL_READ_ONLY_CERTIFICATION_P2_T41
ARCHIVE_REFERENCE: codex-reports/P2_T41_TERMINAL_READ_ONLY_ACTION_AUTHORIZATION.md

## P2-T41-OPERATOR-CERTIFICATION-CLOSEOUT — 2026-09-10

TASK: Registrar la certificación física/browser del operador para
P2-T41 y cerrar formalmente la tarea. DOCUMENTATION ONLY — sin código,
tests, commit, push, deploy ni DB.
RESULT: COMPLETE — el operador ejecutó el checklist completo contra
TESTING con resultado TODO PASS: (A) "Cancelar pedido" NO aparece en
ningún pedido de Terminal Salón; (B) "Ver cuenta" funciona; (C)
"Cerrar cuenta" NO aparece dentro de "Ver cuenta"; (D) navegación/
lectura de mesa, pedidos, historial y estadísticas de Terminal Salón
funcionan con normalidad; (E) Terminal PyR conserva sus acciones
existentes (el workflow nuevo de PyR es P2-T42, no exigido acá).
Autoridad server-side de la implementación preservada sin cambios:
`TERMINAL_GLOBAL_MUTATION_BAN=NO`, `TERMINAL_READ_ONLY_CONTEXT_
ENFORCEMENT=SI`, `CANCEL_BOLA_CHECK=PASS`, `CLOSE_ACCOUNT_BOLA_
CHECK=PASS`, `PYR_TERMINAL_REGRESSION=PASS` — el cierre se basa en UI +
autorización server-side, nunca sólo en ocultar botones.
TESTS: sin re-ejecución en esta tarea (documentación únicamente) —
autoridad preservada de la implementación: 229 pass / 0 fail,
TYPECHECK_BASELINE_REAL=31 (0 nuevos), ESLint 0 nuevos (1 preexistente
fuera de alcance).
SOURCE_MUTATION: NO
TEST_MUTATION: NO
DB_TOUCHED: NO
COMMIT: NO (HEAD sin cambios: fb404a2d510998f53f305ba497b9c543ef4cee53)
PUSH: NO
DEPLOY: NO
PRODUCTION_TOUCHED: NO
P2_T41_STATUS: CLOSED_TESTING_CERTIFIED — **SUPERADO abajo**: promovido a Production, ver entrada `P2-T41-PROMOTION-TO-MAIN-AND-PRODUCTION` más abajo — `P2_T41_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`
P2_T41_RELEASE_ELIGIBLE: SI — NEXT_RELEASE_CANDIDATE=P2-T41 (promoción a main/Production NO ejecutada en esta tarea)
NEXT_TASK: P2_T41_PROMOTION_EVALUATION (P2-T42 — PyR Employee + Terminal Order Workflow Parity — permanece READY_FUTURE, no iniciada)
ARCHIVE_REFERENCE: codex-reports/P2_T41_OPERATOR_CERTIFICATION_CLOSEOUT.md

## P2-T41-PROMOTION-TO-MAIN-AND-PRODUCTION — 2026-09-10

TASK: Promover a Production el fix certificado P2-T41 (Terminal
Read-Only Action Authorization), tras confirmar que el delta real
`origin/main..origin/testing-codex` corresponde exactamente a T41 (8
archivos, ninguno ajeno) y re-verificar tests/typecheck/lint/build
frescos sobre ese source exacto.
RESULT: COMPLETE — delta clasificado 100% `P2_T41` (5 producto + 3
test); re-ejecución fresca: 140 pass focal + 103 pass regresión = **243
pass / 0 fail** (corrección aritmética: el "229" del reporte de
implementación original sumaba mal dos corridas separadas de
regresión); TYPECHECK_RAW=31 (0 nuevos); ESLint 0 nuevos (1
preexistente ya documentado); build/diff-check limpios; 0 cambios de
schema/migración; 0 secretos/PII nuevos.
PROMOTION_METHOD: `git commit-tree` (mismo patrón de las 6 promociones
anteriores) — tree de `testing-codex@fb404a2` (verificado byte-igual),
parent `origin/main@773664f8`.
COMMIT: `bb17c7dd1eb9b8f4cb94d03de834019baf182987` ("release: promote
certified p2-t41 checkpoint", trailers `Source-Head`/
`Source-Main-Parent`)
PUSH: `main` (fast-forward por SHA exacto, sin force) — `testing-codex`
sin cambios (`fb404a2d510998f53f305ba497b9c543ef4cee53`)
DEPLOY: SUCCESS ambos servicios relevantes (DeliGO Production,
deployment `cd8f207e-6e23-4c7b-aca7-a6188e4eab52`; chat en vivo,
redeploy incidental por mismo repo, deployment
`2f799d4b-df32-4ebf-9523-881a2a10032d`), commit exacto verificado,
primer intento, logs limpios ("No pending migrations to apply")
SMOKE: 4/4 PASS no-mutante (`GET /` 307, `GET .../salon/panel` 401 sin
sesión, `GET .../ocupaciones/.../cuenta` 404 ocupación inexistente,
chat-service `GET /` 200) — nunca se ejecutó POST cancelar/cerrar
cuenta contra Production, nunca se fabricó sesión
TAG: `p2-t41-stable-2026-09-10` -> `bb17c7d`, creado y pusheado sólo
tras confirmar deploy SUCCESS + commit match + smoke PASS
P2_T41_STATUS: CLOSED_PRODUCTION_CHECKPOINTED
P2_T42_INCLUDED_IN_RELEASE: NO
NEXT_TASK: P2-T42 — PyR Employee + Terminal Order Workflow Parity (permanece READY_FUTURE, no iniciada en esta tarea)
ARCHIVE_REFERENCE: codex-reports/P2_T41_PROMOTION_TO_MAIN_AND_PRODUCTION.md

## P2-T42-PYR-EMPLOYEE-TERMINAL-ORDER-WORKFLOW-PARITY — 2026-09-10

TASK: PyR (Employee y Terminal) ordenaba pedidos oldest-first (FIFO
explícito) y ofrecía saltar de "recibido" directo a preparar, luego
"marcar en camino" manualmente con broadcast a TODOS los repartidores —
el modelo pre-P2-T29C que Negocio ya dejó atrás. El propio diseño de
P2-T29 ya recomendaba agregar "aceptado" a PyR "si el operador lo
autoriza" — autorizado ahora.
RESULT: COMPLETE (implementación) — PyR reutiliza la MISMA autoridad de
transición que ya usa Negocio (`PYR_ROLLOUT_FORWARD_TRANSITIONS`, alias
de `NEGOCIO_T29B_ROLLOUT_FORWARD_TRANSITIONS`): recibido→aceptado→
preparando→{esperando_repartidor(domicilio)|listo_para_retirar(retiro)}→
entregado. Employee gana `aceptar` y `buscar-repartidor` (nuevos,
reemplaza al retirado `en-camino`); Terminal (PATCH genérico) adopta el
mismo grafo, preservando aristas legacy. Ambos listados pasan a
newest-first. 10 archivos que duplicaban la misma lista de "estados
activos" se consolidan en un export compartido. Terminal Salón (P2-T41)
sin cambios.
TESTS: 134 pass / 0 fail (11 nuevo focal sort+workflow real-DB + 13
mock-based transitions [6 preservados+7 nuevos] + 45 order-transitions
puro + 26 mensajes/aislamiento + 39 regresión Negocio/Salón).
QUALITY: TYPECHECK_RAW=31 (0 nuevos), ESLint 0 nuevos (1 preexistente
sin relación), BUILD_PASS=SI, DIFF_CHECK_PASS=SI.
SOURCE_MUTATION: SI (19 archivos: 17 producto + 2 test; 2 nuevos
endpoints, 1 retirado)
COMMIT: eb2af3a598bf4e91ccd48b06092fb892a7ac0f9b
PUSH: SI (testing-codex únicamente)
DEPLOY: SUCCESS (TESTING, deployment d379ff8e-ec92-4727-868a-4969c4e36586 + chat en vivo incidental b354b63d-c32e-4f4b-be6d-f019e6ae2317, commit match confirmado en ambos)
P2_T42_STATUS: WAITING_FOR_OPERATOR_PHYSICAL_OR_BROWSER_CERTIFICATION —
no se declara CLOSED_TESTING_CERTIFIED porque cambia orden visual,
botones y estados visibles en ambas superficies PyR; requiere control
físico/browser del operador (checklist corto en el reporte)
NEXT_TASK: OPERATOR_PYR_WORKFLOW_PARITY_CERTIFICATION_P2_T42
ARCHIVE_REFERENCE: codex-reports/P2_T42_PYR_EMPLOYEE_TERMINAL_ORDER_WORKFLOW_PARITY.md

## P2-T02-B1-REPARTIDOR-PWA-POST-LOGIN-ROUTING — 2026-09-10

TASK: Durante la certificación física GPS de P2-T02 (sesión en curso),
el operador reprodujo en Android real que el login por password de
Repartidor autentica correctamente server-side pero navega a "/" —
que redirige incondicionalmente a Cliente (src/app/page.tsx, diseño
deliberado de aislamiento de PWA por rol) — sacando al repartidor
recién autenticado de la PWA instalada DeliGO Delivery. Blocker de
certificación, no un hallazgo nuevo de producto general.
RESULT: COMPLETE (implementación) — root cause confirmado:
`router.replace("/")` en `src/app/repartidor/page.tsx`, única
ocurrencia de ese patrón en todo el repo/historial, preexistente desde
el commit 9684082 (aislamiento PWA por rol), nunca corregido para
Repartidor aunque Negocio ya tenía exactamente el mismo fix (commit
95ff272). Fixture y sesión server-side verificados CORRECTOS antes de
tocar código (DB: repartidor real, sin colisión de rol; HTTP: login
type=repartidor + GET /api/repartidor/pedidos autorizado). Fix: nuevo
`src/lib/repartidor-post-login-navigation.ts` (mismo patrón que
Negocio) + `router.replace(REPARTIDOR_POST_LOGIN_PATH)` en vez de
`router.replace("/")`. Google OAuth (mismo archivo) confirmado no
afectado — nunca navega. Manifest/scope de la PWA confirmados
correctos, sin cambios.
TESTS: 6 pass focal + 97 pass regresión (OAuth callback, active-gate,
tracking) + 4 fail preexistentes documentados desde R1 (contrato
estático MODEL-G1 retirado, sin relación) — NEW_FAIL=0.
QUALITY: TYPECHECK_RAW=31 (0 nuevos), ESLint 0 nuevos, BUILD_PASS=SI,
DIFF_CHECK_PASS=SI.
SOURCE_MUTATION: SI (3 archivos: 2 producto + 1 test)
COMMIT: 489528ca4ba315cd0873e4b270fcdf0b4e3094cd
PUSH: SI (testing-codex únicamente)
DEPLOY: SUCCESS (TESTING, deployment 27bd08e3-6cb9-40f7-9c66-823ba10c9507 + chat en vivo incidental dce0d06c-cc6d-47cd-bcaa-ad443d3206ef, commit match confirmado en ambos)
P2_T02_B1_STATUS: CLOSED_TESTING_CERTIFIED — certificación física
Android confirmada en la sesión siguiente: REPARTIDOR_PWA_LOGIN_REDIRECT=PASS,
REPARTIDOR_PANEL_VISIBLE=PASS, TEST_T02_ORDER_VISIBLE=PASS (login ya
no deriva a Cliente); ver codex-reports/P2_T02_REAL_ANDROID_GPS_DELIVERY_CERTIFICATION_R2.md §2
GPS_TRACKING_FILES_CHANGED: 0 / P2_T42_FILES_CHANGED: 0 / P2_T41_FILES_CHANGED: 0
NEXT_TASK: (cumplida) — desbloqueó la retoma de la medición GPS de P2-T02, certificación indoor 7/7 completada, fase exterior aún pendiente (ver P2-T02-R2 más abajo)
ARCHIVE_REFERENCE: codex-reports/P2_T02_B1_REPARTIDOR_PWA_POST_LOGIN_ROUTING.md

## P2-T02-R2-REAL-ANDROID-GPS-DELIVERY-CERTIFICATION — 2026-09-10

TASK: Sesión de certificación física guiada (read-only del lado de
Claude, observación vía polling de TESTING DB) retomada tras el fix de
T02-B1. El operador estaba indoor y no pudo generar movimiento físico
controlado, así que el protocolo se adaptó a 7 pruebas indoor-safe en
vez de las 10 originales con movimiento.
RESULT: DOCUMENTATION-ONLY — cero cambios de código. 7/7 pruebas
indoor PASS: login PWA post-fix, fijación inicial GPS, stationary/
heartbeat (~60s cadencia), background sin bloqueo (~3s recovery),
screen lock (~7s recovery, distinto de background), network loss/
recovery (~20s recovery vía refetch de 8s del panel), permiso GPS
denegado/restaurado (recuperación automática sin recarga, confirmada
también server-side vía locationRevision 31→32). El hallazgo histórico
de background (9+ min sin coordenadas) no se reprodujo en ningún
escenario indoor, pero el escenario background+movimiento real
superior al threshold no fue ejercitado — no se cierra con un
marcador absoluto.
TESTS: N/A (sesión sin cambios de código; toda la evidencia es
observación física + polling de DB real).
SOURCE_MUTATION: NO
COMMIT: N/A (ninguno — no autorizado ni necesario en esta sesión)
DEPLOY: N/A (ninguno)
P2_T02_STATUS: WAITING_FOR_OPERATOR_ADDITIONAL_EVIDENCE — indoor
certificado, fase exterior (movimiento menor/mayor al threshold,
recorrido 100-300m, marcador visual T23, curva/esquina T24) pendiente
NEXT_TASK: OPERATOR_T02_EXTERIOR_ANDROID_GPS_CERTIFICATION — fixtures
TEST_T02 preservados activos (pedido NO marcado como entregado) para
retomar sin recrear datos
ARCHIVE_REFERENCE: codex-reports/P2_T02_REAL_ANDROID_GPS_DELIVERY_CERTIFICATION_R2.md

## P2-T02-B2-ANDROID-BACKGROUND-TRACKING-AUDIT-AND-DESIGN — 2026-09-10

TASK: R2 demostró RECOVERY_AFTER_FOREGROUND=PASS pero
CONTINUOUS_BACKGROUND_TRACKING=NO (0 updates en background/screen-lock,
por diseño OPTION-V2). El objetivo de producto del operador (tracking
útil durante Maps/Waze/llamada/bloqueo) exige más que "recuperar
rápido al volver" — auditoría + diseño (sin código) para determinar
por qué el código corta el tracking, si la plataforma lo permitiría, y
qué arquitectura haría falta.
RESULT: AUDIT-ONLY. Origen de OPTION-V2 rastreado al commit `0ad1562`
(2026-08-24, decisión deliberada, no bug) — comparó V1/V2 explícitamente,
eligió V2 por batería+determinismo+un supuesto de plataforma nunca
verificado empíricamente; "tracking continuo en background" nunca fue
requisito de producto hasta ahora. Capacidad real de plataforma
(fuentes oficiales citadas): PWA background geolocation =
SUPPORTED_BUT_THROTTLED (best-effort, ~1/min tras >5min oculto, freeze
eventual); Service Worker / Background Sync / Periodic Sync = NO
pueden adquirir geolocalización (no existe navigator.geolocation en
ese scope) — ninguna API "mágica" disponible. Gap adicional
encontrado: `delivery-tracking-map.tsx` no tiene ningún concepto de
"stale" — el badge "En vivo" refleja el socket, no la antigüedad del
dato; debe cerrarse antes de relajar el corte de background. Ráfaga
post-unlock de R2 re-auditada: DUPLICATE_RECOVERY_PATHS=NO (mecanismo
de dedupe correcto en código); network/permission recovery de R2
confirmados por auditoría de código línea por línea (antes sólo
inferidos empíricamente).
TESTS: N/A (audit-only, cero cambios de código).
SOURCE_MUTATION: NO
COMMIT: N/A (ninguno)
RECOMMENDATION: PWA_BACKGROUND_FIX_RECOMMENDED_NOW (relajar el
clearWatch incondicional + UI de staleness en Cliente + indicador en
Repartidor) + NATIVE_WRAPPER_FUTURE_OPTION (reservado, sólo si
evidencia real post-fix muestra insuficiencia).
P2_T02_B2_STATUS: CLOSED — decisión del operador recibida (OPTION_C_APPROVED),
implementada en la tarea siguiente
P2_T02_STATUS: WAITING_FOR_OPERATOR_ADDITIONAL_EVIDENCE (sin cambios)
NEXT_TASK: (cumplida) — P2-T02-B3 implementó la Opción C recomendada
ARCHIVE_REFERENCE: codex-reports/P2_T02_B2_ANDROID_BACKGROUND_TRACKING_AUDIT_AND_DESIGN.md

## P2-T02-B3-PWA-BEST-EFFORT-BACKGROUND-DELIVERY-TRACKING — 2026-09-10

TASK: El operador aprobó la Opción C recomendada por B2 (audit).
Implementar background tracking best-effort: dejar de cortar
voluntariamente el GPS al ocultarse (OPTION-V2 retirado), preservar la
recuperación de foreground existente, cerrar el gap de staleness del
Cliente, e informar al Repartidor la naturaleza best-effort — sin
wrapper nativo.
RESULT: COMPLETE. Se identificaron y corrigieron 7 gates distintos de
`document.visibilityState` en `use-repartidor-tracking.ts` (no bastaba
con quitar una sola llamada a stopWatcher): el branch hidden de
`handleVisibilityChange` ya no detiene nada (sólo marca
pendingForegroundRecoveryRef=true para el reinicio duro defensivo al
volver a foreground, que se preserva íntegro); `startWatcherIfNeeded`,
`scheduleWatchdog`, `checkWatchdog`, `firePendingSend`, `fireHeartbeat`
y la reevaluación post-2xx dejaron de gatear en visibilidad. Nuevo
helper puro `isTrackingLocationStale` (tracking-freshness.ts,
120000ms) corrige un bug preexistente en `delivery-tracking-map.tsx`
(el badge "En vivo" se renderizaba incondicionalmente, sin relación
con la antigüedad real del dato) — ahora nunca muestra "en vivo" una
ubicación stale, el marcador nunca se mueve/oculta por eso. Nuevo
`gpsPermissionDenied` expuesto por el hook + disclosure best-effort
en `deliveries-tab.tsx` ("Android puede pausarla en segundo plano",
nunca lenguaje de garantía). `refetchIntervalInBackground:true`
agregado exclusivamente a la query `repartidor-pedidos` (misma
cadencia 8s) para que la recuperación de una falla de red no dependa
de que el usuario vuelva a foreground. Deuda histórica resuelta:
`repartidor-tracking-static-contract.test.ts` (4 FAIL por símbolos
MODEL-G1 retirados) reescrito contra el contrato MODEL-E1/B3 actual.
TESTS: 262 pass/0 fail combinados (90 lifecycle hook [9 reescritas +
4 nuevas] + 64 freshness puro [11 nuevas stale] + 25 movement sin
cambios + 12 static-contract reescrito + 18 tracking-consumer [1
aserción sobre-amplia corregida] + 7 stale-contract nuevo + 22
ubicacion route + 12 tracking route + 6 deliveries-tab + 3 T02-B1
focal + 3 negocio-post-login referencia) — NEW_FAIL=0.
QUALITY: TYPECHECK_RAW=31 (0 nuevos), ESLint 0 nuevos, BUILD_PASS=SI,
DIFF_CHECK_PASS=SI.
SOURCE_MUTATION: SI (5 archivos de producto + 6 de test, 1 nuevo)
COMMIT: 6769797ea835f0571e034185439e56530cc7e80a
PUSH: SI (testing-codex únicamente)
DEPLOY: SUCCESS (TESTING, DeliGO Copy 564da9d5-4498-48e5-aba7-44f04fbb8a87
+ chat en vivo b945a971-ddd1-4ca0-a54f-bd6dd5924a09, commit match
confirmado en ambos)
P2_T02_B3_STATUS: WAITING_FOR_OPERATOR_ANDROID_CERTIFICATION — no se
declara cerrado sin certificación física Android (Fase A indoor
primero, exterior diferida)
P2_T42_FILES_CHANGED: 0
NEXT_TASK: OPERATOR_ANDROID_BACKGROUND_TRACKING_CERTIFICATION_T02_B3
ARCHIVE_REFERENCE: codex-reports/P2_T02_B3_PWA_BEST_EFFORT_BACKGROUND_DELIVERY_TRACKING.md
# P2-T46 — TABLE ACCOUNT + TICKET + HISTORY CANONICAL DETAIL — 2026-09-10

```text
TASK_ID=P2-T46
VERDICT=STOPPED_AT_ARCHITECTURE_AUDIT_GATE
T46_ARCHITECTURE_AUDIT_COMPLETE=SI
RESULT=Se confirmó la cuenta derivada por ocupación directa para pedidos nuevos, pero no existe autoridad de pago a nivel de cuenta y el backfill de Pedido.ocupacionMesaId NULL es ambiguo.
PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
DATABASE_CHANGED=NO
COMMIT_CREATED=NO
PUSH_PERFORMED=NO
DEPLOY_PERFORMED=NO
PRODUCTION_TOUCHED=NO
P2_T48_STATUS=CLOSED_PRODUCTION
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
TEST_T02_ORDER_LEFT_ACTIVE=SI
PUBLIC_RELEASE_AUTHORIZED=NO
NEXT_ACTION=Esperar aprobación del delta de autoridad de pago/cuenta y política de pedidos legacy
REPORT=codex-reports/P2_T46_TABLE_ACCOUNT_TICKET_HISTORY_CANONICAL_DETAIL.md
```

No se continuó a implementación, tests, commit, push ni Railway Testing por
el stop gate explícito de la tarea.

P2-T46-R1: aprobación explícita recibida; implementación local, pruebas focales y build completados. Pendiente push/deploy Testing y certificación física. Ver `codex-reports/P2_T46_R1_ACCOUNT_PAYMENT_OCCUPATION_ISOLATION_CANONICAL_DETAIL.md`.

## P2-T46-R3 — OPERATOR RECERTIFICATION CLOSEOUT — 2026-09-11

TASK_ID=P2-T46-R3
P2_T46_R1_OPERATOR_CERTIFICATION=PASS
P2_T46_R2_OPERATOR_RECERTIFICATION=PASS
P2_T46_OPERATOR_CERTIFICATION=PASS
R1_PHYSICAL_CASES_PASS=7
R2_PHYSICAL_CASES_PASS=5
P2_T46_STATUS=CLOSED_TESTING_CERTIFIED
P2_T46_RELEASE_ELIGIBLE=SI
CERTIFIED_RUNTIME_SHA=c3da04ef84dbd183956e78691a3b3da0f5dc2f68
CURRENT_TESTING_SHA=c826e796d33de5d00f8efddf4fa258fb86587c6a
POST_CERTIFICATION_DELTA_TYPE=DOCUMENTATION_ONLY
PRODUCTION_TOUCHED=NO
COMMIT_CREATED=NO
PUSH_PERFORMED=NO
DEPLOY_PERFORMED=NO
NEXT_ACTION=P2_T46_PRODUCTION_PROMOTION_EVALUATION

Reporte: `codex-reports/P2_T46_R3_OPERATOR_RECERTIFICATION_CLOSEOUT.md`.

## P2-T46-R4 — CURATED PRODUCTION PROMOTION — 2026-09-11

TASK_ID=P2-T46-R4
P2_T46_STATUS=CLOSED_PRODUCTION
P2_T46_RELEASE_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
RELEASE_T46_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_T46_MIGRATION_APPLIED=SI
PRODUCTION_DEPLOYMENT_STATUS=SUCCESS
PRODUCTION_DEPLOYMENT_COMMIT_MATCH=SI
PRODUCTION_SCHEMA_RUNTIME_MATCH=SI
POST_T46_STABLE_TAG=p2-t46-stable-2026-09-11
PRODUCTION_TOUCHED=SI
PUBLIC_RELEASE_AUTHORIZED=NO
NEXT_RECOMMENDED_SOFTWARE_TASK=P2-T32

No se promovieron T02, findings abiertos ni el HEAD completo de Testing.
Reporte: `codex-reports/P2_T46_R4_CURATED_PRODUCTION_PROMOTION.md`.

## P2-T43-R3 — OPERATOR PHYSICAL CERTIFICATION CLOSEOUT — 2026-09-12

TASK_ID=P2-T43-R3
P2_T43_OPERATOR_CERTIFICATION=PASS
P2_T43_STATUS=CLOSED_TESTING_CERTIFIED
P2_T43_RELEASE_ELIGIBLE=SI
P2_T43_RELEASE_STATUS=READY_FOR_PRODUCTION_PROMOTION_EVALUATION
PRODUCT_FILES_CHANGED=0
TEST_FILES_CHANGED=0
PRISMA_FILES_CHANGED=0
MIGRATION_FILES_CHANGED=0
FUNCTIONAL_TREE_CHANGED=NO
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
NEXT_ACTION=P2_T43_PRODUCTION_PROMOTION_EVALUATION

La evidencia física original y R2 quedó PASS; los findings T43 quedaron
`RESOLVED_PHYSICALLY_CERTIFIED_TESTING`. Este cierre sólo documenta la
certificación en Testing y no autoriza promoción automática.
Reporte: `codex-reports/P2_T43_R3_OPERATOR_CERTIFICATION_CLOSEOUT.md`.
