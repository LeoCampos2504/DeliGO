# GIT / DEPLOY HISTORY — DeliGO (P2-T05 workstream)

## P2-T02-R6 — final physical evidence reconciliation + closeout (2026-09-13)

```text
GIT_ACTION=2 commits documentales + 2 pushes a origin/testing-codex
BASELINE_HEAD=38eb7d4d8af1ec5dd8f0a7b0f1c73f52c9e01677
ORIGIN_TESTING_BEFORE=38eb7d4d8af1ec5dd8f0a7b0f1c73f52c9e01677
P2_T02_R6_CLOSEOUT_COMMIT=f5e5afcce0f4f2a28725a8b0386d0c584c9e987b
P2_T02_R6_BOOKKEEPING_COMMIT=THIS_FINAL_DOCUMENTATION_COMMIT
ORIGIN_MAIN=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
FILESET=8 archivos documentales (1 reporte nuevo + 7 autoridades)
PRODUCT_FILES_CHANGED=0
TEST_FILES_CHANGED=0
PRISMA_FILES_CHANGED=0
MIGRATION_FILES_CHANGED=0
FUNCTIONAL_TREE_CHANGED=NO
DATABASE_CHANGED=NO
RAILWAY_MUTATION=NO
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
P2_T02_STATUS=CLOSED_TESTING_CERTIFIED
P2_T02_RELEASE_ELIGIBLE=SI
REPORT=codex-reports/P2_T02_R6_FINAL_PHYSICAL_EVIDENCE_RECONCILIATION.md
PUSH_TARGET=origin/testing-codex
```

La tarea fue documentation-only. No se ejecutaron deploys, migraciones,
Production, T23, T24 ni T54. `git diff --check` se verificó antes del commit.

## P2-POST-T46-R1 — documentation-only backlog reconciliation (2026-09-11)

```text
CURRENT_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
CURRENT_T46_STABLE_TAG=p2-t46-stable-2026-09-11
CURRENT_T46_STABLE_TAG_PEELED_COMMIT=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
P2_T46_STATUS=CLOSED_PRODUCTION
PRODUCTION_DEPLOYMENT_ID=f700ca0f-64e1-4bd1-a027-b14284523de9
PRODUCTION_DEPLOYMENT_COMMIT=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_MIGRATION=20260910120000_p2_t46_account_payment_authority
PRODUCTION_TOUCHED=NO
FUNCTIONAL_TREE_CHANGED=NO
DOC_RECONCILIATION_COMMIT=PENDING
DOC_PUSH_TARGET=testing-codex
```

No se modificó `main`, el tag Production ni Railway Production. Esta entrada
registra el checkpoint ya existente; no describe un deploy nuevo.

## P2-T46 — audit stop gate — 2026-09-10

```text
BASELINE_TESTING=bb228ee43c89073a4355e6a012bb9aeaf3669dcb
BASELINE_MAIN=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
GIT_ACTION=ninguna
PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
DATABASE_CHANGED=NO
COMMIT_CREATED=NO
PUSH_PERFORMED=NO
DEPLOY_PERFORMED=NO
PRODUCTION_TOUCHED=NO
P2_T46_STATUS=STOPPED_AUDIT_GATE_WAITING_FOR_APPROVAL
REPORT=codex-reports/P2_T46_TABLE_ACCOUNT_TICKET_HISTORY_CANONICAL_DETAIL.md
```


## P2-T48-R2 — promoción curada exacta a Production + checkpoint — 2026-09-10

```text
SOURCE_T48_SHA=bb228ee43c89073a4355e6a012bb9aeaf3669dcb
RELEASE_BRANCH=release/p2-t48-curated
RELEASE_BASE_SHA=46a1d55634e8bd848e160302cdb64a32be241c89
RELEASE_T48_SHA=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
FILESET=4 (2 product + 2 test)
PROMOTION_STRATEGY=DIRECT_CHERRY_PICK
T02_FILES_IN_RELEASE_DIFF=0
T02_HUNKS_IN_RELEASE_DIFF=0
UNAUTHORIZED_POST_T48_DIFF=0
MAIN_PROMOTION=46a1d55..946f8c2 FAST_FORWARD_NO_FORCE
PRODUCTION_DEPLOYMENT_ID=96ef5efc-4678-40cd-9a96-966c839201f1
PRODUCTION_DEPLOYMENT_STATUS=SUCCESS
PRODUCTION_DEPLOYMENT_COMMIT_MATCH=SI
PRODUCTION_INSTANCE=RUNNING
PRODUCTION_LOGS=CLEAN (No pending migrations to apply; Next Ready)
PRODUCTION_HTTP_SMOKE=GET / => 307; protected salon panel without session => 401
POST_T48_STABLE_TAG=p2-t48-stable-2026-09-10
POST_T48_STABLE_TAG_SHA=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
P2_T48_STATUS=CLOSED_PRODUCTION
PRODUCTION_TOUCHED=SI (sólo promoción exacta T48)
```

No se promovió `testing-codex` completo; sus cambios T02 quedaron fuera del
release curado.

## P2-T48-R1 — cierre físico y registro de findings — 2026-09-10

```text
GIT_ACTION=ninguna
PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
DATABASE_CHANGED=NO
COMMIT_CREATED=NO
PUSH_PERFORMED=NO
DEPLOY_PERFORMED=NO
RAILWAY_MUTATION=NO
PRODUCTION_TOUCHED=NO
P2_T48_STATUS=CLOSED_TESTING_CERTIFIED
P2_T48_OPERATOR_CERTIFICATION=PASS_CASE_A_CASE_B_CASE_C
P2_T48_RELEASE_ELIGIBLE=SI
P2_T48_IMPLEMENTATION_COMMIT=bb228ee43c89073a4355e6a012bb9aeaf3669dcb
P2_T48_TESTING_DEPLOYMENT=d5497cb8-34a0-4835-b2f8-4c117c23a325_SUCCESS_RUNNING_EXACT_COMMIT
NEW_FINDINGS=2_OPEN
NEGOCIO_OCCUPATION_REFRESH_TARGET_TASK=TO_BE_RECONCILED
PREVIOUS_OCCUPATION_OPEN_ORDERS_PROVISIONAL_TARGET=P2-T46
```

Esta entrada sólo registra evidencia física del operador y reconciliación
documental. No modifica el commit ni repite el deploy de T48.

## P2-T48 — Salon Personal occupation state parity — 2026-09-10

```text
GIT_ACTION=1 commit + 1 push a origin/testing-codex
BASELINE_TESTING=fb3e584259cb2c57605c783543c7fdb1dc845454
BASELINE_MAIN=46a1d55634e8bd848e160302cdb64a32be241c89
COMMIT_SHA=bb228ee43c89073a4355e6a012bb9aeaf3669dcb
COMMIT_PARENT=fb3e584259cb2c57605c783543c7fdb1dc845454
COMMIT_MESSAGE=fix: align salon personal occupation state
FILESET=4 archivos (2 producto + 2 test, todos T48)
PUSH=origin/testing-codex: fb3e584..bb228ee
TESTING_DEPLOYMENT_ID=d5497cb8-34a0-4835-b2f8-4c117c23a325
TESTING_DEPLOYMENT_STATUS=SUCCESS
TESTING_DEPLOYMENT_COMMIT_MATCH=SI
TESTING_INSTANCE=RUNNING
TESTING_LOGS=CLEAN (No pending migrations to apply; Next Ready)
SMOKE=GET / => 200; GET protected salon panel without session => 401
FOCAL_TESTS=13 PASS, 0 FAIL
REGRESSION_TESTS=51 PASS, 0 FAIL
TYPECHECK_AFTER=31 / NEW_TYPECHECK_ERRORS=0 / BUILD=PASS
PRODUCTION_TOUCHED=NO
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
P2_T48_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_WAITING_OPERATOR
```

El primer push directo fue rechazado por non-fast-forward; se preservó la
punta remota y se aplicó T48 encima sin force push. `origin/main` y el tag
estable de T42 no cambiaron.

## P2-T02-B4-R3 — iOS return-from-Google-Maps route recovery — 2026-09-10 (1 commit, push testing-codex, deploy TESTING SUCCESS — Production sin tocar)

```text
GIT_ACTION=1 commit + 1 push a origin/testing-codex
COMMIT_SHA=fb3e584259cb2c57605c783543c7fdb1dc845454
COMMIT_PARENT=0c362895656d389de73fd0dd94a124fe3aac8dd1
COMMIT_MESSAGE=fix: recover delivery route after app resume
FILESET=5 archivos (3 producto + 2 test, todos R3)
PUSH=origin/testing-codex: 0c36289..fb3e584
TESTING_DEPLOYMENT_STATUS=SUCCESS
TESTING_DEPLOYMENT_ID=b54f0214-69a0-4e93-8589-fc2f37054301
TESTING_DEPLOYMENT_COMMIT_MATCH=SI
TESTING_INSTANCE=RUNNING
TESTING_LOGS=CLEAN (No pending migrations to apply; Next Ready)
SMOKE=GET /repartidor -> 200
TYPECHECK_RAW=31 / NEW_TYPECHECK_ERRORS=0 / FOCAL_TESTS=29 PASS, 0 FAIL / BUILD=PASS
PRODUCTION_CODE_CHANGED=NO / PRODUCTION_DEPLOYMENT=bb17c7dd1eb9b8f4cb94d03de834019baf182987, sin cambios
P2_T02_B4_R3_STATUS=WAITING_FOR_OPERATOR_IOS_PHYSICAL_RETEST
```

## P2-T02-B3-PWA-BEST-EFFORT-BACKGROUND-DELIVERY-TRACKING — 2026-09-10 (1 commit, push a testing-codex, deploy TESTING SUCCESS — Production sin tocar, pendiente certificación física Android)

```text
GIT_ACTION=1 commit + 1 push a origin/testing-codex
COMMIT_SHA=6769797ea835f0571e034185439e56530cc7e80a
COMMIT_PARENT=489528ca4ba315cd0873e4b270fcdf0b4e3094cd
COMMIT_MESSAGE=fix: keep delivery tracking active in background
FILESET=11 archivos (5 producto: use-repartidor-tracking.ts, tracking-freshness.ts, delivery-tracking-map.tsx, deliveries-tab.tsx, repartidor-panel.tsx; 6 test: use-repartidor-tracking.test.ts, tracking-freshness.test.ts, repartidor-tracking-static-contract.test.ts [reescrito], tracking-consumer-static-contract.test.ts [1 aserción corregida], delivery-tracking-map-stale-contract.test.ts [nuevo], deliveries-tab.test.tsx)
PUSH=origin/testing-codex: 489528c..6769797
TESTING_DEPLOYMENT_STATUS=SUCCESS ambos servicios relevantes (DeliGO Copy 564da9d5-4498-48e5-aba7-44f04fbb8a87 + chat en vivo b945a971-ddd1-4ca0-a54f-bd6dd5924a09), commit exacto verificado en ambos, "No pending migrations to apply"
SMOKE=GET /repartidor -> 200, GET / -> 307 (redirect esperado a /cliente/), GET /api/pedidos/[id]/tracking (id inexistente) -> 401 (esperado) — ningún POST mutante ejecutado contra TESTING
PRODUCTION_CODE_CHANGED=NO / PRODUCTION_DEPLOYMENT=bb17c7dd1eb9b8f4cb94d03de834019baf182987, sin cambios (verificado antes y después)
P2_T02_B3_STATUS=WAITING_FOR_OPERATOR_ANDROID_CERTIFICATION
```

## P2-T35-T36-PROMOTE-TO-MAIN-AND-PRODUCTION — 2026-09-10 (checkpoint Production: main avanzado de 8011ee3 a 773664f, tag creado, ambos servicios relevantes SUCCESS primer intento)

```text
GIT_ACTION=1 commit snapshot (git commit-tree) + 1 push por SHA exacto a origin/main (fast-forward, sin force) + 1 tag anotado
SOURCE_HEAD=testing-codex@ea9edbc2ee47027820480a7fc5887eddc6e1f719 (sin drift) / BASELINE_ORIGIN_MAIN=8011ee3716c93e62b4a85ce82e3a9646ac5302a5 (sin drift)
DELTA=23 archivos exactos (3 test-only T35: ios-standalone-degraded-viewport-dock-fallback-r8/final-visual-fix-r4/post-keyboard-nav-occlusion-r6 static-contract; 20 T36: sw.js + 5 manifests modificados, pwa-role-icon-contract.test.ts + sw-push-role-icon-routing.test.ts modificados, sw-icon-cache-bypass-static-contract.test.ts nuevo, 11 assets binarios nuevos) — auditado vía diff de árbol completo; 0 UNRELATED/UNKNOWN, 0 archivos legacy de empleado/mozo/salon
ACLARACION_FISICA=corregida redacción ambigua del reporte de cierre T36 ("confirma en producción real") — PHYSICAL_TEST_ENVIRONMENT=REAL_ANDROID_DEVICE_AGAINST_CERTIFIED_TESTING_BUILD, nunca Production
RELEASE_METHOD=git commit-tree, tree=testing-codex@ea9edbc (=HEAD^{tree}, verificado byte-igual 164b8f0a26ece3c124b9845f57e6e6be65b372e5), parent=origin/main@8011ee3
PROMOTION_TESTS=T35 242 pass+0 fail (batería completa 16 archivos) + T36 focal 46 pass+0 fail (recontado fresco, corrige 47 impreciso del reporte T36 original) + regresión push/SW/PWA 36 pass+0 fail (combinado 82, sin duplicar) — 0 fallas nuevas
ASSETS_VERIFICADOS=11 binarios T36 (badge-deligo-monochrome-96x96.png + 10 icon-{rol}-maskable-{192,512}x{192,512}.png) confirmados byte-idénticos (mismo SHA256/tamaño) contra P2_T36_PWA_BRANDING_HYGIENE.md §13 — ningún asset regenerado
QUALITY=TYPECHECK_RAW=24 (idéntico baseline), ESLINT_PASS=SI, DIFF_CHECK_PASS=SI, BUILD_PASS=SI, SECRET_LEAK_IN_RELEASE_DIFF=NO
MIGRATIONS=PRISMA_SCHEMA_CHANGED=NO, "No pending migrations to apply" confirmado en logs reales de Production (30 migrations found, 0 aplicadas)
RELEASE_COMMIT_SHA=773664f8da80b2143cfd1443ed0467ace6c45a34 (parent 8011ee3716c93e62b4a85ce82e3a9646ac5302a5)
PUSH_MAIN=SI (fast-forward, sin force) / origin/testing-codex sin cambios (ea9edbc)
PRODUCTION_DEPLOY=SUCCESS ambos servicios relevantes (DeliGO deploymentId 2efb4f05-3720-46ea-8ef5-56a86aa154a0 + chat en vivo), PRIMER intento, commit exacto verificado en ambos / migrations aplicadas=0
SMOKE=11 rutas/assets todos 200/307 normal contra https://deligo.ar real (/, 5 manifests, sw.js, badge, 3 maskable icons) — CACHE_NAME=deligo-v16 y DELIGO_BADGE confirmados en el sw.js servido, Content-Length byte-exacto en badge (1708B) e icon-cliente-maskable-512 (148304B) — sin mutaciones
TAG=p2-t35-t36-stable-2026-09-10 -> 773664f, creado y pusheado sólo tras confirmar deploy SUCCESS + commit match + smoke PASS (fecha real del día de la promoción)
P2_T35_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED) / P2_T36_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED) / P2_T35_PLUS_P2_T36_RELEASE_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T52_STATUS=READY_FUTURE (preservado, no cerrado — identidad separada de Mozo pendiente de consolidación, no bloqueó este checkpoint)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED (sin cambios) / PUBLIC_RELEASE_AUTHORIZED=NO
NEXT_FUNCTIONAL_TASK=P2-T41 (Terminal Read-Only Action Authorization, P0) — no iniciada
```

## P2-T36-PWA-BRANDING-HYGIENE — 2026-09-09 (1 commit, push a testing-codex, deploy TESTING SUCCESS ambos servicios — Production sin tocar, pendiente certificación física Android — PROMOVIDO A PRODUCTION ARRIBA)

```text
GIT_ACTION=1 commit + 1 push a origin/testing-codex
T36_COMMIT_SHA=ea9edbc2ee47027820480a7fc5887eddc6e1f719
T36_COMMIT_PARENT=227ea27ffed2ffce21717002f69207b7038262c8
T36_COMMIT_MESSAGE=fix: harden pwa branding assets
FILESET=20 archivos (6 producto modificados: 5 manifests + sw.js; 11 producto nuevos: 10 maskable + 1 badge; 3 test: 2 modificados + 1 nuevo)
PUSH=origin/testing-codex: 227ea27..ea9edbc
TESTING_DEPLOYMENT_STATUS=SUCCESS ambos servicios (DeliGO Copy + chat en vivo), commit exacto, primer intento, "No pending migrations to apply"
SMOKE=manifests (5) + sw.js + assets nuevos (maskable x2 + badge) verificados 200, Content-Length byte-exacto, CACHE_NAME=deligo-v16 y maskable src correctos en el body servido
PRODUCTION_CODE_CHANGED=NO / PRODUCTION_DEPLOYMENT=8011ee3716c93e62b4a85ce82e3a9646ac5302a5, sin cambios (verificado antes y después)
```

## P2-T30-T32-PROMOTE-TO-MAIN-AND-PRODUCTION — 2026-09-09 (checkpoint Production: main avanzado de 44af4ec a 8011ee3, tag creado, ambos servicios relevantes SUCCESS primer intento)

```text
GIT_ACTION=1 commit snapshot (git commit-tree) + 1 push por SHA exacto a origin/main (fast-forward, sin force) + 1 tag anotado
SOURCE_HEAD=testing-codex@2fb603bf4aa4b2c993b0a75078f29a259e036aca (sin drift) / BASELINE_ORIGIN_MAIN=44af4ecedd245977f0a50eeeb5bb5b292519c370 (sin drift)
DELTA=8 archivos exactos (1 test-only T30: superadmin-auth.test.ts; 7 T32: n/[slug]/page.tsx, client-profile-panel.tsx modificados + address-form.tsx, address-map-picker.tsx, client-address-modal.tsx, address-form.test.tsx, client-address-unification-static-contract.test.ts nuevos) — auditado vía diff de árbol completo, no por nombre de commit; 0 UNRELATED/UNKNOWN
RELEASE_METHOD=git commit-tree, tree=testing-codex@2fb603b (=HEAD^{tree}, verificado byte-igual 1a70ae99eb587986d99d2535af8ab4ff9a4f0357), parent=origin/main@44af4ec
PROMOTION_TESTS=T30 48 pass+4 skip+0 fail (DB TESTING real) + T32 focal 26 pass+0 fail + T32 regresión vecinos 42 pass+0 fail — 116 tests re-ejecutados sobre el source exacto, 0 fallas nuevas
QUALITY=TYPECHECK_RAW=24 (idéntico baseline), ESLINT_PASS=SI, DIFF_CHECK_PASS=SI, BUILD_PASS=SI, SECRET_LEAK_IN_RELEASE_DIFF=NO
MIGRATIONS=PRISMA_SCHEMA_CHANGED=NO, "No pending migrations to apply" confirmado en logs reales de Production (30 migrations found, 0 aplicadas)
RELEASE_COMMIT_SHA=8011ee3716c93e62b4a85ce82e3a9646ac5302a5 (parent 44af4ecedd245977f0a50eeeb5bb5b292519c370)
PUSH_MAIN=SI (fast-forward, sin force) / origin/testing-codex sin cambios (2fb603b)
PRODUCTION_DEPLOY=SUCCESS ambos servicios relevantes (DeliGO serviceId dd6b45fc-0d3d-4c38-86a6-cbb04a0025c9 + chat en vivo), PRIMER intento, commit exacto verificado en ambos / migrations aplicadas=0
SMOKE=8 rutas todas 200 contra https://deligo.ar real (/, /cliente, /negocio, /repartidor, /operaciones, /manifest-cliente.json, /manifest-negocio.json, /sw.js) — sin mutaciones, manifest-cliente.json body verificado (start_url=/cliente, sin iosDebug)
TAG=p2-t30-t32-stable-2026-09-09 -> 8011ee3, creado y pusheado sólo tras confirmar deploy SUCCESS + commit match + smoke PASS
P2_T30_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED) / P2_T32_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED) / P2_T30_PLUS_P2_T32_RELEASE_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED (sin cambios) / PUBLIC_RELEASE_AUTHORIZED=NO
NEXT_RECOMMENDED_ACTION=recomendación solamente (no iniciada): P2-T35 (iOS/PWA Static-Contract Hygiene, 100% software) o P2-T34 (Android Session Isolation) si el operador prioriza Android — Operaciones/Salón sigue PENDING_OPERATOR_FINDINGS
```

## P2-T32-CLIENT-ADDRESS-UX-UNIFICATION-AND-PROFILE-DEEPLINK — 2026-09-09 (1 commit, push a testing-codex, deploy TESTING SUCCESS ambos servicios — Production sin tocar, pendiente certificación física — PROMOVIDO A PRODUCTION ARRIBA)

```text
GIT_ACTION=1 commit + 1 push a origin/testing-codex
T32_COMMIT_SHA=2fb603bf4aa4b2c993b0a75078f29a259e036aca
T32_COMMIT_PARENT=2fff459b36ea459a9cb6603daf746c571562449d
T32_COMMIT_MESSAGE=fix: unify client address creation flows
FILESET=7 archivos (2 producto modificados: n/[slug]/page.tsx, client-profile-panel.tsx; 3 producto nuevos: address-form.tsx, address-map-picker.tsx, client-address-modal.tsx; 2 test nuevos: address-form.test.tsx, client-address-unification-static-contract.test.ts)
PUSH=origin/testing-codex: 2fff459..2fb603b
TESTING_DEPLOYMENT_STATUS=SUCCESS ambos servicios (DeliGO Copy + chat en vivo), commit exacto, primer intento, sin migrations pendientes
SMOKE=8/8 rutas 200 (/, /cliente, /negocio, /repartidor, /operaciones, manifest-cliente.json, sw.js)
PRODUCTION_CODE_CHANGED=NO / PRODUCTION_DEPLOYMENT=44af4ecedd245977f0a50eeeb5bb5b292519c370, sin cambios (verificado antes y después)
```

Reemplazó el modal de checkout divergente (`LocationPickerModal`, sin
alias, sin persistencia real) por una autoridad compartida de
formulario/mapa reutilizada también por Perfil, y agregó un deep-link
determinista a "Mis Direcciones". `P2_T32_STATUS` queda
`WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` — cambio user-visible,
pendiente certificación física. Ver
`P2_T32_CLIENT_ADDRESS_UX_UNIFICATION_AND_PROFILE_DEEPLINK.md`.

## P2-T30-SUPERADMIN-AUTH-TEST-FIXTURE-HYGIENE — 2026-09-09 (1 commit test-only, push a testing-codex — sin deploy, no requerido)

```text
GIT_ACTION=1 commit + 1 push a origin/testing-codex (sin deploy)
T30_COMMIT_SHA=2fff459b36ea459a9cb6603daf746c571562449d
T30_COMMIT_PARENT=a5109b0930ef975b0220b6cfbcb0698b32d8cf32
T30_COMMIT_MESSAGE=test: isolate superadmin auth fixtures
FILESET=1 archivo (test-only): src/lib/superadmin-auth.test.ts
PUSH=origin/testing-codex: a5109b0..2fff459
TESTING_DEPLOY_REQUIRED=NO (sin código de producto modificado) / no se disparó ningún redeploy
PRODUCTION_CODE_CHANGED=NO / PRODUCTION_DEPLOYMENT=44af4ecedd245977f0a50eeeb5bb5b292519c370, sin cambios
```

Corrigió el aislamiento de fixtures de `superadmin-auth.test.ts`
(F-PRE-T29-03) — cero cambios de código de producto, cero necesidad de
deploy. Ver `P2_T30_SUPERADMIN_AUTH_TEST_FIXTURE_HYGIENE.md`.

## P2-T29D-T29E-PROMOTE-TO-MAIN-AND-PRODUCTION — 2026-09-09 (release snapshot curado — main/Production avanzados a `44af4ec`, tag `p2-t29-stable-2026-09-09` creado, ambos servicios SUCCESS en el primer intento — epic P2-T29 completo checkpointed)

```text
GIT_ACTION=1 commit snapshot (git commit-tree) + 1 push a origin/main + 1 tag anotado
RELEASE_COMMIT_SHA=44af4ecedd245977f0a50eeeb5bb5b292519c370
RELEASE_COMMIT_PARENT=7a3a1dcbfa89bd63c96471290e936b979d74c5ce
RELEASE_COMMIT_MESSAGE=release: promote certified p2-t29 final checkpoint
SOURCE=testing-codex@a5109b0930ef975b0220b6cfbcb0698b32d8cf32 (BYTE_TREE_EQUIVALENT=SI)
FILESET=3 archivos (residual completo de T29D — order-transition-t29b-flow.test.ts, negocio/pedidos/[id]/estado/route.ts, push.ts) / T29E sin código propio
PUSH=origin/main: 7a3a1dc..44af4ec (fast-forward, sin force) / origin/testing-codex sin cambios (a5109b0)
PRODUCTION_DEPLOYMENT_STATUS=SUCCESS ambos servicios (DeliGO + chat en vivo), PRIMER intento, sin hiccup / COMMIT=44af4ec (match exacto en ambos) / "No pending migrations to apply" (30 migrations found, 0 aplicadas)
SMOKE=GET /, /cliente, /negocio, /repartidor, /operaciones, /manifest-cliente.json, /manifest-negocio.json, /sw.js -> todos 200, contra el dominio real https://deligo.ar
TAG=p2-t29-stable-2026-09-09 -> 44af4ec (creado y pusheado tras confirmar SUCCESS+smoke+match)
```

Quinta promoción curada del epic P2-T29 (tras T29A solo, y
T29B+T29C). Diff auditado: exactamente el residual de T29D (3
archivos), T29E confirmado sin ningún archivo de código propio. 163
tests focales, 0 fallas. Push fast-forward a `main`, Production
(DeliGO + chat en vivo) SUCCESS de inmediato en el commit exacto para
ambos servicios, sin ningún hiccup. Nota de proceso: el CLI de Railway
local estaba linkeado por defecto al entorno TESTING — se detectó al
intentar obtener el dominio de Production y se corrigió usando `-e
production`/`-s` explícitos en todos los comandos de verificación
posteriores contra Production, para no verificar accidentalmente el
entorno equivocado. `P2_T29_STATUS` (epic completo A-E) avanza a
`CLOSED_PRODUCTION_CHECKPOINTED`. Ver
`P2_T29D_T29E_PROMOTE_TO_MAIN_AND_PRODUCTION.md`.

## P2-T29D-RESIDUAL-CLIENT-NOTIFICATIONS-TIMELINE-AUDIT-AND-IMPLEMENTATION — 2026-09-09 (1 commit, push a testing-codex, deploy TESTING SUCCESS — Production sin tocar, pendiente certificación física, cambio user-visible)

```text
GIT_ACTION=1 commit + 1 push a origin/testing-codex
T29D_COMMIT_SHA=a5109b0930ef975b0220b6cfbcb0698b32d8cf32
T29D_COMMIT_PARENT=0c2300827ea09d149253b84bc43fa5bda6db29f2
T29D_COMMIT_MESSAGE=feat: complete residual client order notifications
FILESET=3 archivos (2 producto: push.ts, negocio/pedidos/[id]/estado/route.ts; 1 test: order-transition-t29b-flow.test.ts, 1 actualizado + 4 nuevos)
PUSH=origin/testing-codex: 0c23008..a5109b0
TESTING_DEPLOYMENT_STATUS=SUCCESS (servicio "DeliGO Copy", BUILDING->DEPLOYING->SUCCESS, 127s) / COMMIT=a5109b0 (match exacto) / boot limpio, "No pending migrations to apply"
TESTING_CHAT_SERVICE_REDEPLOY=SUCCESS (autodisparado por el mismo push, mismo commit)
SMOKE=GET /, /cliente, /negocio, /repartidor, /operaciones -> todos 200 (/ -> 307 esperado)
PRODUCTION_CODE_CHANGED=NO / PRODUCTION_DEPLOYMENT=7a3a1dcbfa89bd63c96471290e936b979d74c5ce, sin cambios (verificado antes y después)
```

Implementó el único residual real de P2-T29D (identificado por
auditoría completa contra el diseño original): notificación Cliente
para `recibido→aceptado` (`"${negocio} aceptó tu pedido"`, copy
decidido explícitamente por el operador tras presentarle opciones, no
inventado). Fileset mínimo (3 archivos). 134+33+5 tests, 0 fallas
nuevas. `P2_T29D_STATUS` sigue `WAITING_FOR_OPERATOR_PHYSICAL_
CERTIFICATION` — cambio user-visible, pendiente certificación física.
Ver `P2_T29D_RESIDUAL_CLIENT_NOTIFICATIONS_TIMELINE_AUDIT_AND_
IMPLEMENTATION.md`.

## P2-T29B-T29C-PROMOTE-TO-MAIN-AND-PRODUCTION — 2026-09-09 (release snapshot curado — main/Production avanzados a `7a3a1dc`, tag creado, ambos servicios SUCCESS en el primer intento)

```text
GIT_ACTION=1 release commit vía git commit-tree (7a3a1dcbfa89bd63c96471290e936b979d74c5ce, tree=testing-codex@0c2300827ea09d149253b84bc43fa5bda6db29f2, parent=origin/main@c45fd5ec8cd771d68020f37d892be31d62fb54c5) + 1 push por SHA a origin/main (fast-forward, sin force) + 1 tag anotado pusheado
RELEASE_COMMIT_SHA=7a3a1dcbfa89bd63c96471290e936b979d74c5ce
MAIN_PUSH=c45fd5ec8cd771d68020f37d892be31d62fb54c5..7a3a1dcbfa89bd63c96471290e936b979d74c5ce
PRODUCTION_DELIGO_DEPLOYMENT_ID=a5a7ffd0-c38e-4c27-a967-94128e5f70e1 / STATUS=SUCCESS / COMMIT=7a3a1dc (match exacto, primer intento) / 0 migrations pendientes
PRODUCTION_CHAT_EN_VIVO_DEPLOYMENT_ID=3794366d-7a62-47e7-8c3c-3bb37715610c / STATUS=SUCCESS (primer intento — sin el hiccup transitorio que P2-T29A tuvo, sin redeploy manual necesario)
CHAT_SERVICE_LIVE_OUTAGE=NO
TAG=p2-t29b-t29c-stable-2026-09-09, target=7a3a1dcbfa89bd63c96471290e936b979d74c5ce, creado y pusheado tras SUCCESS+smoke en ambos servicios
TESTING_CODEX_UNCHANGED=SI (0c2300827ea09d149253b84bc43fa5bda6db29f2)
```

Promovió el bloque certificado P2-T29B + P2-T29B-R1 + P2-T29C (22
archivos, byte-equivalentes al source, auditados uno por uno) de
`testing-codex` a `main`/Production. 0 migrations. Batería focal de 181
tests, 0 fallas nuevas (1 fallo no-determinístico de infraestructura de
test compartida, ajeno al diff promovido, reproducido y descartado).
Smoke HTTP + semántico PASS. `main`/Production coinciden exactamente.
Ver `P2_T29B_T29C_PROMOTE_TO_MAIN_AND_PRODUCTION.md`.

## P2-T29C-REPARTIDOR-WAITING-DRIVER-ACCEPTANCE-AND-CONCURRENCY — 2026-09-09 (1 commit, push a testing-codex, deploy TESTING SUCCESS — Production sin tocar, pendiente certificación física con 2 repartidores)

```text
GIT_ACTION=1 commit + 1 push a origin/testing-codex
T29C_COMMIT_SHA=0c2300827ea09d149253b84bc43fa5bda6db29f2
T29C_COMMIT_PARENT=155b4c4f0ce6426bea429f9aa400061e8a1e5455
T29C_COMMIT_MESSAGE=feat: move delivery acceptance to waiting driver state
FILESET=10 archivos (5 producto: order-transitions.ts, repartidor/pedidos/route.ts, repartidor/pedidos/[id]/aceptar/route.ts, repartidor/pedidos/auto-cancel/route.ts, negocio/pedidos/[id]/estado/route.ts; 5 test: 1 modificado + 4 nuevos)
PUSH=origin/testing-codex: 155b4c4..0c23008
TESTING_DEPLOYMENT_ID=22c337f9-773f-4478-8587-ee97cc626a26 (DeliGO Copy) / STATUS=SUCCESS (BUILDING->DEPLOYING->SUCCESS, 138s) / COMMIT=0c23008 (match exacto) / boot limpio, "No pending migrations to apply"
TESTING_CHAT_SERVICE_REDEPLOY=SUCCESS (autodisparado por el mismo push, mismo commit)
SMOKE=GET /repartidor, /negocio, /cliente, /operaciones -> todos 200
PRODUCTION_CODE_CHANGED=NO / PRODUCTION_DEPLOYMENT=c45fd5ec8cd771d68020f37d892be31d62fb54c5, sin cambios (verificado antes y después)
```

Repartidor pasa a consumir `esperando_repartidor` en vez del
`en_camino`+`repartidorId=null` legacy. GAP CRÍTICO cerrado: 2 tests de
concurrencia real (dos repartidores, `Promise.all`, DB real de TESTING)
prueban single-winner. 142 tests reverificados sin cambios + ~90 tests
nuevos/extendidos, 0 fallas nuevas. `P2_T29C_STATUS` sigue
`WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` — pendiente certificación
física con 2 repartidores reales. Ver
`P2_T29C_REPARTIDOR_WAITING_DRIVER_ACCEPTANCE_AND_CONCURRENCY.md`.

## P2-T29B-R1-CLIENT-TIMELINE-CONTINUITY-WAITING-DRIVER-NOTIFICATION — 2026-09-09 (1 commit, push a testing-codex, deploy TESTING SUCCESS — Production sin tocar, pendiente certificación física de T29B)

```text
GIT_ACTION=1 commit + 1 push a origin/testing-codex
T29B_R1_COMMIT_SHA=155b4c4f0ce6426bea429f9aa400061e8a1e5455
T29B_R1_COMMIT_PARENT=3d9f3b32f9359a4cdd0385f13bf5c4621d6d16ce
T29B_R1_COMMIT_MESSAGE=fix: keep client timeline active through t29b states
FILESET=5 archivos (3 producto: client-orders-panel.tsx, push.ts, negocio/pedidos/[id]/estado/route.ts; 2 test: order-transition-t29b-flow.test.ts + client-timeline-t29b-r1.test.ts nuevo)
PUSH=origin/testing-codex: 3d9f3b3..155b4c4
TESTING_DEPLOYMENT_ID=22c337f9-773f-4478-8587-ee97cc626a26 (DeliGO Copy) / STATUS=SUCCESS (BUILDING->DEPLOYING->SUCCESS, 36s) / COMMIT=155b4c4 (match exacto) / boot limpio, "No pending migrations to apply"
TESTING_CHAT_SERVICE_REDEPLOY=SUCCESS (autodisparado por el mismo push, mismo commit)
SMOKE=GET / → 307 a /cliente/ (redirect esperado, no error)
PRODUCTION_CODE_CHANGED=NO / PRODUCTION_DEPLOYMENT=c45fd5ec8cd771d68020f37d892be31d62fb54c5, sin cambios (verificado antes y después)
```

Corrección focal descubierta durante la certificación física de
P2-T29B (feedback del operador, ANTES de cerrarla): timeline de
Cliente se apagaba en `aceptado`/`esperando_repartidor`; se agregó
además notificación dedicada "Buscando delivery" para
`preparando -> esperando_repartidor` real de domicilio. 142 tests
(13 nuevos + 129 reverificados), 0 fallas nuevas, build/lint/typecheck
limpios. `P2_T29B_STATUS` sigue `WAITING_FOR_OPERATOR_PHYSICAL_
CERTIFICATION` — este fix es prerequisito de esa certificación, no la
reemplaza. Ver
`P2_T29B_R1_CLIENT_TIMELINE_AND_WAITING_DRIVER_NOTIFICATION.md`.

## P2-T29B-NEGOCIO-ACCEPTED-PREPARING-WAITING-DRIVER-FLOW — 2026-09-09 (1 commit, push a testing-codex, deploy TESTING SUCCESS — Production sin tocar, pendiente certificación física)

```text
GIT_ACTION=1 commit + 1 push a origin/testing-codex
T29B_COMMIT_SHA=3d9f3b32f9359a4cdd0385f13bf5c4621d6d16ce
T29B_COMMIT_PARENT=4b199540c78ebe0a010c699f6fc2e63b43d162a0
T29B_COMMIT_MESSAGE=feat: add negocio accepted and waiting driver flow
FILESET=13 archivos (9 producto: order-transitions.ts, utils.ts, negocio/pedidos estado+PUT-mesa, cliente/pedidos [id]+route, orders-tab.tsx, client-orders-panel.tsx, status-badge.tsx; 4 test)
PUSH=origin/testing-codex: 4b19954..3d9f3b3
TESTING_DEPLOYMENT_ID=1c00f674-0882-4785-91b6-2560e275fec0 (DeliGO Copy) / STATUS=SUCCESS / COMMIT=3d9f3b3 (match exacto) / boot limpio, sin migraciones pendientes
TESTING_CHAT_SERVICE_REDEPLOY=SUCCESS (autodisparado por el mismo push)
PRODUCTION_CODE_CHANGED=NO / PRODUCTION_DEPLOYMENT=c45fd5ec8cd771d68020f37d892be31d62fb54c5, sin cambios
```

Implementó y desplegó a TESTING el flujo Negocio de P2-T29B. Verificado
con clicks reales sobre la app local (Negocio sintético, fixtures
borradas después). **No se promueve a Production** — `RELEASE_BATCH=
P2_T29B_PLUS_P2_T29C`, la evaluación de promoción ocurre recién después
de certificar T29C. Ver
`P2_T29B_NEGOCIO_ACCEPTED_PREPARING_WAITING_DRIVER_FLOW.md`.

## P2-T29A-PROMOTE-TO-MAIN-AND-PRODUCTION — 2026-09-09 (checkpoint pequeño y frecuente — main/Production avanzados, tag creado, chat en vivo requirió 1 reintento)

```text
GIT_ACTION=1 release commit vía git commit-tree (c45fd5ec8cd771d68020f37d892be31d62fb54c5, tree=testing-codex@4b199540c78ebe0a010c699f6fc2e63b43d162a0, parent=origin/main@969ea77ab1630b443fbc0e609397d9c45c5d7443) + 1 push fast-forward a origin/main + 1 tag anotado pusheado
RELEASE_COMMIT_SHA=c45fd5ec8cd771d68020f37d892be31d62fb54c5
MAIN_PUSH=969ea77..c45fd5e (fast-forward, sin force)
PRODUCTION_DELIGO_DEPLOYMENT_ID=d8ee0ea0-72a4-4bbd-ad0e-ca3ceb7fdbe6 / STATUS=SUCCESS / COMMIT=c45fd5e (match exacto, primer intento) / 0 migrations pendientes
PRODUCTION_CHAT_EN_VIVO_FIRST_ATTEMPT=11d0464c-787d-4282-86c2-4882ac49c1d6, FAILED (build OK, runtime sin logs, sin causa de código — mini-services/chat-service confirmado sin cambios en el diff)
PRODUCTION_CHAT_EN_VIVO_RETRY=e331bb67-31d6-4d00-a9ff-f0e9214c7d11, SUCCESS (railway redeploy, decisión explícita del operador vía AskUserQuestion, mismo commit exacto)
CHAT_SERVICE_LIVE_OUTAGE=NO (versión anterior 969ea77 sirvió sin interrupción durante todo el intervalo, confirmado con health checks reales 200)
TAG=p2-t29a-stable-2026-09-09, target=c45fd5e, creado y pusheado sólo después de SUCCESS+smoke en ambos servicios
TESTING_CODEX_UNCHANGED=SI (4b199540c78ebe0a010c699f6fc2e63b43d162a0)
```

Checkpoint pequeño y frecuente — primera aplicación de la nueva
política `RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS`. Único
incidente: un fallo transitorio de plataforma en el servicio de chat
(no relacionado con el código promovido), resuelto con un simple
reintento del mismo commit, sin rollback ni corte de servicio real. Ver
`P2_T29A_PROMOTE_TO_MAIN_AND_PRODUCTION.md`.

## P2-T29A-ORDER-TRANSITION-AUTHORITY-CAS-AND-CONCURRENCY-TESTS — 2026-09-09 (1 commit, push a testing-codex, deploy TESTING SUCCESS — Production sin tocar)

```text
GIT_ACTION=1 commit + 1 push a origin/testing-codex
T29A_COMMIT_SHA=4b199540c78ebe0a010c699f6fc2e63b43d162a0
T29A_COMMIT_PARENT=6c6fc581ad678883f4e9fbcb9dbf8e90ecf63912
T29A_COMMIT_MESSAGE=feat: harden order transition authority with cas
FILESET=10 archivos (5 producto: order-transitions.ts nuevo + 4 endpoints modificados; 5 tests: 1 unit + 4 integración/mockeados nuevos)
PUSH=origin/testing-codex: 6c6fc58..4b19954
TESTING_DEPLOYMENT_ID=e84a22e3-27f5-4863-944e-c559e03976e3 (DeliGO Copy) / STATUS=SUCCESS / COMMIT=4b19954 (match exacto) / boot limpio, sin migraciones pendientes
TESTING_CHAT_SERVICE_REDEPLOY=SUCCESS (autodisparado por el mismo push, sin archivos propios en el diff)
PRODUCTION_CODE_CHANGED=NO / PRODUCTION_DEPLOYMENT=b516194e-83ec-4325-b0c7-8a2fac3b3b53, commit 969ea77, sin cambios
```

Cerró P2-T29A: autoridad de transición compartida + CAS real en las 2
transiciones no-cancelación de Negocio (ambos endpoints, incluida una
cuarta copia de reglas no documentada encontrada durante la
implementación) + 79 tests reales ejecutados, 0 fallas nuevas. Ver
`P2_T29A_ORDER_TRANSITION_AUTHORITY_CAS_AND_CONCURRENCY_TESTS.md`.

## PRE-T29-PROMOTE-CERTIFIED-TESTING-TO-MAIN-AND-PRODUCTION-R2 — 2026-09-08/09 (PROMOCIÓN COMPLETA — main y Production avanzados, tag creado)

```text
GIT_ACTION=1 release commit vía git commit-tree (969ea77ab1630b443fbc0e609397d9c45c5d7443, tree=testing-codex@6c6fc581, parent=origin/main@1de0d3c1) + 1 push fast-forward a origin/main + 1 tag anotado pusheado
RELEASE_COMMIT_SHA=969ea77ab1630b443fbc0e609397d9c45c5d7443
MAIN_PUSH=1de0d3c1..969ea77 (fast-forward, sin force, sin rechazo de branch protection)
PRODUCTION_DEPLOYMENT_ID=b516194e-83ec-4325-b0c7-8a2fac3b3b53 (DeliGO) / STATUS=SUCCESS / COMMIT=969ea77 (match exacto)
PRODUCTION_CHAT_SERVICE_REDEPLOY=SUCCESS (mismo commit, autodisparado)
PRODUCTION_MIGRATIONS_APPLIED=2 (20260901112243_add_legal_acceptance_versioning, 20260901130000_add_email_verification_expiry) — sin error
PRODUCTION_SMOKE=GET /, /cliente, /negocio, /repartidor sanos; manifest Cliente start_url=/cliente sin iosDebug; sw.js CACHE_NAME=deligo-v15; logs sin error
TAG=pre-t29-stable-2026-09-08, target=969ea77, creado y pusheado sólo después de SUCCESS+smoke
TESTING_CODEX_UNCHANGED=SI (6c6fc581ad678883f4e9fbcb9dbf8e90ecf63912, sin cambios)
```

Promoción curada completa tras el cierre físico de F-PRE-T29-02.
Mismo método de release ya validado en el intento R1 (snapshot commit,
nunca merge/fast-forward genérico de toda la historia de
`testing-codex`), esta vez sin usar `git reset --hard` en ningún
momento (prohibido explícitamente por la tarea) — el worktree aislado
se recreó desde cero para materializar el commit en vez de resetearlo.
Un hang de 15+ min en la reejecución de tests, causado por un comando
con una ruta de test inexistente (no por el código), fue diagnosticado
exhaustivamente antes de continuar, a pedido explícito del operador.
Batería completa reejecutada en grupos pequeños con timeouts finitos:
695 tests reales pasando, 0 fallas nuevas (6 preexistentes + 2
exclusiones de infraestructura, todas reproducidas idénticas contra el
HEAD de `testing-codex` sin modificar). Ver
`PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION_R2.md`.

## PRE-T29-FIX-MANIFEST-CLIENTE-IOSDEBUG-FLAG-TESTING — 2026-09-08 (1 commit, push a testing-codex, deploy TESTING SUCCESS — Production sin tocar)

```text
GIT_ACTION=1 commit + 1 push a origin/testing-codex
FIX_COMMIT_SHA=6c6fc581ad678883f4e9fbcb9dbf8e90ecf63912
FIX_COMMIT_PARENT=818b627b472e03e80034c047a51dfd3491f3add3
FIX_COMMIT_MESSAGE=fix: disable ios debug in client manifest
FILESET=public/manifest-cliente.json, src/lib/ios-pwa-debug-launch-static-contract.test.ts, src/lib/pwa-identity.test.ts
PUSH=origin/testing-codex: 818b627..6c6fc58 (HEAD=origin/testing-codex=6c6fc58, origin/main sin cambios=1de0d3c1)
TESTING_DEPLOYMENT_ID=d636ab54-7104-4e55-b9a6-6928ffc0817a (DeliGO Copy) / STATUS=SUCCESS / COMMIT=6c6fc58 (match exacto) / boot limpio, sin migraciones pendientes
TESTING_CHAT_SERVICE_REDEPLOY=SUCCESS (autodisparado por el mismo push, sin archivos propios en el diff — patrón ya conocido)
SERVED_MANIFEST_VERIFIED=SI (GET https://deligo-copy-production.up.railway.app/manifest-cliente.json → 200, start_url=/cliente, sin iosDebug)
PRODUCTION_CODE_CHANGED=NO / PRODUCTION_DEPLOYMENT=bf242d3b-35e1-4d55-8bfb-71d121e2fc6d, commit 1de0d3c1, sin cambios
```

Corrigió F-PRE-T29-02: `public/manifest-cliente.json`'s `start_url`
revertido de `/cliente?iosDebug=1` a `/cliente`, preservando el acceso
manual al panel de diagnóstico iOS (`/cliente?iosDebug=1` sigue
funcionando, sin cambios en `isIosDebugFlagEnabled`). Ver
`PRE_T29_FIX_MANIFEST_CLIENTE_IOSDEBUG_FLAG_TESTING.md`. Falta la
confirmación física en iPhone real antes de reintentar la promoción a
`main`/Production.

## PRE-T29-PROMOTE-CERTIFIED-TESTING-TO-MAIN-AND-PRODUCTION — 2026-09-08 (DETENIDA ANTES DEL PUSH — sin merge/commit/tag pusheado a testing-codex/main, un cambio de configuración Railway retenido)

```text
GIT_ACTION=NONE_PERSISTED (se construyó y verificó un commit snapshot local 245abcfa83d26f2784497e65d3be29420d162635 vía git commit-tree en un worktree aislado release/pre-t29-stable-2026-09-08 — branch y worktree eliminados al detener la tarea, el commit nunca se pusheó a ningún remoto)
RELEASE_METHOD=snapshot commit único (tree=testing-codex@818b627b472e03e80034c047a51dfd3491f3add3, parent=origin/main tip) con trailers Source-Head/Source-Merge-Base, siguiendo la convención de OPERATIONS_SECURITY_PRODUCTION_PROMOTION_R1.md
TREE_EQUIVALENCE_TO_TESTING_HEAD=SI (git diff --stat vacío, verificado byte a byte)
RAILWAY_ACTION=serviceInstanceUpdate (GraphQL vía railway api) — preDeployCommand agregado a Production/"DeliGO" (serviceId dd6b45fc-0d3d-4c38-86a6-cbb04a0025c9, environment production), valor idéntico al ya usado en TESTING: ["npx prisma migrate deploy --schema prisma/schema.prisma"]
RAILWAY_ACTION_TRIGGERED_DEPLOY=NO (config-only, deployment activo bf242d3b-35e1-4d55-8bfb-71d121e2fc6d sin cambios)
GIT_FINAL_STATE=origin/testing-codex=818b627b472e03e80034c047a51dfd3491f3add3 (sin cambios) / origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios) / sin tags nuevos
STOP_REASON=F-PRE-T29-02 (public/manifest-cliente.json start_url con ?iosDebug=1 hardcodeado, sin condicional de entorno) — decisión explícita del operador de detener y corregir en testing-codex primero
```

Intento de promoción curada, detenido antes de cualquier push por
decisión explícita del operador tras encontrar un bug real de
Production durante la revisión focal de diagnósticos iOS que la propia
tarea exige. El método de release (snapshot commit + trailers) quedó
validado y es reutilizable directamente en el reintento, una vez
corregido el manifest. El único cambio persistente de infraestructura
(`preDeployCommand` de Production) es independiente del código y
permanece vigente. Ver
`PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION.md`.

## PRE-T29-PRODUCTION-GOOGLE-OAUTH-PENDING-SECRET-PRECONDITION — 2026-09-08 (mutación de 1 variable de entorno en Railway Production — SIN commit/push de código)

```text
GIT_ACTION=NONE (ningún commit/push/tag — sólo mutación de variable de entorno en Railway, explícitamente autorizada)
RAILWAY_ACTION=variable set GOOGLE_OAUTH_PENDING_SECRET (environment: production, service: DeliGO)
PRODUCTION_ENV_REDEPLOYMENT_ID=bf242d3b-35e1-4d55-8bfb-71d121e2fc6d
PRODUCTION_ENV_REDEPLOY_STATUS=SUCCESS
PRODUCTION_ENV_REDEPLOY_COMMIT=1de0d3c153eaf3be068adeb004ea43feb42fc40e (idéntico al commit ya desplegado — sin cambio de código, sólo rebuild para inyectar la nueva variable)
PRODUCTION_CODE_CHANGED=NO
```

Único blocker de `PRE_T29_PRODUCTION_PROMOTION_READINESS_AUDIT.md`
resuelto: `GOOGLE_OAUTH_PENDING_SECRET` (CSPRNG local, 64 caracteres,
nunca expuesto) agregada a Railway Production/"DeliGO". El cambio
disparó un redeploy automático del mismo commit, `SUCCESS`, smoke no
mutante PASS. TESTING y el resto de variables de Production sin
cambios (diff de nombres: +1 exacto). Ver
`PRE_T29_PRODUCTION_GOOGLE_OAUTH_PENDING_SECRET_PRECONDITION.md`.

## PRE-T29-PRODUCTION-PROMOTION-READINESS-AUDIT — 2026-09-08 (READ-ONLY — sin merge/commit/tag/push/deploy/mutación Railway)

```text
GIT_ACTION=NONE (auditoría estrictamente read-only; único comando de escritura fue `git merge-tree --write-tree`, que sólo agrega objetos blob/tree inofensivos a .git/objects, sin tocar working tree/index/HEAD ni ninguna referencia)
MERGE_BASE_FOUND=86609599bcbdf7979244c34298a27836e6452d3c
COMMITS_MAIN_ONLY=4 / COMMITS_TESTING_ONLY=61
RAILWAY_TESTING_COMMIT=818b627b472e03e80034c047a51dfd3491f3add3 (sin cambios)
RAILWAY_PRODUCTION_COMMIT=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios, verificado también en el chat-service de Production)
PROMOTION_READY=NO / PROMOTION_BLOCKER=GOOGLE_OAUTH_PENDING_SECRET ausente en Production
```

Auditoría de disponibilidad de promoción a Production previa a P2-T29A
— cero commit/push/tag/deploy/mutación de Railway. Confirmó la
convención de promoción ya establecida (release curado con
`Source-Commit:` trailer, ver `DECISIONS_AND_INVARIANTS.md`) y
encontró un único blocker mecánico (1 variable de entorno faltante).
Ver `PRE_T29_PRODUCTION_PROMOTION_READINESS_AUDIT.md`.

## P2-T29-ESPERANDO-REPARTIDOR-ACCEPTANCE-REDESIGN-AUDIT-AND-DESIGN — 2026-09-08 (READ-ONLY — sin commit/push/deploy)

```text
GIT_ACTION=NONE (auditoría y diseño estrictamente read-only)
FINAL_CERTIFIED_TESTING_COMMIT=818b627b472e03e80034c047a51dfd3491f3add3 (sin cambios en esta tarea)
PRODUCTION_COMMIT=1de0d3c153eaf3be068adeb004ea43feb42fc40e (verificado sin cambios)
```

Auditoría profunda del lifecycle de pedidos y diseño de P2-T29 — cero
commit/push/deploy, cero cambios de producto/tests/DB. Ver
`P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md`.

## P2-T31-R21-FINAL-DIAGNOSTICS-DISPOSITION-AND-CLOSEOUT — 2026-09-08 (READ-ONLY — sin commit/push/deploy nuevo — CIERRA P2-T31)

```text
GIT_ACTION=NONE (auditoría estrictamente read-only)
FINAL_CERTIFIED_TESTING_COMMIT=818b627b472e03e80034c047a51dfd3491f3add3 (R24, sin cambios en R21)
FINAL_CERTIFIED_TESTING_DEPLOYMENT=1f025eba-02ed-469c-9412-3c3c740d4550 (DeliGO Copy, SUCCESS, sin cambios)
PRODUCTION_COMMIT=1de0d3c153eaf3be068adeb004ea43feb42fc40e (verificado sin cambios)
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED
```

R21 no realizó ningún commit/push/deploy — auditoría final read-only
de disposición de diagnósticos y decisión de closeout. El último
commit/deploy certificado de todo el epic P2-T31 sigue siendo el de
R24 (`818b627`, deployment `1f025eba-...`). Ningún commit de P2-T31 fue
promovido a `main`/Production — sigue en `1de0d3c1`, sin cambios, sin
autorización de promoción en esta tarea. Ver
`P2_T31_R21_FINAL_DIAGNOSTICS_DISPOSITION_AND_CLOSEOUT.md`.

## P2-T31-R24-IOS-CHAT-SAFE-AREA-INTERACTIVE-CONTROLS-AUDIT-FIX-TESTING-DEPLOY — 2026-09-08

Commit único, testing-codex únicamente, fix de los controles
interactivos de Chat atrapados en la safe-area de iOS (status bar/
Dynamic Island), tras la confirmación física de R23C:

```text
COMMIT_HASH=818b627b472e03e80034c047a51dfd3491f3add3
COMMIT_PARENT=1bd953a6bc97fe5dffa993d1653ee55212f012d4
COMMIT_MESSAGE=fix: keep chat controls below ios safe area
COMMITTED_FILE_COUNT=5 (chat-sheet.tsx, chat-view.tsx, sheet.tsx modificados; globals.css modificado; chat-ios-safe-area-static-contract.test.ts nuevo)
PUSH_TARGET=testing-codex (exclusivamente)
TESTING_DEPLOYMENT_ID=1f025eba-02ed-469c-9412-3c3c740d4550
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
TESTING_SERVICE=DeliGO Copy (deligo-copy-production.up.railway.app)
PRODUCTION_COMMIT_BEFORE=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_COMMIT_AFTER=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_TOUCHED=NO
```

Fix: el header del listado de chats (`chat-sheet.tsx`) y el header de
la conversación individual (`chat-view.tsx`) recibieron
`pt-[calc(env(safe-area-inset-top,0px)+Xrem)]` en vez de un `py-*`
plano — mismo idioma ya usado en `mesa-cuenta-dialog.tsx`/`n/[slug]/
page.tsx`/`cliente/page.tsx`. El botón cerrar (X) built-in de
`sheet.tsx` (compartido por todos los Sheets de la app) recibió un
`data-slot="sheet-close"` inerte, y `globals.css` lo reposiciona SÓLO
bajo `[data-ios-debug-role="chat-sheet"]` — ningún otro Sheet de la
app se ve afectado. El fondo/full-bleed del Sheet (`h-dvh`,
`overflow-hidden`, `top:0`) no se tocó. `viewport-fit=cover` (global,
`layout.tsx`) sin cambios. Sin branching por plataforma —
`env(safe-area-inset-top)` resuelve a 0 en Android/no-notch. R23C
(`useChatDeepLink`/`useChatActorReset`/push routing/`notificationclick`)
sin ningún cambio.

12 tests nuevos (`chat-ios-safe-area-static-contract.test.ts`). Suite
Push 607/607 sin regresión, `notificationclick` 6/6 sin cambios,
R23C 21/21 sin cambios, contratos estáticos de chat existentes 76/76
sin cambios. iOS/PWA proxy: 303 pass, 5 fail preexistentes (mismo
archivo no tocado por esta tarea, ya documentado en R23C), 0 nuevas.
ESLint limpio, TypeScript 24 raw idéntico (0 nuevos), `next build`
limpio. Desplegado en TESTING (servicio "DeliGO Copy") con match
exacto de commit, logs de boot limpios, smokes `/negocio`→200,
`/cliente/`→308. Production intacta. Ver
`P2_T31_R24_IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_AUDIT_FIX_TESTING_DEPLOY.md`.

## P2-T31-R23C-CHAT-ACTOR-RESET-FIRST-HYDRATION-GUARD-FIX-TESTING-DEPLOY — 2026-09-08

Commit único, testing-codex únicamente, fix del root cause PROVEN por
R23B (`useChatActorReset` borraba el chat que `useChatDeepLink` acababa
de abrir en el mismo commit de React, en la primera hidratación):

```text
COMMIT_HASH=1bd953a6bc97fe5dffa993d1653ee55212f012d4
COMMIT_PARENT=23c038af4406e7ee838d465e3d2023acf391fb5f
COMMIT_MESSAGE=fix: preserve chat state on initial auth hydration
COMMITTED_FILE_COUNT=2 (src/providers/chat-provider.tsx modificado, src/providers/chat-provider-deep-link-hydration.test.ts extendido)
PUSH_TARGET=testing-codex (exclusivamente)
TESTING_DEPLOYMENT_ID=e1fad4be-dacb-44c8-8721-48973bb18bdf
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
TESTING_SERVICE=DeliGO Copy (deligo-copy-production.up.railway.app)
PRODUCTION_COMMIT_BEFORE=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_COMMIT_AFTER=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_TOUCHED=NO
```

Fix: `useChatActorReset` ahora ignora la transición `null -> primer
actor real` (primera hidratación de `auth-store`), tratándola distinta
de un cambio de actor real (`real -> null` logout, o `real A -> real
B`), que sigue reseteando el chat-store exactamente igual que antes.
Reproducción same-commit rigurosa: revirtiendo temporalmente sólo el
`!== null` del guard, 5/21 tests nuevos fallan; restaurado de
inmediato, 21/21 verdes. Matriz completa de 9 casos de transición de
actor cubierta (A-I). Suite Push 607/607 sin regresión (34 archivos
`*push*.test.ts`), `notificationclick` 6/6 sin cambios, ESLint limpio,
TypeScript 24 raw idéntico (0 nuevos), `next build` limpio.
`public/sw.js`/`auth-store.ts`/`chat-store.ts`/backend: **ningún
cambio**. Desplegado en TESTING (servicio "DeliGO Copy") con match
exacto de commit, logs de boot limpios, smokes `/negocio`→200,
`/cliente/`→308. Production intacta. Ver
`P2_T31_R23C_CHAT_ACTOR_RESET_FIRST_HYDRATION_GUARD_FIX_TESTING_DEPLOY.md`.

## P2-T31-R23A-CHAT-NOTIFICATION-DEEPLINK-AUTH-HYDRATION-FIX-TESTING-DEPLOY — 2026-09-08

Commit único, testing-codex únicamente, fix de la carrera de
hidratación de auth probada en R23:

```text
COMMIT_HASH=23c038af4406e7ee838d465e3d2023acf391fb5f
COMMIT_PARENT=ed58ca47a522b8190c41283818d1742887f24d31
COMMIT_MESSAGE=fix: preserve chat deep links through auth hydration
COMMITTED_FILE_COUNT=3 (1 modificado: src/providers/chat-provider.tsx; 2 tests nuevos: chat-provider-deep-link-hydration.test.ts, sw-notificationclick-target-routing.test.ts)
PUSH_TARGET=testing-codex (exclusivamente)
TESTING_DEPLOYMENT_ID=96dc9cd8-b4d6-492b-a0e6-e6566127d38c
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
PRODUCTION_COMMIT_BEFORE=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_COMMIT_AFTER=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_TOUCHED=NO
```

Implementa el fix diseñado en R23: `useChatDeepLink`
(`src/providers/chat-provider.tsx`) ahora lee `authHasHydrated =
useAuthStore((s) => s._hasHydrated)` (campo YA existente, cero sistema
nuevo) y lo agrega a las dependencias del efecto — cuando la
hidratación termina, `consumeChatParam()` se reevalúa automáticamente,
cerrando la carrera donde un arranque en frío (tap de notificación de
chat) descartaba el deep-link `?chat=<pedidoId>` para siempre en
silencio. `consumeChatParam()` en sí no cambió ni una línea; el guard
existente (`if (!chatPedidoId) return`) previene doble apertura.

Reproducción rigurosa antes/después: se revirtió temporalmente sólo la
línea de dependencias del efecto y se confirmó que exactamente 3 de 10
tests nuevos fallan sin el fix (la reproducción de la carrera + 2
casos de camino feliz con hidratación diferida) — se restauró de
inmediato después. 16 tests nuevos en total (10 de hidratación +
6 de `notificationclick` con el `public/sw.js` real, cerrando el gap
de cobertura que R23 documentó). Suite Push 607/607 sin regresión, PWA
focal 52/52 sin regresión, ESLint/TypeScript (24 raw, 0 nuevos)/`git
diff --check`/`next build` limpios. `public/sw.js`, `src/lib/push.ts`,
`auth-store.ts`: sin ningún cambio. Stage de exactamente 3 archivos,
sin el reporte (queda untracked, precedente de R1A no generalizado).

Autodeploy Git-triggered normal a "DeliGO Copy" — deployment
`96dc9cd8-b4d6-492b-a0e6-e6566127d38c` `SUCCESS`, `meta.commitHash` ==
`23c038a` exacto. Logs de boot limpios. Validación no mutante: `/negocio`
→ 200, `/cliente/` → 308 (normal); el bundle JS desplegado confirmado
conteniendo `_hasHydrated` (evidencia complementaria al match exacto de
commit, que es la confirmación autoritativa). Ninguna suscripción/
pedido/mensaje mutado. Production confirmada sin cambios en el mismo
`railway status --json`.

`PUSH_CHAT_NOTIFICATION_TAP_ROUTING_FINDING=FIX_DEPLOYED_TESTING_
AWAITING_PHYSICAL_CONFIRMATION` — no se certifica físicamente todavía;
checklist de 2-3 casos entregado al operador (Android Negocio e iPhone
Negocio obligatorios, Negocio→Cliente recomendado). Se registraron 2
findings nuevos aportados por el operador durante esta tarea, ninguno
corregido: iOS chat safe-area de controles interactivos (bloquea
P2-T31) y Android PWA install completion UX (no bloquea, queda en
cola como tarea UX separada). Ver
`P2_T31_R23A_CHAT_NOTIFICATION_DEEPLINK_AUTH_HYDRATION_FIX_TESTING_DEPLOY.md`.

## P2-T31-R22A-ANDROID-PUSH-NOTIFICATION-ROLE-ICON-ROUTING-FIX-TESTING-DEPLOY — 2026-09-08

Commit único, testing-codex únicamente, fix de routing de ícono de
notificación probado en R22:

```text
COMMIT_HASH=ed58ca47a522b8190c41283818d1742887f24d31
COMMIT_PARENT=1d3f58a1ea5487d254b51fa8627b5935065bce3a
COMMIT_MESSAGE=fix: route push notification icons by recipient role
COMMITTED_FILE_COUNT=3 (1 modificado: public/sw.js; 2 tests: src/lib/push.test.ts modificado, src/lib/sw-push-role-icon-routing.test.ts nuevo)
PUSH_TARGET=testing-codex (exclusivamente)
TESTING_DEPLOYMENT_ID=34f5cf79-25bd-4d7a-855c-287d8bacdc4a
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
PRODUCTION_COMMIT_BEFORE=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_COMMIT_AFTER=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_TOUCHED=NO
```

Implementa el fix diseñado en R22: el `push` event de `public/sw.js`
ahora resuelve `icon`/`badge` PRIMERO por `data.data?.role` (ya
agregado por `createNotification()`::`personalRoleFor` en
`src/lib/push.ts` — backend sin cambios), cayendo al `if/else if`
legacy por `notifType` completo e intacto como fallback exclusivamente
para payloads sin `role` (Salón/Mozo/Empleado/Operaciones y cualquier
push viejo ya encolado). El override explícito `data.icon`/`data.badge`
del payload sigue ganando siempre — sin cambios en esa línea.

26 tests nuevos ejercitando el `sw.js` REAL (`sw-push-role-icon-
routing.test.ts`, misma técnica de `sw-push-dedupe.test.ts`) + 4 tests
nuevos de `data.role` en `push.test.ts` (sin fixture de DB) — suite
Push completa 607/607 (577 baseline + 30 nuevos), PWA focal 52/52 sin
cambios, ESLint/TypeScript (24 raw, 0 nuevos)/`git diff --check`/`next
build` limpios. Reproducción antes/después del bug físico exacto de
R22 (Cliente+order_update, Negocio+chat, Repartidor+new_delivery):
FAIL→PASS confirmado. Stage selectivo de exactamente 3 archivos, sin
el reporte de esta tarea (queda untracked, convención histórica
preservada, precedente de R1A no generalizado).

Autodeploy Git-triggered normal a "DeliGO Copy" — deployment
`34f5cf79-25bd-4d7a-855c-287d8bacdc4a` `SUCCESS`, `meta.commitHash` ==
`ed58ca4` exacto. Logs de boot limpios. Validación no mutante:
`GET /sw.js` → 200, contenido byte a byte idéntico al commit (sólo
diferencia CRLF/LF de transporte), con los 3 selectores de rol y el
fallback legacy verificados estáticamente; los 3 íconos de rol siguen
respondiendo 200. Ninguna suscripción mutada, ningún pedido creado,
ningún Push real enviado. Production confirmada sin cambios en el
mismo `railway status --json`.

`ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=FIX_DEPLOYED_TESTING_
AWAITING_PHYSICAL_CONFIRMATION` — no se certifica físicamente todavía;
checklist de re-test de 3 casos entregado al operador (Cliente+
order_update obligatorio, Negocio+chat y Repartidor+new_delivery
recomendados). P2-T31 sigue abierto, "R21 final" no se ejecuta hasta
esa confirmación. Ver
`P2_T31_R22A_ANDROID_PUSH_NOTIFICATION_ROLE_ICON_ROUTING_FIX_TESTING_DEPLOY.md`.

## DELIGO-BRANDING-R1A-REVIEW-COMMIT-PUSH-TESTING-DEPLOY-AND-CONTEXT-RECONCILIATION — 2026-09-08

Commit único, testing-codex únicamente, tarea de branding independiente
de P2-T31:

```text
COMMIT_HASH=1d3f58a1ea5487d254b51fa8627b5935065bce3a
COMMIT_PARENT=39566e69647fd2b19453721214563a7b9a0ccc5e
COMMIT_MESSAGE=feat: refresh DeliGO role icons
COMMITTED_FILE_COUNT=15 (11 modificados: 8 PNG de ícono in-place + manifest-operaciones.json + sw.js + role-config.ts; 4 nuevos: icon-operaciones-192x192.png, icon-operaciones-512x512.png, pwa-role-icon-contract.test.ts, y el propio reporte DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md)
PUSH_TARGET=testing-codex (exclusivamente)
TESTING_DEPLOYMENT_ID=976a7fa7-b607-40e2-8cb4-22907f005d22
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
PRODUCTION_COMMIT_BEFORE=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_COMMIT_AFTER=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_TOUCHED=NO
```

Despliega a TESTING el refresh de branding de las 5 superficies PWA de
rol (Cliente naranja, Negocio turquesa, Repartidor azul, Admin violeta,
Operaciones rojo — este último dejando de prestar el ícono de Negocio)
ya implementado y testeado localmente en DELIGO-BRANDING-R1. Review
independiente confirmó, contra Git y archivos reales (no sólo contra
el reporte), que el fileset coincidía exactamente con lo documentado.
Gate re-ejecutado fresco: 52 tests focales PWA/icon en 0 fail, suite
Push completa (577 tests, 33 archivos) en 0 fail (re-ejecutada por
tocar `sw.js`), ESLint limpio, TypeScript 24 raw idéntico a la
baseline (0 nuevos), `git diff --check` limpio, `next build` completo
sin errores. Stage selectivo individual (`git add --` uno por uno,
nunca wildcard) — `git diff --cached --name-status` confirmó
exactamente los 15 archivos esperados antes de commitear (14 de
producto/test + el reporte `DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md`
explícitamente autorizado por esta tarea — primer archivo jamás
trackeado bajo `codex-reports/`, ningún otro archivo de esa carpeta se
stageó). `branding-source/` (ya en `.gitignore` desde antes de esta
sesión) y `DELIGO_FULL_CONTEXT_LATEST.md` permanecen untracked; `32`
intacto.

Autodeploy Git-triggered normal a "DeliGO Copy" (sin `railway up`, sin
mutar variables/domains/DB/service settings/replicas/VAPID/secrets),
poll directo y finito (3 iteraciones): `BUILDING`→`DEPLOYING`→`SUCCESS`,
`meta.commitHash` == `1d3f58a` exacto (verificado vía `railway status
--json`, no asumido). Logs de boot limpios ("No pending migrations to
apply.", Next.js 16.1.3 "✓ Ready in 65ms"), sin error/fatal/unhandled/
500. Smokes NO destructivos: `/` → 307 (normal), los 5
`manifest-{rol}.json` → 200 `application/json`, los 10
`icon-{rol}-{192x192,512x512}.png` → 200 `image/png` con tamaño en
bytes idéntico al archivo local commiteado; `manifest-operaciones.json`
confirmado programáticamente sin `icon-negocio`; `sw.js` confirmado
sirviendo `CACHE_NAME = "deligo-v15"`. En el MISMO `railway status
--json`, el servicio Production ("DeliGO") confirmó `commitHash:
1de0d3c153eaf3be068adeb004ea43feb42fc40e` — sin cambios.

`DELIGO_BRANDING_R1_TESTING_DEPLOY_STATUS=DEPLOYED_AWAITING_PHYSICAL_
VISUAL_CHECK` — este deploy pone el branding nuevo disponible en
TESTING, pero no certifica físicamente el ícono visual del launcher
(fuera del alcance de lo que Claude puede verificar). Se registraron 3
findings (maskable safe-zone OPEN, SW cache bypass substring
OPEN_NON_BLOCKING, y un finding NUEVO: routing de ícono de notificación
Push Android — Cliente mostró el ícono de Negocio, OPEN, bloquea el
closeout de P2-T31). Ver
`DELIGO_BRANDING_R1A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY.md`.

## P2-T31-R19A-REVIEW-COMMIT-PUSH-TESTING-DEPLOY — 2026-09-08

Commit único, testing-codex únicamente, exclusivamente los 4 archivos
de producto/tests ya auditados en R19/R19R/R19R1:

```text
COMMIT_HASH=39566e69647fd2b19453721214563a7b9a0ccc5e
COMMIT_PARENT=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84
COMMIT_MESSAGE=fix: harden push subscription recovery
COMMITTED_FILE_COUNT=4 (2 modificados: src/hooks/use-push-notifications.ts, src/hooks/use-push-notifications-static-contract.test.ts; 2 nuevos: src/hooks/use-push-notifications-abort-retry.test.ts, src/hooks/use-push-notifications-stale-actor-backend-guard.test.ts)
PUSH_TARGET=testing-codex (exclusivamente)
TESTING_DEPLOYMENT_ID=425ff95a-5a2e-4d70-9dd1-fbae6df5ce19
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
PRODUCTION_COMMIT_BEFORE=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_COMMIT_AFTER=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_TOUCHED=NO
```

Despliega a TESTING la mitigación completa del `AbortError` de
`PushManager.subscribe()` (R19: retry único con recheck defensivo;
R19R: guard stale-actor pre-backend; R19R1: cobertura explícita de
`MUTATION_REGISTRY_SET`/`RELEASE` con el registry real) — ver los 3
reportes correspondientes para el diseño completo. Review final
pre-commit confirmó, línea por línea, que el diff coincide exactamente
con lo ya auditado y aprobado en esas 3 tareas — cero cambios
funcionales nuevos introducidos en esta tarea. Gate de calidad
re-ejecutado fresco: 577 tests focales (`*push*.test.ts`, 33 archivos)
en 0 fail, ESLint limpio en los 4 archivos exactos, TypeScript 24
raw/18 distintos (idéntico a la baseline vigente desde R15A, 0
nuevos), `git diff --check` limpio. Stage selectivo individual (`git
add --` uno por uno, nunca wildcard) — `git diff --cached
--name-status` confirmó exactamente los 4 archivos esperados antes de
commitear.

Autodeploy Git-triggered normal a "DeliGO Copy" (sin `railway up`, sin
mutar variables/domains/DB/service settings/replicas/VAPID/secrets),
poll directo y finito: deployment `425ff95a-5a2e-4d70-9dd1-fbae6df5ce19`
en `SUCCESS`, instancia `RUNNING`, `meta.commitHash` == `39566e6`
exacto (verificado vía `railway status --json`, no asumido). Logs de
build (imagen exportada/pusheada sin error) y de boot ("No pending
migrations to apply.", Next.js "✓ Ready in 67ms") limpios, sin
error/fatal/unhandled/500. Smokes NO destructivos: `/` → 307 a
`/cliente/` (normal), `/cliente/` → 308 (normalización de slash,
normal), `/negocio` → 200, `/repartidor` → 200, `GET /api/push/
debug-guard` → `200 {"allowed":true}` (lectura), `GET /api/push/
vapid-key` → `200` (lectura pública, sin mutación) — deliberadamente
NUNCA se ejecutó `POST /api/push/subscribe` (sería una mutación). En
el MISMO `railway status --json`, el servicio Production ("DeliGO",
`branch: main`) confirmó `commitHash: 1de0d3c153eaf3be068adeb004ea43
feb42fc40e` — sin cambios.

`ANDROID_PHYSICAL_MITIGATION_CERTIFIED=NO` — este deploy pone la
mitigación disponible en TESTING, pero no la certifica físicamente.
Próxima acción: un ÚNICO reintento físico de activación en Android
Negocio, con la traza de diagnóstico armada, sobre este build exacto
(`39566e6`). Ver
`P2_T31_R19A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY.md`.

## P2-T31-R15A-COMMIT-DEPLOY-AND-CLOSED-PWA-RETEST — 2026-09-07

Commit único, testing-codex únicamente, exclusivamente los 2 archivos
de producto autorizados (Skills/docs preservados fuera del commit):

```text
COMMIT_HASH=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84
COMMIT_PARENT=8b49756e76a32b2641bd1099c1e8382d3be32f25
COMMIT_MESSAGE=fix: prioritize time-sensitive web push
COMMITTED_FILE_COUNT=2 (src/lib/push.ts, src/lib/push.test.ts — verificado con git diff --cached --name-status antes de commitear)
PUSH_TARGET=testing-codex (exclusivamente)
TESTING_DEPLOYMENT_ID=906d7960-10f5-449b-a1bd-a492feb91bab
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI (verificado vía `railway status --json`, meta.commitHash del deployment activo == COMMIT_HASH)
PRODUCTION_COMMIT_BEFORE=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_COMMIT_AFTER=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_TOUCHED=NO
```

Despliega a TESTING la corrección R15R sobre el fix de prioridad de
entrega de push de R15: `urgency:"high"` acotado a los 8
`NotificationType` genuinamente time-sensitive (nunca global), sin
forzar ningún `TTL` explícito (el default de la librería, 28 días,
queda intacto), y el log de éxito del proveedor gateado TESTING-only
(`isPushDebugAllowedEnvironment`) con el `statusCode` real agregado.
Gate de calidad re-ejecutado fresco sobre el estado exacto commiteado:
240 tests focales (`push*.test.ts`, 8 archivos) en 0 fail, ESLint
limpio en los 2 archivos, TypeScript 24 raw / 18 distintos (idéntico a
la baseline de R15R, 0 nuevos), `git diff --check` limpio. Autodeploy
Git-triggered normal (sin `railway up`, poll directo y finito contra
`railway status`/`railway status --json`). Logs de build y de
deployment revisados: build exportó y pusheó la imagen sin errores;
boot mostró "No pending migrations to apply", Next.js "Ready in 65ms",
sin fatal/unhandled/500 nuevos. Smokes verdes: `/` → 307 a `/cliente/`
(normal), `/cliente/` → 308 (normalización de slash, normal),
`GET /api/push/debug-guard` → `200 {"allowed":true}` (confirma que el
mismo guard reutilizado por el nuevo log de éxito de push reconoce
TESTING correctamente en el entorno real). No se generó tráfico de
push real para forzar el nuevo log `[Push] Enviado OK` — no había
ningún evento de pedido real disponible sin afectar datos reales; la
verificación del guard en runtime real (`debug-guard` → `allowed:true`)
es la evidencia sustituta aceptada por la propia tarea. Ver
`P2_T31_R15A_COMMIT_DEPLOY_AND_CLOSED_PWA_RETEST_READY.md` para el
detalle completo del preflight/stage/commit/push/deploy/smoke.

## P2-T31-R13A-PUSH-FAILURE-REPORTING-HARDENING-AND-TESTING-DEPLOY — 2026-09-06

Commit único, testing-codex únicamente:

```text
COMMIT_HASH=8b49756e76a32b2641bd1099c1e8382d3be32f25
COMMIT_PARENT=085cc0b540f51a841115697eb25dbf98d3740023
COMMIT_MESSAGE=fix: keep push failure state consistent
COMMITTED_FILE_COUNT=4 (3 tracked modificados + 1 nuevo, re-derivados de
                        Git antes del stage)
PUSH_TARGET=testing-codex (exclusivamente)
TESTING_DEPLOYMENT_ID=5de51131-d42a-485f-85e6-647904013f88
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
PRODUCTION_COMMIT_BEFORE=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_COMMIT_AFTER=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_TOUCHED=NO
```

Despliega el hardening de `reportMutationFailureSafely` (R13): logging y
toast ahora tienen boundaries de excepción INDEPENDIENTES (antes
compartían un único `try/catch`) — un fallo de `console.error` ya no
puede impedir que se intente el `toast.error`, y ninguno de los dos
puede impedir que `finishMutation`/la traza de finalización se
ejecuten. Cero cambio de comportamiento en el camino feliz. Antes de
commitear se corrigió el wording de R13 sobre la excepción secundaria
(`SECONDARY_FAILURE_EXACT_THROW_SITE=NOT_DIRECTLY_OBSERVED`, en vez de
implicar una atribución más precisa de la que la evidencia permite).
Smokes verdes: HTTP 200 en `/cliente`/`/negocio`/`/repartidor` (redirect
307 normal en `/`); `GET /api/push/debug-guard` → `200
{"allowed":true}`; logs sin errores, "No pending migrations to apply".
Nota de proceso: polling directo y finito contra Railway (sin watchers
de fondo). Ver
`P2_T31_R13A_PUSH_FAILURE_REPORTING_HARDENING_TESTING_DEPLOY.md` para el
detalle completo del preflight/stage/commit/push/deploy/smoke.

## P2-T31-R12A-ANDROID-PHYSICAL-SUBSCRIBE-DIAGNOSTICS-TESTING-DEPLOY — 2026-09-06

Commit único, testing-codex únicamente:

```text
COMMIT_HASH=085cc0b540f51a841115697eb25dbf98d3740023
COMMIT_PARENT=70d3f826bef291f403f0e42e007187eb1b5d6688
COMMIT_MESSAGE=chore: trace physical push subscription lifecycle
COMMITTED_FILE_COUNT=5 (4 tracked modificados + 1 nuevo, re-derivados de
                        Git antes del stage)
PUSH_TARGET=testing-codex (exclusivamente)
TESTING_DEPLOYMENT_ID=13800b1d-7f00-44b7-8c42-e7b397446d2a
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
PRODUCTION_COMMIT_BEFORE=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_COMMIT_AFTER=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_TOUCHED=NO
```

Despliega la instrumentación diagnóstica pura agregada en R12 para el
fallo físico real de first-subscribe en Android — `SUBSCRIBE_PHYSICAL_
CREATE_START/RESULT/ERROR` (bracketeando el único `await` que la traza
física probó indocumentado, `registration.pushManager.subscribe(...)`)
y `MUTATION_REGISTRY_SET/RELEASE/WAIT_FOUND/WAIT_NOT_FOUND` (en el
registro cross-remount de R2). Cero cambio de comportamiento — sólo
visibilidad para el próximo capture físico. Antes de commitear, se
corrigió una imprecisión factual de R12 (la traza SÍ incluía
`actorFamily=cliente`/`authHasHydrated=true` en `SUBSCRIBE_START`),
propagada a todas las autoridades. Smokes verdes: HTTP 200 en
`/cliente`/`/negocio`/`/repartidor` (redirect 307 normal en `/`); `GET
/api/push/debug-guard` → `200 {"allowed":true}`; logs sin errores,
"No pending migrations to apply". Nota de proceso: polling directo y
finito contra Railway (sin watchers de fondo). Ver
`P2_T31_R12A_ANDROID_DIAGNOSTICS_TESTING_DEPLOY_PENDING_PHYSICAL_RETEST.md`
para el detalle completo del preflight/stage/commit/push/deploy/smoke.

## P2-T31-R8-TESTING-COMMIT-DEPLOY-AND-PHYSICAL-RETEST — 2026-09-06

Commit único, testing-codex únicamente:

```text
COMMIT_HASH=70d3f826bef291f403f0e42e007187eb1b5d6688
COMMIT_PARENT=6380ba2b77ffe6bee1b978ef1e2480da233e61c2
COMMIT_MESSAGE=fix: separate push status and mutation limits
COMMITTED_FILE_COUNT=15 (13 tracked modificados + 2 nuevos, re-derivados
                          de Git antes del stage)
PUSH_TARGET=testing-codex (exclusivamente)
TESTING_DEPLOYMENT_ID=58f4e0a3-e562-4527-928f-e6880fbb3c09
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
PRODUCTION_COMMIT_BEFORE=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_COMMIT_AFTER=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_TOUCHED=NO
```

Despliega el fix de rate limiting Push (bucket dividido en
`pushStatus`/`pushMutation` independientes) + semántica de error de
status corregida (429 ya no se representa como OFF confirmado) +
mensajes de mutación fallida más claros. Smokes verdes: HTTP 200 en
`/cliente`/`/negocio`/`/repartidor` (redirect 307 normal en `/`); `GET
/api/push/debug-guard` → `200 {"allowed":true}`; logs sin errores. Nota
de proceso: polling directo y finito contra Railway (sin watchers de
fondo), per instrucción explícita del usuario tras la tarea de deploy
anterior. Ver
`P2_T31_R8_TESTING_DEPLOY_PENDING_STRESS_PHYSICAL_RETEST.md` para el
detalle completo del preflight/stage/commit/push/deploy/smoke.

## P2-T31-R7-TESTING-COMMIT-DEPLOY-AND-PHYSICAL-RETEST — 2026-09-06

Commit único, testing-codex únicamente:

```text
COMMIT_HASH=6380ba2b77ffe6bee1b978ef1e2480da233e61c2
COMMIT_PARENT=925a86017a5e7546f0a6f82245c9d5fc1d344776
COMMIT_MESSAGE=fix: avoid transient push off state
COMMITTED_FILE_COUNT=14 (12 tracked modificados + 2 nuevos, re-derivados
                          de Git antes del stage)
PUSH_TARGET=testing-codex (exclusivamente)
TESTING_DEPLOYMENT_ID=41124f04-f69b-4a51-8b9d-7da562c8b6e1
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
PRODUCTION_COMMIT_BEFORE=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_COMMIT_AFTER=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_TOUCHED=NO
```

Despliega el fix `statusResolved` (evita el flicker C4 confirmado por
evidencia física) + 2 correcciones de higiene de debug. Smokes verdes:
HTTP 200 en `/cliente`/`/negocio`/`/repartidor` (redirect 307 normal en
`/`); `GET /api/push/debug-guard` → `200 {"allowed":true}`; logs sin
errores. Nota de proceso: un polling en background para verificar el
deploy fue detenido explícitamente por el usuario
(`RAILWAY_WATCHER_POLICY=DISABLED_DUE_TO_REPEATED_STALE_WAITERS`) — la
confirmación final se hizo con polling directo finito. Ver
`P2_T31_R7_TESTING_DEPLOY_PENDING_C4_PHYSICAL_RETEST.md`.

## P2-T31-R6B-TESTING-DIAGNOSTIC-DEPLOY — 2026-09-05

Commit único, testing-codex únicamente:

```text
COMMIT_HASH=925a86017a5e7546f0a6f82245c9d5fc1d344776
COMMIT_PARENT=a8ac961bd81ee505297f81787c1cf32e3f4cd161
COMMIT_MESSAGE=chore: add testing push lifecycle diagnostics
COMMITTED_FILE_COUNT=24 (12 tracked modificados + 12 nuevos, re-derivados
                          de Git antes del stage — nunca `git add -A`/`.`)
PUSH_TARGET=testing-codex (exclusivamente)
TESTING_DEPLOYMENT_ID=85fc4026-3f92-446c-823d-e6dd00e1a611
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
PRODUCTION_COMMIT_BEFORE=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_COMMIT_AFTER=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_TOUCHED=NO
```

Despliega exclusivamente la instrumentación diagnóstica de push
(R6+R6A+R6B) — ningún algoritmo de subscribe/unsubscribe/status/VAPID/
server-detach fue tocado. Smokes verdes: HTTP 200 en `/cliente`,
`/negocio`, `/repartidor` (redirect 307 normal en `/`); `GET
/api/push/debug-guard` → `200 {"allowed":true}` en TESTING; logs del
deployment sin errores. Autodeploy incidental de "chat en vivo" al mismo
commit (monorepo, sin intervención manual). Ver
`P2_T31_R6B_TESTING_DIAGNOSTIC_DEPLOY_PENDING_PHYSICAL_TRACE.md` para el
detalle completo del preflight/stage/commit/push/deploy/smoke.

## PRODUCTION-EMAIL-VERIFICATION-BLOCKER-CLOSURE — 2026-09-05

La evidencia del operador confirma una mutación manual de Production fuera de
esta tarea: durante la rotación de Resend, Production había quedado con la
clave vieja; tras su eliminación, Leonardo actualizó `RESEND_API_KEY` en
Production y redeployó. El deployment actual de DeliGO
(`bc4a94a9-8ee8-4ed8-8a41-e791b1911f16`) quedó en el commit
`1de0d3c153eaf3be068adeb004ea43feb42fc40e` y registró aceptación de un envío
de verificación por Resend.

```text
OPERATOR_PRODUCTION_ENV_CHANGE_CONFIRMED=SI
OPERATOR_PRODUCTION_DEPLOY_CONFIRMED=SI
PRODUCTION_DEPLOYMENT_ID=bc4a94a9-8ee8-4ed8-8a41-e791b1911f16
PRODUCTION_COMMIT=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_DEPLOY_TIMELINE_EXACT_VARIABLE_TIMESTAMP=UNKNOWN_NOT_EXPOSED
COMMIT_PERFORMED_THIS_TASK=NO
PUSH_PERFORMED_THIS_TASK=NO
DEPLOY_PERFORMED_THIS_TASK=NO
PRODUCTION_ENV_CHANGED_BY_THIS_TASK=NO
```

Esta entrada registra la acción del operador y no constituye un deploy
ejecutado por Codex.

## P2-T31-COMMIT-TESTING-DEPLOY-IPHONE-MATRIX-CERTIFICATION — 2026-09-05

Se creó exactamente un commit sobre R1 con el bloque acumulado R2+R3+R5+R5A
y se pusheó únicamente a `testing-codex`. El autodeploy de Railway en
`DeliGO Copy`/`TESTING` quedó SUCCESS con el commit exacto; no se ejecutó
`railway up` ni redeploy manual.

```text
COMMIT_HASH=a8ac961bd81ee505297f81787c1cf32e3f4cd161
COMMIT_PARENT=989785a3cb1613bcda3a6c67f96472058bc876b0
COMMIT_MESSAGE=fix: harden web push subscription lifecycle
TESTING_DEPLOYMENT_ID=e18111b1-fc25-4697-8ec5-475067ad3ab1
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_COMMIT=a8ac961bd81ee505297f81787c1cf32e3f4cd161
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
TESTING_PUSH_RESULT=PASS
PRODUCTION_COMMIT=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PRODUCTION_TOUCHED=NO
IPHONE_PHYSICAL_CERTIFICATION_STATUS=PENDING_LEONARDO
```

La misma actualización del monorepo disparó autodeploys incidentales en
`chat en vivo` (`58e3ad81-7c2a-450a-ae4a-f18a0f7802f3`) y `Review Moderation
Expiry` (`8466f6de-6f75-4f9b-a228-97205b1fa06a`); ambos terminaron SUCCESS.
No se ejecutó ninguna acción manual sobre esos servicios ni sobre otros.

## DELIGO-CONTEXT-RECONCILIATION-2026-09-05 UPDATE — commits reales P2-T25→P2-T31 (gap desde 2026-08-30 cerrado)

Esta entrada reconcilia el vacío de historia real entre el último commit
registrado en este archivo (`c05525a5...`, era Production Sync, 2026-08-30)
y el estado actual real de `testing-codex`. Ninguna entrada anterior de este
archivo se reescribe — esto sólo agrega los commits reales que faltaban.

```
CHAIN_REAL_COMMITS_TESTING_CODEX (más nuevo primero, verificado con `git log`):

989785a3cb1613bcda3a6c67f96472058bc876b0  fix: sync push notification switch state
    (P2-T31-R1 — Cliente/Negocio/Repartidor switch-state fix. PUSHEADO y
    DESPLEGADO en TESTING — DeliGO Copy. Éste es el HEAD actual de
    origin/testing-codex, y el punto sobre el que R2/R3/R5/R5A siguen
    ACUMULADOS EN WORKING TREE SIN COMMIT.)

642da152cbc29fb8880ef4dc7bd3a7c6d6ca42f7  feat: complete superadmin in-app notifications
    (P2-T26-R2 — catálogo final de 6 triggers de notificación in-app para
    SuperAdmin. PUSHEADO y DESPLEGADO en TESTING.)

913d20e7f88375675b870e2adf9216fe56edcee0  test: certify order state lock ownership
    (P2-T28 — NO_BUG confirmado + test permanente de regresión. PUSHEADO y
    DESPLEGADO en TESTING.)

1b69ee878e540d537c1b3a14d79ad88ded8d16e9  fix: harden order creation abuse controls
    (P2-T25-R2 acumulado (R2+R2A+R2B+R2C) — rate limiting de 3 buckets +
    idempotency + lock de creación de pedido. PUSHEADO y DESPLEGADO en
    TESTING.)

f43705c...  fix: harden client pwa translucent status bar   (P2-T22B/R2, previo a P2-T25, ya en el log — sin cambios de esta reconciliación)
```

```
GIT_HEAD_AT_RECONCILIATION=989785a3cb1613bcda3a6c67f96472058bc876b0
ORIGIN_TESTING_CODEX_AT_RECONCILIATION=989785a3cb1613bcda3a6c67f96472058bc876b0
ORIGIN_MAIN_AT_RECONCILIATION=1de0d3c153eaf3be068adeb004ea43feb42fc40e (Production — SIN CAMBIO, no contiene T25/T26/T28/T31)
AHEAD_OF_ORIGIN_TESTING=0 (working tree tiene diff local sin commit, no commits ahead)
WORKING_TREE_TRACKED_DIFF=9 archivos modificados (P2-T31 R2+R3+R5+R5A acumulado, ver DECISIONS_AND_INVARIANTS.md/TEST_AUTHORITY.md para detalle) + 5 archivos nuevos untracked del mismo bloque
COMMIT_PERFORMED_THIS_RECONCILIATION=NO
PUSH_PERFORMED_THIS_RECONCILIATION=NO
DEPLOY_PERFORMED_THIS_RECONCILIATION=NO
```

Cada uno de los 4 commits reales arriba fue pusheado a `origin/testing-codex`
(nunca `origin/main`/Production) y confirmado desplegado con éxito en el
servicio "DeliGO Copy" de Railway (TESTING) desde metadata real de Railway
(`railway status --json`, commit hash exacto verificado), en su propia
tarea de certificación dedicada:

- `1b69ee8` → `codex-reports/P2_T25_R2_TESTING_DEPLOY_CERTIFICATION.md`
- `913d20e` → `codex-reports/P2_T28_TESTING_DEPLOY_CERTIFICATION.md`
- `642da15` → `codex-reports/P2_T26_TESTING_DEPLOY_CERTIFICATION.md`
- `989785a` → `codex-reports/P2_T31_TESTING_DEPLOY_PENDING_ANDROID_CERTIFICATION.md`

**El diff local acumulado de P2-T31-R2+R3+R5+R5A (posterior a `989785a`) NO
está commiteado, NO está pusheado, NO está desplegado** — existe únicamente
en el working tree de esta sesión. Ver `TEST_AUTHORITY.md` y
`DECISIONS_AND_INVARIANTS.md` (entradas 2026-09-05) para el detalle completo
de qué contiene ese diff. La próxima tarea prevista
(`P2-T31-COMMIT-TESTING-DEPLOY-IPHONE-MATRIX-CERTIFICATION`) es la que
crearía el commit real de ese bloque — no ejecutada todavía.

`origin/main` (Production) permanece exactamente en
`1de0d3c153eaf3be068adeb004ea43feb42fc40e` — ninguno de los 4 commits de
P2-T25/T26/T28/T31-R1, ni el diff local de R2/R3/R5/R5A, fueron promovidos a
Production en ningún momento de esta cadena.

## PRODUCTION-SYNC-R6-R0 UPDATE — 2026-08-30

No hubo mutación Git/Railway: 0 push, 0 code deploy, 0 restart y 0 creación
de servicio/scheduler. HEAD, `origin/main` y `origin/testing-codex` siguen en
`c05525a5e0419922a484fbe6cb25c8604b8ca313`. Production conserva DeliGO
`a3d7d7a4-3732-42d7-95b6-4ecbbeae6ca3` y chat
`94927d86-a16f-45cb-80b5-2637aace0a39`, ambos SUCCESS sobre ese commit.
Solo se creó un backup lógico fuera del repo y se inspeccionó Railway.

## PRODUCTION-SYNC-R5 UPDATE — 2026-08-29

La única mutación fue la migración de base de datos autorizada #27, aplicada
una vez con exit 0. No hubo Git push, movimiento de main, code deploy,
Railway restart, activación de `preDeployCommand` ni nuevo scheduler/cron.
HEAD, `origin/main` y `origin/testing-codex` siguen en
`c05525a5e0419922a484fbe6cb25c8604b8ca313`. Los deployments actuales siguen
siendo DeliGO `a3d7d7a4-3732-42d7-95b6-4ecbbeae6ca3` y chat
`94927d86-a16f-45cb-80b5-2637aace0a39`, ambos SUCCESS sobre ese commit.

## PRODUCTION-SYNC-R5-R0-R1 UPDATE — 2026-08-29

No hubo push, movimiento de main ni deployment. Git conserva HEAD, main y
testing-codex en `c05525a5e0419922a484fbe6cb25c8604b8ca313`.
Se creó y certificó un backup Production custom con tooling oficial
PostgreSQL 18.6 y restore scratch completo; DeliGO y chat conservan deployments
R4 exactos.

## PRODUCTION-SYNC-R5-R0 UPDATE — 2026-08-29

No hubo fetch con cambios, push, movimiento de main ni deployment. HEAD,
`origin/main` y `origin/testing-codex` permanecen en
`c05525a5e0419922a484fbe6cb25c8604b8ca313`. R5-R0 se bloqueó antes de crear
backup por falta de tooling PostgreSQL 18; no se usó el cliente PostgreSQL 12.

## PRODUCTION-SYNC-R4-R2-R2 UPDATE — 2026-08-29

No hubo push ni movimiento de main en esta tarea. Se verificó
`HEAD=origin/main=origin/testing-codex=c05525a5e0419922a484fbe6cb25c8604b8ca313`.
La fuente Production de chat quedó en `main` por acción manual del operador y
generó deployment `94927d86-a16f-45cb-80b5-2637aace0a39`, `SUCCESS`, commit
exacto. DeliGO continúa en `a3d7d7a4-3732-42d7-95b6-4ecbbeae6ca3`, `SUCCESS`,
mismo commit. No hubo deploy manual.

## PRODUCTION-SYNC-R4-R2-R1 UPDATE — 2026-08-29

El preflight confirmó `origin/main` como ancestro estricto de testing con
topología 0/241. Se ejecutó exactamente `git push origin testing-codex:main`
sin force push; ambos refs quedaron en
`c05525a5e0419922a484fbe6cb25c8604b8ca313`. DeliGO creó deployment
`a3d7d7a4-3732-42d7-95b6-4ecbbeae6ca3`, commit exacto, `SUCCESS`, logs sanos y
smoke HTTP 200. La fuente de chat no se mutó: branch `testing` permanece hasta
el cambio manual seguro a `main`; no hubo deployment manual.

## PRODUCTION-SYNC-R4-R2 UPDATE — 2026-08-29

`git fetch --all --prune` confirmó topología 0/241 y heads sin cambios. El
build local pasó, pero el pre-push gate se bloqueó porque la lectura viva de
Railway Production DeliGO no muestra las tres variables Cloudinary privadas
declaradas por el operador. No hubo push, deploy, movimiento de main ni
mutación de fuente.

## PRODUCTION-SYNC-R4-R1 UPDATE — 2026-08-29

Se ejecutó `git fetch --all --prune`; los heads conservaron
`HEAD=origin/testing-codex=c05525a5e0419922a484fbe6cb25c8604b8ca313` y
`origin/main=9d1be1835b3cb01bbfa3090fb3401890f1e90c59`, con topología 0/241 y
tracked/staged diffs vacíos. Se escribió sólo una variable Railway con
`--skip-deploys`; no hubo commit, push, movimiento de main, deploy, restart ni
fuente de chat mutada. Los tres secretos Cloudinary requieren acción manual.

## PRODUCTION-SYNC-R4 UPDATE — 2026-08-29

Se ejecutó únicamente `git fetch --all --prune` y lectura de metadata. El
fast-forward `origin/main` desde `9d1be1835b3cb01bbfa3090fb3401890f1e90c59`
hacia `c05525a5e0419922a484fbe6cb25c8604b8ca313` no se realizó. No hubo
commit, push, deploy, restart ni cambio de Railway; no existen deployment IDs
de R4.

## PRODUCTION-SYNC-R3-R3-R1 UPDATE — 2026-08-29

Production fue migrada hasta #26 mediante el bundle aislado. No hubo commit,
push, deploy, restart, movimiento de `main` ni activación de preDeploy; los
heads se conservaron sin cambios.

## PRODUCTION-SYNC-R3-R3 UPDATE — 2026-08-29

Se hizo `git fetch --prune origin` y se conservaron los heads observados. No
hubo commit, push, deploy, restart, activación de preDeploy ni escritura en
Production. El bloqueo ocurrió antes de ejecutar SQL; ver
`codex-reports/PRODUCTION_SYNC_R3_R3.md`.

## PRODUCTION-SYNC-R3-R2-R1 UPDATE — 2026-08-29

La certificación scratch no cambió Git ni Railway: heads conservados, tracked
worktree limpio, sin commit, push, deploy, backup ni operación sobre Production.

## PRODUCTION-SYNC-R3-R2 UPDATE — 2026-08-29

Fresh read-only preflight retained `HEAD=origin/testing-codex` at
`c05525a5e0419922a484fbe6cb25c8604b8ca313`, `origin/main` at
`9d1be1835b3cb01bbfa3090fb3401890f1e90c59`, and tracked worktree clean.
No commit, push, deploy, backup, or Production database operation occurred.

## PRODUCTION-SYNC-R3-R1 UPDATE — 2026-08-29

Fresh verification retained the same heads and a clean tracked worktree. No
Git mutation or Railway deploy occurred.

Historial compacto de commits y deploys relevantes. Fuente: `git log`
(autoridad primaria) cruzado contra el archive legacy. No copia logs
completos — ver `codex-reports/archive/` para evidencia extensa por etapa.

## Commits (más reciente primero, relevantes a P2-T05)

## PRODUCTION-SYNC-R3 UPDATE — 2026-08-29

`origin/main=9d1be1835b3cb01bbfa3090fb3401890f1e90c59` and
`origin/testing-codex=c05525a5e0419922a484fbe6cb25c8604b8ca313` remained
unchanged. No commit, push, merge, fast-forward, or Production deploy was
performed.

```
44b9da0  fix: prevent stale push subscription detach
  parent: e172cd7
  task: P2-T13-STAGE4 local commit; recertificado adversarialmente en
    P2-T13-STAGE5 sobre los blobs; PUBLICADO en P2-T13-STAGE6
  findings: Race-B (FIX_PUSHED_TESTING_DEPLOYED_REAL_POSTGRES_HTTP_CERTIFIED,
    no RESOLVED todavía — falta cierre adversarial final Stage 7)
  PUSH=SI — único fast-forward, exit 0, e172cd7..44b9da0
  DEPLOY: DeliGO Copy (d4a85699-50cf-471b-a203-25948fe0782a) SUCCESS;
    chat en vivo (62d0e66d-5317-4e78-b494-41b8de328a08) SUCCESS; ambos
    commit exacto 44b9da0, autodeploy git-triggered, sin mutación manual
  scope: allowlist exacta de 10 paths (5 callers productivos + repository +
    tests correspondientes), 0 schema/migration/package/reportes
  Stage 6: certificación runtime real — repository primitive contra
    PostgreSQL real de TESTING (sequential stale PASS, current detach PASS,
    10/10 rondas concurrentes FINAL_SIEMPRE_V2, cross-actor/channel/
    multi-device/register-sanity PASS, cleanup 0 remanentes) + flujo HTTP
    real autenticado vía /api/push/subscribe + /api/push/unsubscribe
    (subscribe V1/V2, stale unsubscribe preserva V2, current unsubscribe
    elimina V2, malformed fail-closed, owner/channel authority, cleanup 0
    remanentes). Sin WebPush real, sin fallback DATABASE_URL, sin 5xx/
    Prisma/fatal nuevos.
  Post-push: HEAD=origin=44b9da0, AHEAD=0, BEHIND=0
  Stage 7 (2026-08-26): cierre adversarial final, read-only — re-confirmó
    Git alineado (HEAD=origin=44b9da0, 0/0) y Railway TESTING sano
    (mismo deployment d4a85699..., sin redeploy). P2-T13 = CLOSED. Sin
    nueva acción Git/Railway.
  NEXT: P2-T12 (TerminalOperativa.pushSubscription Cleanup) — no ejecutado

e172cd7  test: stabilize shared auth mocks
  parent: 9394b60
  task: H4/F22 correction local amend
  amended locally from f5571f1; f5571f1 was never pushed or deployed
  findings: F22 (RESOLVED_H4_AMENDED_AND_POSTAMEND_CERTIFIED)
  PUSH=NO DEPLOY=NO — origin/testing-codex remains at 9394b60
  scope: exact H4 allowlist of 8 test-infrastructure paths, 0 production files
  POSTAMEND_RECERTIFICATION=PASS — 7 focales 124/124; autoridad literal 34
  archivos 523/523 en aislado, combinado normal y combinado reverso

f5571f1  test: stabilize shared auth mocks
  superseded locally by e172cd7; historical object, no longer branch tip
  parent: 9394b60
  task: H4
  findings: F22 (LOCAL_COMMIT_COMPLETE_AWAITING_POSTCOMMIT_PREPUSH_REVIEW, no RESOLVED todavía)
  PUSH=NO DEPLOY=NO — commit exclusivamente LOCAL, origin/testing-codex sigue en 9394b60
  scope: test-infrastructure only (7 tests migrados + 1 helper nuevo), 0 archivos productivos
  bytes verificados hash-idénticos a los certificados en la revisión pre-commit inmediatamente anterior

9394b60  fix: reconcile personal push ui state
  parent: 47a630e
  task: H3B (F-P2-T05-23, F-P2-T05-15)
  findings resueltos: F23 (root cause de F18), F15
  push: SI (origin/testing-codex, un único intento, exitoso)
  TESTING deployment: DeliGO Copy + chat en vivo, ambos SUCCESS al commit exacto
  runtime certification: real Chrome externo (headless, perfil aislado, CDP) —
    first-enable/disable/re-enable consistentes sin reload, SERVER_DETACH_ONLY
    confirmado en runtime real

47a630e  perf: batch push fanout and bound concurrency
  parent: c66df8d
  task: H2
  findings resueltos: F21
  push: SI, TESTING deploy PASS (H1+H2 checkpoint conjunto)

c66df8d  fix: harden push fanout channel and key handling
  parent: 6dfb539
  task: H1
  findings resueltos: F19, F20
  push: SI, TESTING deploy PASS (H1+H2 checkpoint conjunto)

6dfb539  feat: fan out push notifications across devices
  task: Stage3E (push previo al hardening H1-H4)
  push: SI, TESTING deploy + smoke PASS

20209f5  fix: harden push subscription input and detach
  task: Stage3 series

f544b29  feat: integrate normalized multi-device push subscriptions
  task: Stage3 (commit original, matches f544b291d4eafef87cede748701f0cfe13d6247f
  en referencias históricas)

b05b4ff  feat: add normalized push subscription model
  task: pre-Stage3 (modelo base de subscripciones normalizadas)
```

## Estado histórico previo al final testing checkpoint

```
BRANCH=testing-codex
HEAD=e172cd7ac8245d32db89f96cf6c86ca31bb43cf2
ORIGIN/testing-codex=9394b605611deb4f10b8028a41a8bd19f7687314
AHEAD=1 BEHIND=0 (al momento de escribir este registro — reverificar siempre)
```

## Estado actual tras P2-T13-STAGE6 (post-push) — 2026-08-26

```
BRANCH=testing-codex
HEAD=44b9da06ff2fa099cf7eb5fb971b13454f33f308
ORIGIN/testing-codex=44b9da06ff2fa099cf7eb5fb971b13454f33f308
AHEAD=0 BEHIND=0 — reverificar siempre antes de cualquier acción
```

## Railway TESTING — topología conocida

```
PROJECT=amiable-rejoicing
ENVIRONMENT=TESTING (id f37d0c49-b737-49e8-be89-a00c13734fae)
LINKED_SERVICE=DeliGO Copy

Servicios que auto-despliegan desde push a `testing-codex`:
- DeliGO Copy (app Next.js principal) — dominio: deligo-copy-production.up.railway.app
- chat en vivo — dominio: chat-en-vivo-testing.up.railway.app
- DeliGO Mesa Occupancy Cron (cron, mismo repo/branch)
- Review Moderation Expiry (cron, mismo repo/branch)

Smoke esperado (histórico, no forzar si cambia legítimamente):
- DeliGO Copy: / -> 307 -> 200; /cliente/ -> 308 -> 200
- chat en vivo: / -> 200; /health -> 200
```

Un environment `production` separado existe en el mismo proyecto — NUNCA
es el target de ninguna operación de este workstream.

## P2-T05-FINAL-TESTING-CHECKPOINT — 2026-08-26

```
task: P2-T05-FINAL-TESTING-CHECKPOINT
branch: testing-codex
project: amiable-rejoicing
environment: TESTING
pre_push_head: e172cd7ac8245d32db89f96cf6c86ca31bb43cf2
pre_push_origin: 9394b605611deb4f10b8028a41a8bd19f7687314
push: SI — un único fast-forward, exit code 0
pushed_commit: e172cd7ac8245d32db89f96cf6c86ca31bb43cf2
post_push_head: e172cd7ac8245d32db89f96cf6c86ca31bb43cf2
post_push_origin: e172cd7ac8245d32db89f96cf6c86ca31bb43cf2
post_push_ahead_behind: 0 0

DeliGO Copy:
  deployment: c3cfa6ca-d953-4521-9338-7d61ac965097
  status: SUCCESS
  commit: e172cd7ac8245d32db89f96cf6c86ca31bb43cf2 (exact match)
chat en vivo:
  deployment: e24e1eea-5919-404e-b22a-b4c974bd158b
  status: SUCCESS
  commit: e172cd7ac8245d32db89f96cf6c86ca31bb43cf2 (exact match)

deployment_logs_fatal_or_startup_errors: NO
redeploy_loop: NO
http_smoke: PASS (Copy /, /login, /repartidor = 200; chat /health = 200)
manual_railway_mutation: NO
git_triggered_autodeploy: SI
production: NO
db_read_write: NO
final_closeout: PASS
next_task: P2-T05-FINAL-CLOSEOUT
```

## P2-T12-STAGE4C — Phase1 local commit — 2026-08-26

```
task: P2-T12-STAGE4C
branch: testing-codex
commit: bebd36c841f588fc9e4c74099e38a95d37d58982
parent: 44b9da06ff2fa099cf7eb5fb971b13454f33f308
subject: chore: remove dead terminal push field
commit_file_count: 1
commit_path: prisma/schema.prisma
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_read_write: NO
next_task: P2-T12-STAGE4D
```

## P2-T12-STAGE4D — Phase1 post-commit/pre-push review — 2026-08-26

```
task: P2-T12-STAGE4D
phase1_commit: bebd36c841f588fc9e4c74099e38a95d37d58982
parent: 44b9da06ff2fa099cf7eb5fb971b13454f33f308
subject: chore: remove dead terminal push field
commit_file_count: 1
commit_path: prisma/schema.prisma
postcommit_review: PASS
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_read_write: NO
next_task: P2-T12-STAGE4E
```

## P2-T12-STAGE4E — Phase1 exact push + TESTING deploy — 2026-08-26

```
task: P2-T12-STAGE4E
branch: testing-codex
commit: bebd36c841f588fc9e4c74099e38a95d37d58982
parent: 44b9da06ff2fa099cf7eb5fb971b13454f33f308
subject: chore: remove dead terminal push field
push: EXACTLY_ONCE
push_result: PASS
remote: origin/testing-codex
railway_project: amiable-rejoicing
railway_environment: TESTING
service: DeliGO Copy
deployment_id: 70ebc186-bd51-4afb-bb3f-3a6ae8013dcd
deployment_status: SUCCESS
deployment_commit_exact: SI
old_instance: REMOVED
current_instance: RUNNING
chat_service: chat en vivo
chat_deployment_id: 44d58165-5102-4697-8a5f-f3449061bc92
chat_deployment_status: SUCCESS
git_triggered_autodeploy: SI
manual_redeploy: NO
railway_mutation: NO
production: NO
t12_drop_applied: NO
physical_column_post: SI
terminal_runtime_smoke: PASS
fixture_cleanup: PASS
http_smoke: PASS
db_url_required_variable_value_printed: NO
database_url_fallback: NO
db_real_write: SI_ONLY_ISOLATED_TEST_FIXTURES
final_closeout: PASS
next_task: P2-T12-STAGE5A
```

## P2-T12-STAGE5A — Phase2 local migration recreation — 2026-08-26

```
task: P2-T12-STAGE5A
branch: testing-codex
phase1_commit: bebd36c841f588fc9e4c74099e38a95d37d58982
new_local_artifact: prisma/migrations/20260826230000_drop_terminal_operativa_push_subscription/migration.sql
new_local_artifact_sha256: cbd4a4684aceb41895f3d0b47335147c5470c80a90d2c434ecf51bf0ca43623d
new_local_artifact_statement_count: 1
commit: NO
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_read_write: NO
schema_ts_test_mutation: NO
next_task: P2-T12-STAGE5B
```

## P2-T12-STAGE5C — Phase2 exact local commit — 2026-08-26

```
task: P2-T12-STAGE5C
branch: testing-codex
commit: 7822d84ac5ac841978a77ebef76ad93630b69f42
parent: bebd36c841f588fc9e4c74099e38a95d37d58982
subject: chore: remove dead terminal push column
commit_file_count: 1
commit_path: prisma/migrations/20260826230000_drop_terminal_operativa_push_subscription/migration.sql
committed_blob: 52501817c39ba4c3979ba0f77c687cd518c298ef
committed_blob_size: 2134
origin_testing_codex: bebd36c841f588fc9e4c74099e38a95d37d58982
ahead: 1
behind: 0
tracked_worktree_clean: SI
index_empty: SI
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_read_write: NO
migration_applied: NO
next_task: P2-T12-STAGE5D
```

## P2-T12-STAGE5D — Phase2 post-commit/pre-push review — 2026-08-26

```
task: P2-T12-STAGE5D
branch: testing-codex
phase2_commit: 7822d84ac5ac841978a77ebef76ad93630b69f42
phase1_commit: bebd36c841f588fc9e4c74099e38a95d37d58982
PHASE2_COMMIT=7822d84ac5ac841978a77ebef76ad93630b69f42
PARENT=bebd36c841f588fc9e4c74099e38a95d37d58982
origin_testing_codex: bebd36c841f588fc9e4c74099e38a95d37d58982
ahead: 1
behind: 0
commit_file_count: 1
committed_blob: 52501817c39ba4c3979ba0f77c687cd518c298ef
committed_bytes: 2134
committed_sha256: cbd4a4684aceb41895f3d0b47335147c5470c80a90d2c434ecf51bf0ca43623d
postcommit_review: PASS
push: NO
deploy: NO
db_change: NO
MIGRATION_APPLIED=NO
railway_mutation: NO
production: NO
next_task: P2-T12-STAGE5E
```

## P2-T12-STAGE5E — Phase2 exact push / TESTING DROP / runtime — 2026-08-26

```
task: P2-T12-STAGE5E
branch: testing-codex
phase1_commit: bebd36c841f588fc9e4c74099e38a95d37d58982
phase2_commit: 7822d84ac5ac841978a77ebef76ad93630b69f42
origin_testing_codex: 7822d84ac5ac841978a77ebef76ad93630b69f42
ahead: 0
behind: 0
push: EXACTLY_ONCE
push_result: PASS_FAST_FORWARD
remote: origin/testing-codex
railway_project: amiable-rejoicing
railway_environment: TESTING
service: DeliGO Copy
deployment_id: cf5cca9a-e5f3-4a35-8b56-d6b90ec0c2b9
deployment_status: SUCCESS
deployment_commit_exact: SI
predeploy_exact_migration_applied: SI
old_phase1_deployment: 70ebc186-bd51-4afb-bb3f-3a6ae8013dcd
old_phase1_status: REMOVED
git_triggered_autodeploy: SI
manual_redeploy: NO
railway_mutation: NO
production: NO
t12_drop_applied: SI_TESTING_ONLY
physical_column_post: NO
terminal_runtime_smoke: PASS
replay_400: SI
revoked_context_401: SI
fixture_cleanup: PASS
fixture_rows_remaining: 0
terminal_push_side_effect: NO
webpush: NO
db_url_required_variable_value_printed: NO
database_url_fallback: NO
db_real_write: SI_ONLY_ISOLATED_TEST_FIXTURES
next_task: P2-T12-STAGE5F
```

## P2-T12-STAGE5F — final closeout — 2026-08-26

```
task: P2-T12-STAGE5F
phase1_commit: bebd36c841f588fc9e4c74099e38a95d37d58982
phase2_commit: 7822d84ac5ac841978a77ebef76ad93630b69f42
origin_testing_codex: 7822d84ac5ac841978a77ebef76ad93630b69f42
branch: testing-codex
ahead: 0
behind: 0
tracked_worktree_clean: SI
index_empty: SI
railway_project: amiable-rejoicing
railway_environment: TESTING
service: DeliGO Copy
active_commit: 7822d84ac5ac841978a77ebef76ad93630b69f42
active_deployment: cf5cca9a-e5f3-4a35-8b56-d6b90ec0c2b9
active_deployment_status: SUCCESS
old_phase1_state: REMOVED
chat_health: PASS
http_health: PASS
t12_history_count: 1
t12_successful_count: 1
pending_migrations: 0
failed_migrations: 0
physical_column: ABSENT
finding_f_p0_05: RESOLVED
p2_t12: CLOSED
new_commit: NO
amend: NO
push: NO
deploy: NO
railway_config_mutation: NO
production: NO
next_task: P2-T11 — Native Socket Post-Logout TTL Hardening
```

## P2-T11-STAGE1B — design freeze, sin acción Git — 2026-08-26

```
task: P2-T11-STAGE1B
branch: testing-codex
head_pre: 7822d84ac5ac841978a77ebef76ad93630b69f42
head_post: 7822d84ac5ac841978a77ebef76ad93630b69f42
origin_testing_codex: 7822d84ac5ac841978a77ebef76ad93630b69f42
ahead: 0
behind: 0
tracked_worktree_clean: SI
index_empty: SI
new_commit: NO
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO
next_task: P2-T11-STAGE2 (no ejecutado)
```

Tarea exclusivamente de diseño (READ/AUDIT/DESIGN-FREEZE-ONLY). El único
cambio de estado fue documental (`codex-reports/**`, `CODEX_REPORT.md`),
nunca en git/schema/source/tests. HEAD y origin permanecen idénticos al
cierre de P2-T12-STAGE5F.

## P2-T11-STAGE1B-R1 — reconciliación de vida de socket, sin acción Git — 2026-08-26

```
task: P2-T11-STAGE1B-R1
branch: testing-codex
head_pre: 7822d84ac5ac841978a77ebef76ad93630b69f42
head_post: 7822d84ac5ac841978a77ebef76ad93630b69f42
origin_testing_codex: 7822d84ac5ac841978a77ebef76ad93630b69f42
ahead: 0
behind: 0
tracked_worktree_clean: SI
index_empty: SI
new_commit: NO
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO
existing_test_executed_read_only: mini-services/chat-service/test/security.test.js (12 pass / 0 fail, sin modificar el archivo)
next_task: P2-T11-STAGE2 (no ejecutado)
```

Tarea exclusivamente de diseño/verificación (READ/AUDIT/DESIGN-
CORRECTION-ONLY). La única acción que tocó el sistema de archivos, además
de los reportes untracked, fue ejecutar un test ya existente
(`node --test`) para confirmar en runtime real un mecanismo ya presente
en el código — sin modificar ese ni ningún otro archivo tracked. HEAD y
origin permanecen idénticos al cierre de P2-T12-STAGE5F.

## P2-T11-STAGE2 — contrato de implementación congelado, sin acción Git — 2026-08-26

```
task: P2-T11-STAGE2
branch: testing-codex
head_pre: 7822d84ac5ac841978a77ebef76ad93630b69f42
head_post: 7822d84ac5ac841978a77ebef76ad93630b69f42
origin_testing_codex: 7822d84ac5ac841978a77ebef76ad93630b69f42
ahead: 0
behind: 0
tracked_worktree_clean: SI
index_empty: SI
new_commit: NO
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO
next_task: P2-T11-STAGE3A (no ejecutado)
```

Tarea exclusivamente de planificación (READ/AUDIT/TEST-PLANNING-ONLY).
Ninguna acción tocó git/schema/source/tests reales — sólo lectura de
código existente para congelar el contrato exacto de implementación
(allowlist por fase, contrato HTTP interno, env vars nuevas propuestas,
matrices de compatibilidad/rollback). HEAD y origin permanecen idénticos
al cierre de P2-T11-STAGE1B-R1.

## P2-T11-STAGE3A — Phase A local implementation, sin commit/push/deploy — 2026-08-26

```
task: P2-T11-STAGE3A
branch: testing-codex
head: 7822d84ac5ac841978a77ebef76ad93630b69f42
origin_testing_codex: 7822d84ac5ac841978a77ebef76ad93630b69f42
ahead: 0
behind: 0
tracked_worktree_diff: src/lib/auth.ts (modify, 13 líneas agregadas)
new_untracked_product_files: src/lib/internal-session-check-auth.ts, src/app/api/internal/realtime/session/route.ts, src/app/api/internal/realtime/session/route.test.ts
index_empty: SI (nada staged)
new_commit: NO
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO
future_commit_allowlist_file_count: 4
next_task: P2-T11-STAGE3B (no ejecutado)
```

Implementación local real de Phase A (endpoint interno + helper de
sesión + verificación HMAC dedicada + tests). `mini-services/**` sin
cambios (chat-service no depende todavía del endpoint). Ningún archivo
fuera del allowlist de Phase A fue tocado; un artefacto incidental
(`tsconfig.tsbuildinfo`, generado por la ejecución local de `tsc`) fue
detectado y eliminado antes del chequeo final de git. HEAD y origin
permanecen idénticos al cierre de P2-T11-STAGE2.

## P2-T11-STAGE3B — Phase A pre-commit adversarial review, sin acción Git — 2026-08-26

```
task: P2-T11-STAGE3B
branch: testing-codex
head: 7822d84ac5ac841978a77ebef76ad93630b69f42
origin_testing_codex: 7822d84ac5ac841978a77ebef76ad93630b69f42
ahead: 0
behind: 0
tracked_worktree_diff: src/lib/auth.ts (sin cambio respecto de Stage3A)
new_untracked_product_files: src/lib/internal-session-check-auth.ts, src/app/api/internal/realtime/session/route.ts, src/app/api/internal/realtime/session/route.test.ts (sin cambio respecto de Stage3A)
index_empty: SI
new_commit: NO
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO
temporary_adversarial_script_used: SI (creado y eliminado dentro de esta misma tarea, nunca stageado ni commiteado, verificado por git status limpio tras el borrado)
next_task: P2-T11-STAGE3C (no ejecutado)
```

Ninguna modificación de producto/test — sólo lectura, re-ejecución de
gates existentes y un script de verificación temporal fuera de commit.
HEAD y origin permanecen idénticos al cierre de P2-T11-STAGE3A.

## P2-T11-STAGE3C — Phase A exact local commit — 2026-08-26

```
task: P2-T11-STAGE3C
branch: testing-codex
commit: d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
parent: 7822d84ac5ac841978a77ebef76ad93630b69f42
subject: feat: add internal realtime session validation endpoint
commit_file_count: 4
commit_paths: src/app/api/internal/realtime/session/route.test.ts (new), src/app/api/internal/realtime/session/route.ts (new), src/lib/auth.ts (modify), src/lib/internal-session-check-auth.ts (new)
origin_testing_codex: 7822d84ac5ac841978a77ebef76ad93630b69f42
ahead: 1
behind: 0
tracked_worktree_clean: SI
index_empty: SI
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO
next_task: P2-T11-STAGE3D
```

Único commit local de Phase A, precedido por: preflight fresco, hashes
de los 4 archivos reconfirmados sin mutación desde Stage3B, snapshot de
invariantes (TTL/cross-tab/chat-service/secreto dedicado), focal test
14/14 re-ejecutado, stage exacto por paths explícitos (nunca `-A`/`.`),
auditoría inmediata del índice, y lectura directa del contenido staged
antes de commitear. Post-commit: lectura directa de los blobs del commit
(`git show HEAD:<path>`) confirmando contenido idéntico y ausencia de
reportes/`32`/schema/migration/package/chat-service/Phase C dentro del
commit. Exactamente un intento de commit, exit 0, sin amend. Origin no
cambió durante la tarea. Sin push.

## P2-T11-STAGE3D — Phase A post-commit/pre-push exact-blob review, sin acción Git — 2026-08-26

```
task: P2-T11-STAGE3D
branch: testing-codex
head: d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
head_parent: 7822d84ac5ac841978a77ebef76ad93630b69f42
tree_hash: 2beb452fb73bcf0e7aa0817b86b41d56e2fc6d9a
origin_testing_codex: 7822d84ac5ac841978a77ebef76ad93630b69f42
ahead: 1
behind: 0
tracked_worktree_clean: SI
index_empty: SI
new_commit: NO
amend: NO
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO
blob_ids_derived: SI (git ls-tree HEAD)
temporary_adversarial_script_reused: SI (copiado brevemente al repo, ejecutado, eliminado de inmediato, verificado limpio)
next_task: P2-T11-STAGE3E (no ejecutado)
```

Recertificación completa del commit ya existente, directamente desde los
objetos Git (`git show HEAD:<path>`, `git ls-tree HEAD`, `git grep ...
HEAD`) — nunca desde el working tree como sustituto de autoridad.
Ninguna modificación de producto/test. Origin no cambió. HEAD y origin
permanecen idénticos al cierre de P2-T11-STAGE3C.

## P2-T11-STAGE3E — Phase A TESTING push + Git-triggered autodeploy — 2026-08-27

```
task: P2-T11-STAGE3E
branch: testing-codex
head_before: d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
origin_before: 7822d84ac5ac841978a77ebef76ad93630b69f42
push_attempt_count: 1
push_exit_code: 0
push_result: 7822d84..d0ba59d testing-codex -> testing-codex
head_after: d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
origin_after: d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
ahead: 0
behind: 0
deliGO_copy_deployment_id: 2b86f710-2c73-4423-ac28-2e850b0a8f6a
deliGO_copy_deployment_status: SUCCESS
chat_deployment_id: cfabdb62-2c4d-461c-9a0f-223bdaac7cb8
chat_deployment_status: SUCCESS
railway_project: amiable-rejoicing
railway_environment: TESTING
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO
next_task: P2-T11-STAGE4A
```

Único push normal a `origin/testing-codex`, observado exclusivamente vía
autodeploy Git-triggered (sin `railway up`/redeploy manual) con polling
finito: `DeliGO Copy` `BUILDING`→`DEPLOYING`→`SUCCESS`; `chat en vivo`
autodeployó el mismo commit y quedó sano. Logs sin errores nuevos, sin
migration nueva. HTTP health normal PASS. Endpoint interno nuevo
desplegado y fail-closed ante un probe seguro no autenticado (503). Sin
mutación de Railway, sin DB real, Production intacta.

## P2-T11-STAGE4A — Phase B local implementation, sin acción Git — 2026-08-27

```
task: P2-T11-STAGE4A
branch: testing-codex
head: d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
origin_testing_codex: d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
ahead: 0
behind: 0
tracked_worktree_diff: 5 archivos Phase B (3 modificados + 2 nuevos untracked)
new_commit: NO
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO
next_task: P2-T11-STAGE4B
```

Implementación local de Phase B en el working tree, sin ninguna acción
Git más allá de lectura. Sin commit/push/deploy en esta tarea.

## P2-T11-STAGE4B — Phase B pre-commit adversarial review, sin acción Git — 2026-08-27

```
task: P2-T11-STAGE4B
branch: testing-codex
head: d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
origin_testing_codex: d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
ahead: 0
behind: 0
tracked_worktree_diff: mismos 5 archivos Phase B, sin mutación desde Stage4A
new_commit: NO
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO
adversarial_temp_script: fuera del repo (scratchpad), eliminado al terminar
next_task: P2-T11-STAGE4C
```

Auditoría adversarial pura, sin modificar producto/test/Git. Confirmó
cero mutación desde el cierre de Stage4A.

## P2-T11-STAGE4C — Phase B exact local commit — 2026-08-27

```
task: P2-T11-STAGE4C
branch: testing-codex
head_before: d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
origin_before: d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
commit_attempt_count: 1
commit_exit_code: 0
commit_hash: e8d217112b1cfd6af311dda70ad2880ea8be295c
commit_parent: d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
commit_subject: feat: enforce connect-time session validation in chat service
commit_file_count: 5
head_after: e8d217112b1cfd6af311dda70ad2880ea8be295c
origin_after: d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
ahead: 1
behind: 0
tracked_worktree_clean: SI
index_empty: SI
new_commit: SI
amend: NO
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO
next_task: P2-T11-STAGE4D
```

Stage exacto por paths explícitos (`git add -- <5 paths>`, nunca
`-A`/`.`), auditoría inmediata del índice, lectura directa del contenido
staged y committed (`git show :<path>` / `git show HEAD:<path>`), y
verificación de que `staged == worktree` antes de commitear. Un único
`git commit`, exit 0, sin amend, sin segundo intento. Blobs del commit
leídos íntegros, confirmando ausencia de reportes/`32`/Phase A/schema/
package/Phase C. `AHEAD=1`/`BEHIND=0` respecto de `origin/testing-codex`,
que no cambió. Sin push.

## P2-T11-STAGE4E — TESTING secret provisioning (Railway config mutation, no Git action) — 2026-08-27

```
task: P2-T11-STAGE4E
branch: testing-codex
head: e8d217112b1cfd6af311dda70ad2880ea8be295c
origin_testing_codex: e8d217112b1cfd6af311dda70ad2880ea8be295c → unchanged (still d0ba59d ancestor topology, HEAD unchanged)
ahead: 1
behind: 0
railway_project: amiable-rejoicing
railway_environment: TESTING
railway_mutation: SI (env vars only, no schema/code)
  - REALTIME_SESSION_CHECK_SECRET set on DeliGO Copy (service c6335604-063a-4a10-9c82-b0acb9e8ca7a) — value never logged
  - REALTIME_SESSION_CHECK_SECRET set on chat en vivo — same in-memory value, never logged
  - DELIGO_MONOLITH_INTERNAL_URL=https://deligo-copy-production.up.railway.app set on chat en vivo (non-secret)
resulting_auto_deploys:
  - DeliGO Copy: 16048d9b-e487-43de-aa80-60c5957c1e39 (SUCCESS, config-triggered, same source/commit — no code change)
  - chat en vivo: 3f93511e-dba6-4ba6-9ada-6e580982b47c (SUCCESS, config-triggered, same source/commit — no code change)
authenticated_synthetic_roundtrip: PASS (200 {"valid":false})
bad_hmac_runtime: PASS (401)
stale_timestamp_runtime: PASS (401)
new_commit: NO
amend: NO
push: NO
production: NO
db_real_read: NO
db_real_write: NO
next_task: P2-T11-STAGE4F
```

Ninguna acción Git en esta tarea (HEAD sin cambio, sin commit). La
mutación fue exclusivamente configuración de Railway TESTING (dos
variables de entorno en dos servicios), con dos redeploys automáticos
resultantes del propio cambio de config — nunca un deploy manual de
código nuevo, y nunca el commit Phase B (`e8d2171`, que permanece sin
push). Dos acciones (`variable delete` de una prueba no sensible, y
`redeploy`) fueron bloqueadas por el clasificador de permisos del
harness y requirieron aprobación explícita del usuario antes de
ejecutarse.

## P2-T11-STAGE4F — Phase B TESTING push + Git-triggered autodeploy + runtime revocation certification — 2026-08-27

```
task: P2-T11-STAGE4F
branch: testing-codex
head_before: e8d217112b1cfd6af311dda70ad2880ea8be295c
origin_before: d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
push_attempt_count: 1
push_exit_code: 0
push_result: d0ba59d..e8d2171 testing-codex -> testing-codex
head_after: e8d217112b1cfd6af311dda70ad2880ea8be295c
origin_after: e8d217112b1cfd6af311dda70ad2880ea8be295c
ahead: 0
behind: 0
chat_deployment_id: 96f0b0a8-72a9-4bd9-bb09-09bf31670cc0
chat_deployment_status: SUCCESS
chat_deployment_commit: e8d217112b1cfd6af311dda70ad2880ea8be295c
deligo_copy_deployment_id: ad726236-895a-4212-9436-1f441ce70d13
deligo_copy_deployment_status: SUCCESS
deligo_copy_deployment_commit: e8d217112b1cfd6af311dda70ad2880ea8be295c
railway_project: amiable-rejoicing
railway_environment: TESTING
railway_mutation: NO
db_real_read: SI (2 filas de fixture TESTING vía DELIGO_TEST_DATABASE_URL, prefijo P2T11_STAGE4F_)
db_real_write: SI (mismas 2 filas, creadas y eliminadas en esta tarea, 0 remanentes)
runtime_active_connect: PASS
runtime_active_reconnect: PASS
runtime_logout: PASS (POST /api/auth/logout real)
runtime_prelogout_actor_fresh_connect_after_logout: REJECTED (TOKEN_INVALID, SESSION_INVALID reason=inactive)
runtime_reject_latency_ms: 1126
runtime_independent_session_b: PASS
runtime_existing_socket_bound_model: JWT_EXPIRY (sin revocación distribuida instantánea, comportamiento esperado)
production: NO
next_task: P2-T11-STAGE5A
```

Único push normal, observado exclusivamente vía autodeploy Git-triggered
(sin `railway up`/redeploy manual) con polling finito: ambos servicios
`BUILDING`→(`DeliGO Copy` también `DEPLOYING`)→`SUCCESS` en el commit
exacto. Certificación runtime completa contra la base de datos real de
TESTING usando fixtures aisladas creadas y eliminadas en la misma tarea
(aprobado explícitamente por el usuario tras ser bloqueado por el
clasificador de permisos del harness). Sin mutación de Railway config
en esta tarea (esa fue Stage4E). Production intacta.

## P2-T11-STAGE5E — Phase C TESTING push + Git-triggered autodeploy + server-runtime certification — 2026-08-27

```
task: P2-T11-STAGE5E
branch: testing-codex
head_before: f6ca24f78a4359fdf66e213b1a449a49426c1234
origin_before: e8d217112b1cfd6af311dda70ad2880ea8be295c
push_attempt_count: 1
push_exit_code: 0
push_result: e8d2171..f6ca24f testing-codex -> testing-codex
head_after: f6ca24f78a4359fdf66e213b1a449a49426c1234
origin_after: f6ca24f78a4359fdf66e213b1a449a49426c1234
ahead: 0
behind: 0
chat_deployment_id: b2f28db3-2cba-41e2-8d4b-0bb9353d4718
chat_deployment_status: SUCCESS
chat_deployment_commit: f6ca24f78a4359fdf66e213b1a449a49426c1234
deligo_copy_deployment_id: 7ccb9998-60a5-4fe9-bf89-2ca03922cc12
deligo_copy_deployment_status: SUCCESS
deligo_copy_deployment_commit: f6ca24f78a4359fdf66e213b1a449a49426c1234
railway_project: amiable-rejoicing
railway_environment: TESTING
railway_mutation: NO
db_real_read: SI (2 filas de fixture TESTING vía DELIGO_TEST_DATABASE_URL, prefijo P2T11_STAGE5E_)
db_real_write: SI (mismas 2 filas, creadas y eliminadas en esta tarea, 0 remanentes)
runtime_deployed_actor_ttl_seconds: 120 (exp - iat medido sobre JWT real emitido por el servidor desplegado)
runtime_deployed_token_metadata_match: SI
runtime_active_connect: PASS
runtime_active_reconnect: PASS
runtime_existing_socket_expiry: PASS (desconexión real a ~119.9s, reason=server namespace disconnect, socket_disconnected reason=server namespace disconnect en el log del chat-service)
runtime_logout: PASS (POST /api/auth/logout real)
runtime_prelogout_actor_fresh_connect_after_logout: REJECTED (TOKEN_INVALID, SESSION_INVALID reason=inactive)
runtime_reject_latency_ms: 1226
runtime_independent_session_b: PASS
runtime_existing_socket_bound_model: JWT_EXPIRY_120S (TTL de 120s confirmado en runtime, ya no 300s)
production: NO
next_task: P2-T11-STAGE5F
```

Único push normal, observado exclusivamente vía autodeploy Git-triggered
(sin `railway up`/redeploy manual) con polling finito: ambos servicios
`Building`→`Deploying`→`Online`, confirmados en el commit exacto
`f6ca24f` por la metadata de despliegue de Railway (`commitHash`, no por
inferencia del éxito del push). `chat en vivo` también autodeployó a
`f6ca24f` pese a que sus archivos productivos no cambiaron (comportamiento
aceptado por el contrato de esta etapa). Certificación runtime completa
contra el servidor real de TESTING, usando fixtures aisladas creadas y
eliminadas en la misma tarea (aprobado explícitamente por el usuario tras
ser bloqueado por el clasificador de permisos del harness, igual que en
Stage4F): el TTL del actor JWT desplegado es 120s exacto (ya no 300s), un
socket existente se desconectó realmente al llegar a ese límite, y la
revocación server-side de Phase B tras logout sigue funcionando sin
regresión. Sin mutación de Railway config en esta tarea. Production
intacta. Cross-tab queda desplegada como código, sin certificación real
de navegador todavía (eso es Stage5F).

## P2-T11-STAGE5F — Phase C real same-origin browser certification, sin acción Git — 2026-08-27

```
task: P2-T11-STAGE5F
branch: testing-codex
head: f6ca24f78a4359fdf66e213b1a449a49426c1234
origin_testing_codex: f6ca24f78a4359fdf66e213b1a449a49426c1234
ahead: 0
behind: 0
tracked_worktree_clean: SI
index_empty: SI
new_commit: NO
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: SI (1 fila fixture TESTING vía DELIGO_TEST_DATABASE_URL, prefijo P2T11_STAGE5F, aprobado explícitamente por el usuario)
db_real_write: SI (misma fila, creada y eliminada en esta tarea, 0 remanentes)
next_task: P2-T11-STAGE5G
```

Certificación con navegador Chromium real (Claude Browser pane, CDP, ya
disponible — nada instalado). Ninguna acción Git más allá de lectura;
HEAD y origin permanecen idénticos al cierre de Stage5E.

## P2-T11-STAGE5G — final closeout / finding disposition, sin acción Git — 2026-08-27

```
task: P2-T11-STAGE5G
branch: testing-codex
head: f6ca24f78a4359fdf66e213b1a449a49426c1234
origin_testing_codex: f6ca24f78a4359fdf66e213b1a449a49426c1234
ahead: 0
behind: 0
tracked_worktree_clean: SI
index_empty: SI
new_commit: NO
amend: NO
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO
new_fixture: NO
schema_change: NO
migration_change: NO
package_lockfile_change: NO
F_P2_T11_01_STATUS: RESOLVED
P2_T11: CLOSED
next_task: P2-T18-STAGE1 (Chat Cross-Tab UI Polish) — no ejecutada
```

Cierre final read/audit/report-only. Reconfirmó la topología final de
Git directamente desde los objetos (`git fetch`, `git rev-parse`,
`git rev-list --left-right --count`, `git show -s --format=...`) — el
mismo commit `f6ca24f` certificado desde Stage5C sigue siendo tanto
`HEAD` como `origin/testing-codex`, sin ningún drift a lo largo de todo
P2-T11. Ninguna acción de Git, Railway o DB real en esta etapa — sólo
lectura y reconciliación de los seis registros canónicos más
`CODEX_REPORT.md`. P2-T11 completó su historial Git con exactamente tres
push (Phase A, Phase B, Phase C) y una mutación de configuración de
Railway (Stage4E, provisión de secreto), sin ningún deploy manual ni
acceso a Production en ninguna etapa.

## RESUMEN FINAL P2-T11 (histórico, no reemplaza las entradas por etapa)

```
P2_T11_TOTAL_COMMITS=3
P2_T11_TOTAL_PUSHES=3
P2_T11_TOTAL_RAILWAY_CONFIG_MUTATIONS=1 (Stage4E, provisión de secreto)
P2_T11_TOTAL_MANUAL_REDEPLOYS=0
P2_T11_TOTAL_PRODUCTION_ACCESS=0
P2_T11_COMMIT_CHAIN=d0ba59d (Phase A) -> e8d2171 (Phase B) -> f6ca24f (Phase C)
P2_T11_FINAL_HEAD_ORIGIN=f6ca24f78a4359fdf66e213b1a449a49426c1234
```

## P2-T18-STAGE4 — F-P1-01 + F-P1-02 exact local commit, sin push — 2026-08-27

```
task: P2-T18-STAGE4
branch: testing-codex
commit: 1adcc01f5380d896bed6e46dcd11bccb90d39e07
parent: f6ca24f78a4359fdf66e213b1a449a49426c1234
subject: fix: filter own-actor echo from chat typing and read events
commit_file_count: 2
commit_paths: src/components/chat/chat-sheet.tsx (modify), src/lib/chat-consumer-static-contract.test.ts (modify)
committed_blob_chat_sheet: d752aa12ecc40902c64c415d95f17d4275dc9eed
committed_blob_test: c4f79b43b0fb4a32a11d06d79ed83d46d2e8bdc8
tree: 243396408141d2aace8db590ad296b4c2458b87a
origin_testing_codex: f6ca24f78a4359fdf66e213b1a449a49426c1234
ahead: 1
behind: 0
tracked_worktree_clean: SI
index_empty: SI
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO
next_task: P2-T18-STAGE5
```

Único commit local de la implementación de F-P1-01/F-P1-02, precedido
por un gate de precisión de identidad que probó, con un `throw` runtime
real del productor (`mini-services/chat-service/index.js:80`), que un
falso self-match por `undefined === undefined` es estructuralmente
imposible en producción. Stage exacto por paths explícitos, auditoría
del índice cacheado, un único intento de commit exitoso, y
recertificación posterior directamente desde los objetos Git (IDs de
blob coincidentes con los del diff pre-commit, sin drift). Origin no
cambió durante la tarea — sin push, sin deploy, sin acceso a Railway.

## P2-T18-BLOCKER-AUTH2-R4 — Fase 1 same-browser multi-actor session coexistence, exact local commit, sin push — 2026-08-28

```
task: P2-T18-BLOCKER-AUTH2-R4
branch: testing-codex
commit: c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb
parent: 1adcc01f5380d896bed6e46dcd11bccb90d39e07
subject: feat: add actor-family session cookie foundation
commit_file_count: 9
commit_paths: src/proxy.ts (modify), src/lib/auth.ts (modify), src/app/api/auth/login/route.ts (modify), src/app/api/auth/logout/route.ts (modify), src/proxy.test.ts (add), src/lib/actor-family-session-coexistence.integration.test.ts (add), src/lib/session-login-atomicity.integration.test.ts (modify), src/lib/session-login-atomicity-wiring-static-contract.test.ts (modify), src/lib/client-block-security.integration.test.ts (modify)
committed_blob_proxy_ts: 1b602a69b98436e38cfce71fd73418b008fcefec
committed_blob_auth_ts: 01c79392d21c2d9b271a4426842f11d172569f6a
committed_blob_login_route: 7c156559cb5a3974df89d4494fd5345e2eeb560b
committed_blob_logout_route: 108163e1b73e73988acc654060a96e24d889fd5f
committed_blob_proxy_test: 55b3bc434dc06e9b54e9e1bdca8d8582cd6947fe
committed_blob_actor_family_coexistence_test: c0f41142a00721320657cf68e1198701cf5b9836
committed_blob_session_login_atomicity_test: a2b9810ca773df7a4081f16ef6d7a60ad069387a
committed_blob_session_wiring_static_contract_test: 2592768f3b180c635b602c7f06f7a850794667bb
committed_blob_client_block_security_test: 9194e9b53c009c7e050f0d8e00cc56cb73af5fd3
origin_testing_codex: 1adcc01f5380d896bed6e46dcd11bccb90d39e07
ahead: 1
behind: 0
index_empty: SI
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO (sólo lectura de fixtures/tests contra TESTING durante el gate de tests frescos, sin escritura fuera de esos fixtures ya limpiados)
next_task: P2-T18-BLOCKER-AUTH2-R5
```

Único commit local de la Fase 1 de same-browser multi-actor session
coexistence, empaquetando el diff ya certificado precommit por
AUTH2-R3-R1 (incluida la excepción única y puntual del hunk de tipos de
`req()` en `proxy.test.ts`, autorizada explícitamente por el usuario).
Gate de fingerprint contra la autoridad certificada antes de tocar
nada, 73/73 tests frescos, lint/TSC/build sin regresiones, stage
explícito por los 9 paths exactos (nunca `git add -A`), auditoría
completa del índice cacheado (0 paths extra, sin reports, sin `32`),
comparación byte a byte de blobs staged vs. working tree certificado
(9/9), lectura línea por línea del diff cacheado completo antes de
commitear, un único `git commit` exitoso con el subject exacto
congelado, y recertificación posterior directamente desde los objetos
Git (`git ls-tree HEAD`) — 9/9 blobs commiteados idénticos a los
staged e idénticos a los certificados por AUTH2-R3-R1, sin ningún
drift. `HEAD_PARENT=origin/testing-codex` antes del commit; origin no
cambió durante la tarea — sin push, sin deploy, sin acceso a Railway,
Production intacta, root `32` nunca tocado, reportes permanecen sin
stagear.

## P2-T18-BLOCKER-AUTH2-R5 — Fase 1 postcommit prepush exact blob review, sin acción Git — 2026-08-28

```
task: P2-T18-BLOCKER-AUTH2-R5
branch: testing-codex
head: c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb (sin cambio, recertificado)
head_parent: 1adcc01f5380d896bed6e46dcd11bccb90d39e07
origin_testing_codex: 1adcc01f5380d896bed6e46dcd11bccb90d39e07 (sin movimiento)
ahead: 1
behind: 0
new_commit: NO
push: NO
deploy: NO
railway_mutation: NO
production: NO
r5_blob_match_r4: 9_of_9_pass
r5_security_matrix: 16_of_16_pass
r5_committed_9_worktree_diff: EMPTY
next_task: P2-T18-BLOCKER-AUTH2-R6
```

Recertificación independiente de sólo lectura del commit `c047e9eb`,
sin ninguna acción Git (sin commit, sin push, sin deploy) — los 9 blob
IDs y el fileset se re-derivaron directamente de `git diff-tree`/`git
ls-tree HEAD`, cada uno de los 9 blobs se leyó completo vía `git show
HEAD:<path>` con su hash recomputado de forma independiente, y la
matriz de seguridad de 16 casos se re-derivó desde cero, código por
código, directamente desde los blobs commiteados. Único hallazgo
operativo: un fallo aislado y no reproducible en un test de
concurrencia real contra Postgres TESTING, confirmado como flake
transitorio de infraestructura tras dos re-ejecuciones limpias sin
tocar código. Corrección exclusivamente documental de un bloque de
marcadores "current" desactualizado en `CODEX_REPORT.md`. Origin no se
movió en ningún momento.

## P2-T18-STAGE6 — F-P1-01 + F-P1-02 TESTING push + Git-triggered autodeploy — 2026-08-27

```
task: P2-T18-STAGE6
branch: testing-codex
commit: 1adcc01f5380d896bed6e46dcd11bccb90d39e07
parent: f6ca24f78a4359fdf66e213b1a449a49426c1234
subject: fix: filter own-actor echo from chat typing and read events
push_command: git push origin testing-codex
push_attempt_count: 1
push_force_used: NO
push_range: f6ca24f78a4359fdf66e213b1a449a49426c1234..1adcc01f5380d896bed6e46dcd11bccb90d39e07
origin_testing_codex_final: 1adcc01f5380d896bed6e46dcd11bccb90d39e07
ahead_final: 0
behind_final: 0
railway_project: amiable-rejoicing
railway_environment: TESTING
railway_environment_id: f37d0c49-b737-49e8-be89-a00c13734fae
deligo_copy_deployment_id: fb41d224-c993-4b9f-b632-eb3a5ee614b9
deligo_copy_deploy_status: SUCCESS
deligo_copy_commit_hash: 1adcc01f5380d896bed6e46dcd11bccb90d39e07
chat_en_vivo_deployment_id: b6d48c4b-1592-494d-96ef-5dca8ae36ed9
chat_en_vivo_deploy_status: SUCCESS
chat_en_vivo_commit_hash: 1adcc01f5380d896bed6e46dcd11bccb90d39e07
deploy_metadata_source: railway_status_json_commitHash_field
manual_deploy_triggered: NO
deploy_log_error_count: 0
migration_ran: NO
migration_failed: NO
prepush_health: PASS (DeliGO /login 200, chat /health 200)
postdeploy_health: PASS (DeliGO /login 200, chat /health 200)
railway_mutation: NO
railway_variables_accessed: NO
production: NO
db_real_read: NO
db_real_write: NO
real_browser: NO
next_task: P2-T18-STAGE7
```

Publicación TESTING del commit ya certificado por Stage4/Stage5:
gates frescos completos (blobs 2/2, tests 43+264+98, lint/TSC/build
limpios), baseline pre-push de ambos servicios confirmado en el commit
padre `f6ca24f`, gate TOCTOU inmediatamente antes del push sin cambios,
y **exactamente un** `git push origin testing-codex` exitoso, sin
`--force`. El autodeploy Git-triggered (nunca disparado manualmente)
llevó a `DeliGO Copy` y `chat en vivo` a `SUCCESS` en el commit exacto,
confirmado por el campo `commitHash` de Railway — no inferido. Logs de
ambos servicios sin coincidencias de error/fatal/panic/failed; sin
migración pendiente ni fallida. F-P1-01/F-P1-02 permanecen
explícitamente abiertos, en espera de certificación con navegador real
en Stage7.

## P2-T18-BLOCKER-AUTH2-R6 — Fase 1 same-browser multi-actor session coexistence, TESTING push + Git-triggered autodeploy + runtime certification — 2026-08-28

```
task: P2-T18-BLOCKER-AUTH2-R6
branch: testing-codex
commit: c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb
parent: 1adcc01f5380d896bed6e46dcd11bccb90d39e07
subject: feat: add actor-family session cookie foundation
push_command: git push origin testing-codex
push_attempt_count: 1
push_force_used: NO
push_range: 1adcc01f5380d896bed6e46dcd11bccb90d39e07..c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb
origin_testing_codex_final: c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb
ahead_final: 0
behind_final: 0
railway_project: amiable-rejoicing
railway_environment: TESTING
railway_environment_id: f37d0c49-b737-49e8-be89-a00c13734fae
deligo_copy_deployment_id: 2b2c2771-9430-4ff5-91b1-dad48ecdbc95
deligo_copy_deploy_status: SUCCESS
deligo_copy_commit_hash: c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb
chat_en_vivo_deployment_id: c3873b8a-d5db-485d-a0fd-92e9e425b860
chat_en_vivo_deploy_status: SUCCESS
chat_en_vivo_commit_hash: c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb
deploy_metadata_source: railway_status_json_commitHash_field
manual_deploy_triggered: NO
deploy_log_error_count: 0
migration_ran: NO (27 migrations found, no pending migrations to apply)
migration_failed: NO
prepush_health: PASS (DeliGO /login 200, chat /health 200)
postdeploy_health: PASS (DeliGO /login 200, chat /health 200)
runtime_security_matrix: 16_of_16_pass
fixture_prefix: P2T18_AUTH2_R6_
fixture_cleanup: PASS (0 remanentes)
railway_mutation: NO
railway_variables_accessed: NO
production: NO
db_real_read: SI (fixtures TESTING vía Prisma directo, DELIGO_TEST_DATABASE_URL exclusivamente)
db_real_write: SI (mismo alcance — creación y limpieza de fixtures aisladas)
real_browser: NO
next_task: P2-T18-BLOCKER-AUTH2-R7
```

Publicación TESTING de la Fase 1 de same-browser multi-actor session
coexistence (foundation server-side), certificada precommit por
AUTH2-R3-R1, commiteada localmente en AUTH2-R4, recertificada
independientemente desde los objetos Git en AUTH2-R5. Revalidación
prepush fresca (corrida DECISIVA única, sin reintentos permitidos:
73/73 a la primera; 16/16 seguridad re-confirmada desde los blobs;
lint/TSC/build sin regresiones; Railway confirmado en
`amiable-rejoicing`/`TESTING` sin deploy concurrente), y **exactamente
un** `git push origin testing-codex` exitoso, sin `--force`. El
autodeploy Git-triggered (nunca disparado manualmente) llevó a
`DeliGO Copy` y `chat en vivo` a `SUCCESS` en el commit exacto,
confirmado por el campo `commitHash` de Railway — no inferido. Logs de
ambos servicios limpios; sin migración pendiente (este commit no
modifica schema). Certificación runtime real contra el backend
desplegado (no local) mediante un harness temporal externo al repo
(eliminado al finalizar) con fixtures TESTING aislados y limpiados: 16
casos de seguridad probados en producción-TESTING real — backward
compatibility del cliente actual, coexistencia simultánea de ambas
cookies de familia, aislamiento estricto por path (verificado por
ID/slug exacto de cada fixture propio), fail-closed ante selectores
conflictivos/malformados/desconocidos, header interno spoofeado sin
autoridad, ausencia de efecto secundario de `Set-Cookie`, ausencia de
fallback cruzado de familia, logout acotado exactamente a la familia
seleccionada, y transición legacy funcional sin fuga cruzada. Fase 2
(activación del lado cliente) explícitamente NO iniciada.

## P2-T18-BLOCKER-AUTH2-R7 — Fase 2 client activation, pre-implementation contract revalidation, sin acción Git — 2026-08-28

```
task: P2-T18-BLOCKER-AUTH2-R7
branch: testing-codex
head: c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb (sin cambio)
origin_testing_codex: c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb (sin movimiento)
ahead: 0
behind: 0
new_commit: NO
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO
real_browser: NO
phase2_reconciled_product_allowlist_count: 7
next_task: P2-T18-BLOCKER-AUTH2-R8
```

Tarea de sólo lectura/diseño — sin ninguna acción Git. Revalidó el
contrato client-side de Fase 2 contra el código actual: 3 callers
reales de `/api/auth/me` no detectados por el diseño histórico
(`use-suspension-check.ts`, `login/page.tsx`, `auth-modal.tsx`) suman
al allowlist; `realtime-manager.ts` sale del allowlist (no requiere
cambio). Congeló fuente de verdad de familia activa, diseño de
storage, transición legacy, contrato cross-tab, matriz de seguridad de
20 casos y aceptación de 10 puntos, allowlist de producto (7) y de
test (5 mandatorios + 6 de regresión). Cero mutación de código.

`P2-T18-BLOCKER-AUTH2-R8` (implementación local), `-R9` (revisión
adversarial, BLOCK por 2 gaps de cobertura) y `-R9-R1` (cierre de esos
2 gaps, sólo-test) transcurrieron todas sin ninguna acción Git —
`HEAD=ORIGIN=c047e9eb` sin cambio en las tres, `new_commit=NO` en las
tres. Ver `codex-reports/CURRENT_TASK.md`/archives correspondientes
para el detalle completo de cada una; no repetido aquí por no haber
actividad Git que registrar.

## P2-T18-BLOCKER-AUTH2-R10 — Fase 2, commit local exacto (sin push) — 2026-08-28

```
task: P2-T18-BLOCKER-AUTH2-R10
branch: testing-codex
head_pre: c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb
origin_pre: c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb
ahead_pre: 0
behind_pre: 0
new_commit: SI
commit_hash: a1579f11e79a41b90c6df4d2e8573ca9a669b856
commit_parent: c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb
commit_subject: feat: enable actor-family client auth coexistence
commit_files: 11 (7 producto M, 4 test — 3 A nuevos + 1 M)
head_final: a1579f11e79a41b90c6df4d2e8573ca9a669b856
origin_final: c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb (sin cambio)
ahead_final: 1
behind_final: 0
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: SI (sólo DELIGO_TEST_DATABASE_URL, suite ya certificada, sin escritura fuera de fixtures)
db_real_write: NO
real_browser: NO
next_task: P2-T18-BLOCKER-AUTH2-R11
```

Primer commit de Fase 2 (cliente) — Fase 1 (servidor) sigue siendo el
único commit de esta cadena ya desplegado en TESTING
(`c047e9eb`, R6). Staging explícito de los 11 paths exactos vía
`git add --` (nunca `-A`), auditado el índice (0 archivo fuera del
allowlist), commit único creado sin amend/sin segundo commit,
recertificado desde los objetos Git (`git diff-tree`, `git show
--name-only`, `git ls-tree HEAD` por cada path) — 11/11 blobs
commiteados idénticos a los staged/certificados por R9-R1, working
tree limpio contra HEAD. `AHEAD=1`/`BEHIND=0` contra
`origin/testing-codex`, que permanece exactamente en `c047e9eb` — la
rama local está un commit adelante del remoto, deliberadamente sin
empujar (push explícitamente prohibido en esta etapa). El commit
`a1579f11e79a41b90c6df4d2e8573ca9a669b856` es candidato a push en una
etapa futura (`P2-T18-BLOCKER-AUTH2-R11` primero recertifica
postcommit/prepush; el push en sí queda para una etapa posterior aún
no definida) — no autodeploy, no Railway, no Production tocados.

## P2-T18-BLOCKER-AUTH2-R11 — recertificación postcommit/prepush independiente, sin acción Git — 2026-08-28

```
task: P2-T18-BLOCKER-AUTH2-R11
branch: testing-codex
head: a1579f11e79a41b90c6df4d2e8573ca9a669b856 (sin cambio)
origin_testing_codex: c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb (sin movimiento)
ahead: 1
behind: 0
new_commit: NO
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: SI (sólo DELIGO_TEST_DATABASE_URL, suite ya certificada, sin escritura fuera de fixtures)
db_real_write: NO
real_browser: NO
next_task: P2-T18-BLOCKER-AUTH2-R12
```

Tarea de recertificación pura — sin ninguna acción Git de escritura
(sólo lectura: `diff-tree`, `ls-tree`, `show`, `diff`, `show --check`,
`diff --check`, `rev-parse`, `rev-list`, `fetch --prune`). Confirmó
que el commit `a1579f1` es exactamente el diff que R9-R1 certificó —
11/11 blobs, 0 paths extra, 0 hunks sin clasificar, vecinos congelados
sin diff entre `HEAD^` y `HEAD`. `P2_T18_PHASE2_COMMIT_TECHNICALLY_CERTIFIED=SI`,
`P2_T18_PHASE2_SAFE_TO_PUSH=YES_AFTER_FRESH_R12_PREPUSH_GATES` — R12
debe repetir estos gates completamente frescos inmediatamente antes de
cualquier push, mismo patrón que R6 exigió para Fase 1.

## P2-T18-BLOCKER-AUTH2-R12 — Fase 2, push exacto a TESTING + autodeploy certificado — 2026-08-28

```
task: P2-T18-BLOCKER-AUTH2-R12
branch: testing-codex
head_pre: a1579f11e79a41b90c6df4d2e8573ca9a669b856
origin_pre: c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb
ahead_pre: 1
behind_pre: 0
new_commit: NO
push: SI
push_movement: c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb..a1579f11e79a41b90c6df4d2e8573ca9a669b856
force_push: NO
head_post: a1579f11e79a41b90c6df4d2e8573ca9a669b856
origin_post: a1579f11e79a41b90c6df4d2e8573ca9a669b856
ahead_post: 0
behind_post: 0
deploy: SI (Git-triggered autodeploy únicamente, nunca manual)
railway_mutation: NO
production: NO
db_real_read: SI (sólo DELIGO_TEST_DATABASE_URL, suite ya certificada, sin escritura fuera de fixtures)
db_real_write: NO
real_browser: NO
next_task: P2-T18-BLOCKER-AUTH2-R13
```

Segundo push de la cadena AUTH2 (el primero, R6, empujó Fase 1
server). Repitió en fresco toda la revalidación decisiva — 11/11
fileset/blobs idénticos a R11, vecinos congelados sin diff entre
`HEAD^`/`HEAD`, 133/133 tests a la primera corrida (quinta
confirmación consecutiva del mismo total), 20/20 seguridad, 10/10
aceptación, mutation authority 12/12 por identidad de blobs, lint/TSC/
`git show --check`/`git diff --check`/build limpios, fingerprint 11/11
estable. Confirmó Railway inequívocamente en
`amiable-rejoicing`/`TESTING` (`f37d0c49-b737-49e8-be89-a00c13734fae`,
nunca Production), sin deploy concurrente — ambos servicios `SUCCESS`/
`RUNNING` en el commit padre `c047e9eb`, con los mismos deployment IDs
históricos de R6 (`2b2c2771`/`c3873b8a`) sin redeploy intermedio — y
health prepush limpio (`/login`=200, `/`=307, `/health`=200).

Con todos los gates en verde, ejecutó **exactamente un**
`git push origin testing-codex` sin `--force` — movimiento remoto
exactamente `c047e9eb..a1579f1`, confirmado inmediatamente después:
`HEAD=ORIGIN=a1579f11`, `AHEAD=0`/`BEHIND=0`. Observó únicamente (sin
`railway up`/`deploy`/`redeploy` manual) el autodeploy Git-triggered
vía polling read-only de `railway status --json` cada 15s hasta estado
terminal:

```
SERVICE=DeliGO Copy
DEPLOYMENT_ID=78625067-b614-4ee9-9c90-0abbea65021f (nuevo, distinto del histórico 2b2c2771)
PROGRESSION=BUILDING → DEPLOYING → SUCCESS (~90s)
COMMIT_HASH=a1579f11e79a41b90c6df4d2e8573ca9a669b856 (confirmado desde latestDeployment.meta.commitHash)

SERVICE=chat en vivo
DEPLOYMENT_ID=1916b7af-729c-4dc9-9822-abc200585cb7 (nuevo, distinto del histórico c3873b8a)
STATUS=SUCCESS
COMMIT_HASH=a1579f11e79a41b90c6df4d2e8573ca9a669b856
```

Ambos `commitHash` confirmados desde la metadata real de Railway —
nunca inferidos del éxito del `git push`. Logs de ambos servicios sin
`error`/excepción (DeliGO Copy: "No pending migrations to apply",
esperado, Fase 2 no toca schema; chat en vivo: "listening on port
8080"). Health postdeploy limpio en ambos. Ejecutó un smoke de
regresión de Fase 1 server sin navegador y sin campaña de fixtures
nueva (7 requests HTTP directos) — fail-closed uniforme sin importar
el valor del selector `actorFamily`, sin `Set-Cookie` filtrado, sin
fallback cruzado de familia, sin ningún 5xx. `PHASE2_DEPLOYED_FROM_EXACT_COMMIT=SI`
confirmado; `PHASE2_BROWSER_BEHAVIOR_CERTIFIED=NO` — resultado
explícitamente esperado de esta etapa, la certificación real de
navegador queda íntegramente para `P2-T18-BLOCKER-AUTH2-R13`. Cero
navegador real, cero fixture manual nueva, cero mutación de Railway,
Production intacta.

## P2-T18-BLOCKER-AUTH2-R13 — certificación real-browser — sin acción Git/deploy — 2026-08-28

```
task: P2-T18-BLOCKER-AUTH2-R13
branch: testing-codex
head_pre: a1579f11e79a41b90c6df4d2e8573ca9a669b856
origin_pre: a1579f11e79a41b90c6df4d2e8573ca9a669b856
ahead_pre: 0
behind_pre: 0
new_commit: NO
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: SI (DELIGO_TEST_DATABASE_URL exclusivamente, fixtures P2T18_AUTH2_R13_)
db_real_write: SI (1 Cliente + 1 Negocio + 1 Producto + 1 Pedido creados y luego eliminados en su totalidad, incluidas 2 filas Sesion huérfanas)
real_browser: SI (Claude in Chrome, navegador real elegido explícitamente por el usuario — "Browser 2")
head_final: a1579f11e79a41b90c6df4d2e8573ca9a669b856
origin_final: a1579f11e79a41b90c6df4d2e8573ca9a669b856
ahead_final: 0
behind_final: 0
index_empty_final: SI
source_test_worktree_clean: SI
result: BLOCKED_REAL_BROWSER_PRODUCT_DEFECT
next_task: P2-T18-BLOCKER-AUTH2-R13-R1
```

R13 no realiza ninguna acción de Git ni de deploy — es exclusivamente
una certificación de comportamiento contra TESTING ya desplegado en
`a1579f11` desde R12. El único movimiento real de esta etapa fue en la
base de datos TESTING aislada (fixtures creados y luego eliminados por
completo) y en el navegador real (login/logout de UI, storage/cookies
limpiados). Git permanece exactamente donde R12 lo dejó:
`HEAD=ORIGIN=a1579f11e79a41b90c6df4d2e8573ca9a669b856`,
`AHEAD=0`/`BEHIND=0`, índice vacío, `src/` sin cambios. Ningún commit
nuevo fue creado porque no se corrigió ningún código — regla explícita
de la etapa ante el defecto real descubierto (`F-P2-T18-AUTH02`). La
próxima acción de Git de esta cadena ocurrirá recién en
`P2-T18-BLOCKER-AUTH2-R13-R1`, cuando se implemente y commitee la
corrección focal aislada.

## P2-T18-BLOCKER-AUTH2-R13-R1 — reconciliación read-only de F-P2-T18-AUTH02 — sin acción Git/deploy — 2026-08-28

```
task: P2-T18-BLOCKER-AUTH2-R13-R1
branch: testing-codex
head_pre: a1579f11e79a41b90c6df4d2e8573ca9a669b856
origin_pre: a1579f11e79a41b90c6df4d2e8573ca9a669b856
ahead_pre: 0
behind_pre: 0
new_commit: NO
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO
real_browser: NO
head_final: a1579f11e79a41b90c6df4d2e8573ca9a669b856
origin_final: a1579f11e79a41b90c6df4d2e8573ca9a669b856
ahead_final: 0
behind_final: 0
index_empty_final: SI
source_test_worktree_clean: SI
result: PASS_AUTH02_ROOT_CAUSE_SCOPE_AND_FIX_CONTRACT_REFROZEN
next_task: P2-T18-BLOCKER-AUTH2-R13-R2
```

Tarea puramente de lectura de código (release completo de
`src/proxy.ts`, `Glob`/`Grep` exhaustivos sobre `src/app/api/chat/**`,
`src/app/api/push/**`, `src/app/api/realtime/**` y los 11 call sites
cliente reales) — ninguna base de datos tocada, ningún navegador
usado, ningún archivo de producto o test mutado. Git permanece
exactamente donde R13 lo dejó:
`HEAD=ORIGIN=a1579f11e79a41b90c6df4d2e8573ca9a669b856`,
`AHEAD=0`/`BEHIND=0`, índice vacío, `src/` sin cambios — verificado al
inicio y al final de la etapa, idéntico en ambos puntos. La próxima
acción de Git de esta cadena ocurrirá en
`P2-T18-BLOCKER-AUTH2-R13-R2`, cuando se implemente localmente el
contrato de 7 archivos de producto + 7 de test congelado en esta
etapa.

## P2-T18-BLOCKER-AUTH2-R13-R4 — Fase 2 (AUTH02), commit local exacto (sin push) — 2026-08-29

```
task: P2-T18-BLOCKER-AUTH2-R13-R4
branch: testing-codex
head_pre: a1579f11e79a41b90c6df4d2e8573ca9a669b856
origin_pre: a1579f11e79a41b90c6df4d2e8573ca9a669b856
ahead_pre: 0
behind_pre: 0
index_empty_pre: SI
new_commit: SI
commit_hash: fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
commit_parent: a1579f11e79a41b90c6df4d2e8573ca9a669b856
commit_subject: fix: scope shared auth requests by actor family
commit_files: 14 (7 producto M, 7 test - 3 A nuevos + 4 M)
head_final: fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
origin_final: a1579f11e79a41b90c6df4d2e8573ca9a669b856 (sin cambio)
ahead_final: 1
behind_final: 0
index_empty_final: SI
push: NO
deploy: NO
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO
real_browser: NO
next_task: P2-T18-BLOCKER-AUTH2-R13-R5
```

Segundo commit de esta cadena de Fase 2/AUTH02 (el primero,
`a1579f11`, ya está desplegado en TESTING desde R12 — este es el
commit del defecto F-P2-T18-AUTH02 descubierto por R13, corregido
localmente por R13-R2 y certificado por la larga cadena adversarial
R13-R3 a R13-R3-RETRY-2-R2-R1A). Staging explícito de los 14 paths
exactos vía `git add --` (nunca `-A`/`-u`/`commit -a`), auditado el
índice (0 archivo fuera del allowlist — 0 reportes, 0 root `32`, 0
schema/migración/package), probado `staged == worktree == certificado`
14/14 vía blob hashing directo antes de commitear. Commit único creado
sin amend/sin segundo commit, recertificado desde los objetos Git
(`git diff-tree`, `git show --name-status`, `git rev-parse
"HEAD:<path>"` por cada uno de los 14 paths comparado contra `git
hash-object`) — 14/14 blobs commiteados idénticos a los
staged/certificados por R13-R3-RETRY-2-R2-R1A, worktree sin diff
restante para los 14 paths contra `HEAD`. `AHEAD=1`/`BEHIND=0` contra
`origin/testing-codex`, que permanece exactamente en `a1579f11` — la
rama local queda un commit adelante del remoto, deliberadamente sin
empujar (push explícitamente prohibido en esta etapa). El commit
`fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f` incluye una excepción de
infraestructura de TESTING aceptada por el usuario
(`EX-P2-T18-SEC-BLOCK-1-P2028`, ver `codex-reports/FINDINGS.md`,
`F-P2-TESTINFRA-01`) que NO modifica ningún byte de source/test — es
candidato a push en `P2-T18-BLOCKER-AUTH2-R13-R6`, después de que
`P2-T18-BLOCKER-AUTH2-R13-R5` recertifique postcommit/prepush de forma
independiente — no autodeploy, no Railway, no Production tocados.

## P2-T18-BLOCKER-AUTH2-R13-R6 — Fase 2 (AUTH02), push exacto a TESTING + autodeploy certificado — 2026-08-29

```
task: P2-T18-BLOCKER-AUTH2-R13-R6
branch: testing-codex
head_pre: fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
origin_pre: a1579f11e79a41b90c6df4d2e8573ca9a669b856
ahead_pre: 1
behind_pre: 0
new_commit: NO
push: SI
push_movement: a1579f11e79a41b90c6df4d2e8573ca9a669b856..fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
force_push: NO
head_post: fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
origin_post: fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
ahead_post: 0
behind_post: 0
deploy: SI (Git-triggered autodeploy únicamente, nunca manual)
railway_mutation: NO
production: NO
db_real_read: NO
db_real_write: NO
real_browser: NO
next_task: P2-T18-BLOCKER-AUTH2-R13-R7
```

Tercer push de la cadena AUTH2 (R6 empujó Fase 1 server, R12 empujó
Fase 2 client activation). Repitió en fresco el gate prepush acotado —
14/14 blobs idénticos a R13-R5, focal 117/117 a la primera corrida
(280 expect() calls, idéntico al histórico), ESLint limpio, TSC
31/24 idéntico a la baseline vigente (sin diagnóstico nuevo en los 14
paths de AUTH02, sólo los 2 TS2367 preexistentes ya documentados en
`permission-prompt.tsx`), `git show --check`/`npm run build` limpios.
Confirmó Railway inequívocamente en
`amiable-rejoicing`/`TESTING` (`f37d0c49-b737-49e8-be89-a00c13734fae`,
nunca Production), sin deploy concurrente — ambos servicios `RUNNING`
en el commit padre `a1579f11` — y health prepush limpio (`/login`=200,
`/`=307, `/health`=200).

Con todos los gates en verde, ejecutó **exactamente un**
`git push origin testing-codex` sin `--force` — movimiento remoto
exactamente `a1579f1..fe0e11d`, confirmado inmediatamente después:
`HEAD=ORIGIN=fe0e11d0`, `AHEAD=0`/`BEHIND=0`. Observó únicamente (sin
`railway up`/`deploy`/`redeploy` manual) el autodeploy Git-triggered
vía polling read-only de `railway status --json` cada 15s hasta estado
terminal (~90s):

```
SERVICE=DeliGO Copy
DEPLOYMENT_ID=4e6618dc-4910-4b94-9da1-0f1d1fa60e5e (nuevo, distinto del histórico 78625067)
STATUS=SUCCESS
COMMIT_HASH=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f (confirmado desde meta.commitHash real de Railway)

SERVICE=chat en vivo
DEPLOYMENT_ID=43abe272-4fb2-474f-a55a-5d9389ead83c (nuevo, distinto del histórico 1916b7af)
STATUS=SUCCESS
COMMIT_HASH=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
```

Ambos `commitHash` confirmados desde la metadata real de Railway —
nunca inferidos del éxito del `git push`. `chat en vivo` volvió a
autodeployar pese a que el diff de AUTH02 (14 paths, R13-R4) no toca
ningún archivo propio de ese servicio — mismo patrón ya visto en R6/
R12 (Railway dispara ambos servicios en cada push a `testing-codex`,
sin filtro por path); se observó, nunca se disparó manualmente. Logs
de ambos servicios sin `error`/excepción (DeliGO Copy: "No pending
migrations to apply", esperado, AUTH02 no toca schema; chat en vivo:
"listening on port 8080"). Health postdeploy limpio en ambos.
`AUTH02_PUSHED=SI`, `AUTH02_DEPLOYED_TESTING=SI`,
`AUTH02_DEPLOYED_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`.
Cero navegador real, cero fixture manual nueva, cero mutación de
Railway, Production intacta. La certificación real de navegador
(18/18 desde cero) queda íntegramente para
`P2-T18-BLOCKER-AUTH2-R13-R7`.

---

## P2-T18-BLOCKER-AUTH2-R13-R7 — 2026-08-29

Etapa de certificación con navegador real (18/18 PASS) — sin ningún
hecho nuevo de Git/deploy. Confirmó, sólo por lectura, que el estado
seguía exactamente el de R13-R6: `HEAD=ORIGIN=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`,
`AHEAD=0`/`BEHIND=0`, ambos servicios (`DeliGO Copy`
`4e6618dc-4910-4b94-9da1-0f1d1fa60e5e`, `chat en vivo`
`43abe272-4fb2-474f-a55a-5d9389ead83c`) `SUCCESS` en ese commit exacto
vía `railway status --json` read-only, health `/login`=200,
`/health`=200. Git final tras la etapa: idéntico, sin cambio —
`R13_R7_COMMIT=NO`, `R13_R7_PUSH=NO`, `R13_R7_DEPLOY=NO`.

---

## P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE — 2026-08-29

Sin ningún hecho nuevo de Git/deploy — etapa de sólo aceptación con
navegador real, bloqueada por control inválido antes de llegar a
ninguna decisión sobre código. Confirmó por lectura que el estado
seguía exactamente `HEAD=ORIGIN=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`,
`AHEAD=0`/`BEHIND=0`, ambos servicios `SUCCESS` en ese commit exacto.
`SOURCE_MUTATION=NO`, `TEST_MUTATION=NO`, `NEW_COMMIT=NO`, `PUSH=NO`,
`DEPLOY=NO`.

---

## P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R1 — 2026-08-29

NO Git/deploy event. Etapa de diagnóstico puro (3 observaciones,
harness externo + navegador real + observador temporal de solo
lectura) — sin commit/push/deploy/mutación de Railway en ningún
momento. Git final idéntico a la etapa anterior:
`HEAD=ORIGIN=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`, `AHEAD=0`/
`BEHIND=0`.

---

## Auditoría de sincronización Production vs testing-codex — 2026-08-29

```
PRODUCTION_MAIN_HEAD=9d1be1835b3cb01bbfa3090fb3401890f1e90c59 (2026-06-18, merge PR#2 desde "testing" — main no tiene ningún commit propio desde entonces)
PRODUCTION_LAST_DEPLOY_ATTEMPT_COMMIT=6ba02d8c26c15b23b5698871467ee64919d8203d (2026-06-05, branch main, status FAILED, 0 instancias activas, deploymentStopped=true)
PRODUCTION_CHAT_SERVICE_DEPLOY_HISTORY=NINGUNO (latestDeployment=null — nunca desplegado en Production)
PRODUCTION_APP_LIVE_CHECK=HTTP 404 en https://deligo.ar/, header x-railway-fallback:true (confirmado con petición real, sin deployment activo)
TESTING_CODEX_HEAD=c05525a5e0419922a484fbe6cb25c8604b8ca313 (2026-08-29)
TESTING_CODEX_AHEAD_OF_MAIN=241 commits, 673 archivos, +114686/-9661 líneas
```

Auditoría de solo lectura, solicitada por el usuario tras pausar
P2-T18. Ningún commit/push/deploy/migración/mutación de Railway en
ningún entorno. Detalle completo (schema, migraciones, variables,
matriz de relaciones entre servicios) en
`codex-reports/PRODUCTION_SYNC_AUDIT.md`. El usuario detuvo
explícitamente cualquier avance automático hacia P2-T06 tras esta
auditoría — `NEXT_REQUIRES_USER_PROMPT=SI`.

## BUSINESS-HOURS-TIMEZONE-PRODUCTION-PROMOTION-R1 — 2026-08-30

`a178140ef5167dce1b596edeb58e17cc7029beaf` se pusheó una vez a `testing-codex` y una vez como fast-forward `testing-codex:main`; no hubo merge, rebase ni force-push. Railway Production desplegó el commit en DeliGO, chat en vivo y los dos servicios auxiliares esperados; todos terminaron `SUCCESS`. Postgres no recibió cambio de configuración.

## P2-T41-TERMINAL-READ-ONLY-ACTION-AUTHORIZATION — 2026-09-10

Un solo commit `fb404a2d510998f53f305ba497b9c543ef4cee53` ("fix: enforce
terminal read-only actions") sobre `origin/testing-codex@ea9edbc2ee`,
8 archivos (5 producto + 3 test), pusheado una vez a `testing-codex`
(`ea9edbc..fb404a2`) — `main` NO tocado, verificado
`773664f8da80b2143cfd1443ed0467ace6c45a34` antes y después. Autodeploy
Git-triggered en Railway TESTING (servicio DeliGO Copy), deployment
`03774f34-75a1-493b-9bc2-0a6a7e4670bb` `SUCCESS`, `commitHash` del
deployment activo verificado vía `railway status --json` = commit
exacto pusheado. Logs de boot limpios ("No pending migrations to
apply", sin excepciones/500/fatal). `chat en vivo` no mostró evidencia
de rebuild disparado por este push (servicio separado, no aplica
"incidental same-repo autodeploy"). Production sin ningún deploy nuevo
en esta tarea.

## P2-T41-OPERATOR-CERTIFICATION-CLOSEOUT — 2026-09-10

NO Git/deploy event. Tarea puramente documental — el operador certificó
físicamente/vía browser el fix de P2-T41 ya desplegado en TESTING
(commit `fb404a2d510998f53f305ba497b9c543ef4cee53`, deployment
`03774f34-75a1-493b-9bc2-0a6a7e4670bb`, ya registrado arriba). Git
final idéntico a la entrada anterior:
`HEAD=origin/testing-codex=fb404a2d510998f53f305ba497b9c543ef4cee53`,
`origin/main=773664f8da80b2143cfd1443ed0467ace6c45a34`, sin drift, sin
commit/push/deploy nuevo. `P2_T41_STATUS=CLOSED_TESTING_CERTIFIED`,
`P2_T41_RELEASE_ELIGIBLE=SI` — promoción a main/Production NO
ejecutada en esta tarea.

## P2-T41-PROMOTION-TO-MAIN-AND-PRODUCTION — 2026-09-10

Delta real auditado `origin/main..origin/testing-codex`: exactamente 8
archivos (5 producto + 3 test), verificado byte a byte idéntico al
patch propio del commit `fb404a2` — ningún trabajo ajeno. Release
commit `bb17c7dd1eb9b8f4cb94d03de834019baf182987` vía `git commit-tree`
(mismo patrón de las 6 promociones anteriores), `tree=testing-codex@fb404a2`
(=`0070fcf64dfb33eadca98ff365d03f3956fd8bf2`, verificado byte-igual),
`parent=origin/main@773664f8da80b2143cfd1443ed0467ace6c45a34`, mensaje
"release: promote certified p2-t41 checkpoint" con trailers
`Source-Head`/`Source-Main-Parent`. Push fast-forward por SHA exacto a
`origin/main` (sin force) — `origin/testing-codex` sin cambios
(`fb404a2d510998f53f305ba497b9c543ef4cee53`, verificado antes y
después). Autodeploy Git-triggered SUCCESS en el PRIMER intento en
ambos servicios relevantes: DeliGO Production (deployment
`cd8f207e-6e23-4c7b-aca7-a6188e4eab52`) y chat en vivo (redeploy
incidental por compartir repo `LeoCampos2504/DeliGO`, deployment
`2f799d4b-df32-4ebf-9523-881a2a10032d`) — `commitHash` de ambos
verificado exacto (`bb17c7dd1eb9b8f4cb94d03de834019baf182987`) vía
`railway status --json`. Logs limpios: "30 migrations found... No
pending migrations to apply", boot de Next.js/bun sin excepciones,
chat-service "listening on port 8080" sin errores. Smoke no-mutante
4/4 PASS contra `https://deligo.ar` y el chat-service real (raíz,
panel Terminal sin sesión, ocupación inexistente, health del chat) —
nunca se ejecutó `POST` de cancelar pedido ni cerrar cuenta contra
Production, nunca se fabricó una sesión. Tag anotado
`p2-t41-stable-2026-09-10` -> `bb17c7d`, creado y pusheado sólo
DESPUÉS de confirmar deploy SUCCESS + commit match + smoke PASS.
`P2_T41_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`. `P2-T42` preservada
`READY_FUTURE`, no incluida en este release
(`P2_T42_INCLUDED_IN_RELEASE=NO`). `PUBLIC_RELEASE_AUTHORIZED=NO` —
checkpoint técnico, no lanzamiento público.

## P2-T42-PYR-EMPLOYEE-TERMINAL-ORDER-WORKFLOW-PARITY — 2026-09-10

Un solo commit `eb2af3a598bf4e91ccd48b06092fb892a7ac0f9b` ("fix: align
pyr order workflow") sobre `origin/testing-codex@fb404a2d`, 19 archivos
(17 producto + 2 test; incluye 2 endpoints nuevos —
`.../pedidos/[id]/{aceptar,buscar-repartidor}` — y 1 retirado —
`.../pedidos/[id]/en-camino`), pusheado una vez a `testing-codex`
(`fb404a2..eb2af3a`) — `main` NO tocado, verificado
`bb17c7dd1eb9b8f4cb94d03de834019baf182987` antes y después. Autodeploy
Git-triggered SUCCESS en el PRIMER intento en ambos servicios
relevantes: DeliGO Copy TESTING (deployment
`d379ff8e-ec92-4727-868a-4969c4e36586`) y chat en vivo (redeploy
incidental por compartir repo, deployment
`b354b63d-c32e-4f4b-be6d-f019e6ae2317`) — `commitHash` de ambos
verificado exacto vía `railway status --json`. Logs de boot limpios
("No pending migrations to apply", sin excepciones/500/fatal en
ninguno de los dos). `P2_T42_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_OR_
BROWSER_CERTIFICATION` (cambia orden visual, botones y estados
visibles en ambas superficies PyR — no se declara certificado sin
control manual). `P2_T41_STATUS=CLOSED_PRODUCTION_CHECKPOINTED` sin
cambios, no reabierto. Production sin ningún deploy nuevo en esta
tarea.

## P2-T02-B1-REPARTIDOR-PWA-POST-LOGIN-ROUTING — 2026-09-10

Un solo commit `489528ca4ba315cd0873e4b270fcdf0b4e3094cd` ("fix: keep
repartidor login in delivery pwa") sobre
`origin/testing-codex@eb2af3a`, 3 archivos (2 producto + 1 test),
pusheado una vez a `testing-codex` (`eb2af3a..489528c`) — `main` NO
tocado, verificado `bb17c7dd1eb9b8f4cb94d03de834019baf182987` antes y
después. Autodeploy Git-triggered SUCCESS en el PRIMER intento en ambos
servicios relevantes: DeliGO Copy TESTING (deployment
`27bd08e3-6cb9-40f7-9c66-823ba10c9507`) y chat en vivo (redeploy
incidental por compartir repo, deployment
`dce0d06c-cc6d-47cd-bcaa-ad443d3206ef`) — `commitHash` de ambos
verificado exacto vía `railway status --json`. Logs de boot limpios
("No pending migrations to apply", sin excepciones/500/fatal). Smoke
no-mutante `GET /repartidor -> 200`. `P2_T02_B1_STATUS=WAITING_FOR_
OPERATOR_PHYSICAL_CERTIFICATION` — bloqueaba la certificación física
GPS de P2-T02 (sesión en curso); requiere checklist Android del
operador (A-D) antes de retomar las 10 fases GPS. Production sin
ningún deploy nuevo en esta tarea.

P2-T46-R1: rama `work/p2-t46-r1` basada en `origin/testing-codex@bb228ee43c89073a4355e6a012bb9aeaf3669dcb`; commit/deploy Testing pendientes. Production intacta.

## P2-T46-R3 — operator certification closeout — 2026-09-11

Tarea documental sin evento Git/deploy. La certificación física queda anclada
al deployment Testing `fbdf45b6-9961-4549-9cb2-a68016173862`, commit
`c3da04ef84dbd183956e78691a3b3da0f5dc2f68`. El descendiente actual
`c826e796d33de5d00f8efddf4fa258fb86587c6` sólo documenta evidencia y no cambia
el comportamiento T46. No hubo commit, push, deploy ni promoción a Production.

## P2-T46-R4 — curated Production promotion and checkpoint — 2026-09-11

Release branch `release/p2-t46-curated` nació de
`origin/main@946f8c2404df8be6a1e7252f3d7d2ba520d337f8` y produjo el commit
`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`. Se hizo push fast-forward a
`main`, sin force ni history rewrite. Railway Production/DeliGO desplegó ese
commit como `f700ca0f-64e1-4bd1-a027-b14284523de9`, aplicó la migración T46 y
quedó SUCCESS/RUNNING. Se creó y verificó el tag anotado
`p2-t46-stable-2026-09-11`, objeto `7502b3c1e98131535dc03dd25a2e4a01a65d144d`,
peeled `ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`. El tag T48 anterior no se
movió. Production no fue promovida con ningún otro feature.

## P2-T43-R3 — Testing operator certification closeout — 2026-09-12

R3 fue documentation-only sobre el runtime R2 de Testing. El commit funcional
R2 `401fa5676607298f3b0ccf2eae0618cecac3b766` y el deployment Testing
`c09f5a6c-4261-4a76-b446-2c6aab4fe393` permanecen como autoridad de ejecución;
la recertificación física del operador fue PASS.

`PRODUCT_FILES_CHANGED=0`, `TEST_FILES_CHANGED=0`, `PRISMA_FILES_CHANGED=0`,
`MIGRATION_FILES_CHANGED=0`, `FUNCTIONAL_TREE_CHANGED=NO`.
El commit y push de R3 se limita a documentación hacia `testing-codex`.
`main`, el checkpoint `p2-t46-stable-2026-09-11` y Production no se tocan.

El commit documental `a8a0fd157ee183cb56193fba6b41f032c9479ba1` se pusheó con
éxito a `testing-codex`, que quedó en ese SHA. El autodeploy DeliGO Copy
Testing `5c1c57b6-f008-4e6f-a626-834d9e5ce9ca` terminó `SUCCESS/RUNNING` con
match exacto de commit; sus logs confirmaron `No pending migrations to apply`
(`TESTING_PENDING_MIGRATIONS=0`, `TESTING_DB_ERRORS=0`). No hubo deploy manual,
push a main ni cambio en Production.

## P2-T02-R5A/R5B — safe-area implementation and operator closeout (2026-09-12)

R5A fue implementada en `ee7eea740aecfd70bc0718601a7fd077a015df98` y pusheada
únicamente a `testing-codex`. El autodeploy funcional de DeliGO Copy
`50e7649e-aa79-44f9-a860-214a713049bf` terminó `SUCCESS/RUNNING` con match exacto
de commit; logs: `No pending migrations to apply`, sin errores DB.

R5B fue documentation-only, con cierre físico reportado por el operador en
iPhone y smoke Android. El commit documental se pusheó únicamente a
`testing-codex`; su autodeploy DeliGO Copy
`adfe6a8f-c37c-4965-8fb5-cd33d1d3c7a6` terminó `SUCCESS/RUNNING` con commit
`e024e9698bb0f2a813587da301aef071486ee852`, sin migraciones pendientes ni
errores DB. No hubo deploy manual, push a main ni cambio en Production.
