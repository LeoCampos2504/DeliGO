# P2-T52 — Cierre final: certificación física en TESTING

Fecha: 2026-09-20
Alcance: DOCUMENTACIÓN / RECONCILIACIÓN DE ESTADO ÚNICAMENTE. Sin código
de producto, sin tests, sin API/auth/DB/schema/migración/manifest/
asset/service worker/push, sin redeploy, sin Production.

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=7961f238c9f9dde8e75956c2725b0da9680c4b8c (== origin/testing-codex)
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes de esta misma
  sesión, ajenos a este cierre: DELIGO_FULL_CONTEXT_LATEST.md,
  codex-reports/P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md; más
  next-env.d.ts, artefacto auto-generado por el dev server de Next
  usado en la prevalidación visual de R1B — no es código de producto)
PRODUCT_CODE_DIRTY_AJENO=NO
```

Worktree T39 (`54d17d56f1781ab4d0fd4f1d808df194bdf76a9d`) confirmado
intacto, no tocado. `origin/main` reconfirmado en
`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763` — Production sin cambios.

## 2. Autoridades — historia preservada, sin reinterpretar

Este cierre se basa en 4 documentos previos de esta misma sesión, cuya
historia y conclusiones se preservan sin reescribir:

- `P2_T52_A0_MOZO_OPERATIONS_COEXISTENCE_AND_PWA_CONSOLIDATION_AUDIT.md`
- `P2_T52_A1_SINGLE_PWA_COMPATIBILITY_MIGRATION_DECISION.md`
- `P2_T52_A2_EMPLOYEE_SALON_LEGACY_PWA_ARTIFACT_AUDIT.md`
- `P2_T52_R1B_DISABLE_EMPLOYEE_SALON_LEGACY_INSTALL_PROMOTION.md`

## 3. Implementación certificada — confirmada vigente, sin redeploy

```text
P2_T52_R1B_COMMIT_SHA=5f4804c0d903475ca1949bd5428145a80ca6dc15
P2_T52_R1B_DEPLOY_ID=2aae4685-8c1a-4e04-815d-ae3197682724

P2_T52_CERTIFIED_RUNTIME_SHA=5f4804c0d903475ca1949bd5428145a80ca6dc15
P2_T52_CERTIFIED_DEPLOY_ID=2aae4685-8c1a-4e04-815d-ae3197682724
```

Verificado: `5f4804c` existe en el historial de `work/p2-t43-r2` sin
alteración, entre `1e5ad4b` (A2) y `7961f23` (docs de R1B, HEAD
anterior a este cierre). El deploy `2aae4685-8c1a-4e04-815d-ae3197682724`
en TESTING ("DeliGO Copy") corresponde exactamente a ese commit — es el
código que el operador certificó físicamente. No se realizó ningún
redeploy en esta ronda.

## 4. Certificación física del operador — evidencia exacta de esta sesión

**Case A** — `/e/test`: el operador confirmó que se muestra
correctamente la pantalla "Este acceso fue reemplazado", con el texto
completo *"El acceso mediante enlace ya no está disponible. Para
trabajar con un negocio, iniciá sesión en DeliGO Operaciones con tu
cuenta personal. Si todavía no tenés una cuenta, podés crearla desde
la pantalla de ingreso. Después necesitás el código de incorporación
proporcionado por el negocio."*

```text
CASE_A_EMPLOYEE_TOMBSTONE=PASS
```

**Case B** — `/s/test`: el operador reportó *"lo mismo"* — misma
pantalla de acceso reemplazado funcionando correctamente (interpretación
autorizada por el propio task spec).

```text
CASE_B_SALON_TOMBSTONE=PASS
```

**Case C** — `/operaciones`: el operador confirmó *"si se ve bien"* —
el home certificado en T51 permanece visualmente correcto.

```text
CASE_C_OPERATIONS_HOME_REGRESSION=PASS
```

**Case D** — `/mozo`: el operador confirmó *"sigue igual"*.

```text
CASE_D_MOZO_COMPATIBILITY_REGRESSION=PASS
```

**Case E** — PWA histórica "DeliGO Empleados"/"DeliGO Salón" ya
instalada: el operador respondió *"no"* (no tiene ninguna instalación
de ese tipo disponible).

```text
CASE_E_LEGACY_INSTALLED_PWA=CONDITIONAL_NOT_AVAILABLE
CASE_E_REQUIRED_FOR_CLOSE=NO
```

No es un blocker porque R1B no modificó manifest, `start_url`, `scope`,
`DynamicManifest` ni borró ningún ícono — únicamente impide OFRECER una
instalación NUEVA desde los tombstones; una instalación legacy ya
existente (si la hubiera) no se ve afectada por este cambio en
absoluto, y su compatibilidad ya estaba confirmada por auditoría de
código en A2, no por prueba física.

## 5. Resultado físico global

```text
P2_T52_PHYSICAL_CERTIFICATION=PASS

PHYSICAL_CASE_A=PASS
PHYSICAL_CASE_B=PASS
PHYSICAL_CASE_C=PASS
PHYSICAL_CASE_D=PASS
PHYSICAL_CASE_E=CONDITIONAL_NOT_AVAILABLE

P2_T52_PHYSICAL_BLOCKERS=0
```

## 6. Implementación final de T52

```text
INSTALL_PROMPT_DISABLED_ON_EMPLOYEE_LEGACY_ROUTES=SI
INSTALL_PROMPT_DISABLED_ON_SALON_LEGACY_ROUTES=SI
```

`/e`, `/e/**`, `/s`, `/s/**` siguen existiendo como
`COMPATIBILITY_TOMBSTONES` — no se ofrecen nuevas instalaciones PWA
desde esas superficies.

## 7. Modelo Mozo — preservado sin reinterpretar

```text
MOZO_ROUTE_CURRENTLY_FUNCTIONAL=SI
MOZO_USES_CUENTA_OPERATIVA=SI
KEEP_MOZO_ROUTES_FOR_COMPATIBILITY=SI
MOZO_ROUTE_REMOVAL_IN_T52=NO
MANIFEST_MOZO_DELETE=NO
ICON_MOZO_DELETE=NO
MOZO_PUSH_ICON_PRESERVED=SI
RECOMMENDED_MOZO_PUSH_TARGET=/mozo/panel/[slug]
MOZO_SCOPE_TOUCHED=NO
```

Mozo queda funcional y compatible. La futura migración de push target
+ Service Worker (Fase 4, diseñada en A1) permanece FUERA del cierre
actual — no se crea ninguna tarea nueva, ya está formalizada dentro de
la propia documentación de T52 como trabajo diferido con su propia
autorización futura.

## 8. Empleado / Salón legacy — preservado

```text
EMPLOYEE_LEGACY_ROUTE_FUNCTIONALITY=COMPATIBILITY_TOMBSTONE
SALON_LEGACY_ROUTE_FUNCTIONALITY=COMPATIBILITY_TOMBSTONE

EMPLOYEE_MANIFEST_DELETED=NO
SALON_MANIFEST_DELETED=NO
PWA_ASSETS_DELETED=0
```

`public/manifest-empleado.json`, `public/manifest-salon.json` y todos
los íconos preservados sin cambio — en particular
`icon-empleado-192x192.png`/`icon-salon-192x192.png`, que siguen
teniendo consumidores Push activos (confirmado en A2, no re-verificado
en esta ronda documental).

## 9. Deuda opcional no bloqueante — explícitamente NO ejecutada

```text
T52_CLOSE_BLOCKER=NO
```

Quedan registrados como trabajo futuro, opcional, sin fecha, sin
bloquear este cierre: limpieza de las entradas "empleado"/"salon" en
`role-config.ts`, `icon-empleado-512x512.png`/`icon-salon-512x512.png`
(sin consumidor funcional), el endpoint `/api/manifest` sin callers, la
Fase 4 de Mozo (push target + Service Worker), y un eventual retiro de
`/mozo` sólo con evidencia futura de que ya no quedan instalaciones
legacy activas. Ninguno de estos ítems mantiene a T52 abierta por
limpieza estética/de disco.

## 10. Evidencia automatizada — preservada de R1B, no re-ejecutada

```text
FOCAL_TESTS=13 PASS / 0 FAIL
INSTALL_PROMPT_REGRESSION_TESTS=14 PASS / 0 FAIL

TSC_TOTAL_ERRORS=31
TSC_BASELINE_ERRORS=31
TSC_NEW_ERRORS=0

ESLINT=PASS
BUILD=PASS
DIFF_CHECK=PASS
```

Sin drift detectado desde R1B (mismo HEAD verificado en §3) — no se
re-ejecuta ninguna suite en este cierre documental.

## 11. Prevalidación técnica de R1B — preservada, distinta de la física

```text
/e/test = LegacyAccessRetired visible, sin banner/FAB de instalación
  (prevalidación técnica de Claude, Browser pane)
/s/test = LegacyAccessRetired visible, sin banner/FAB de instalación
/operaciones = T51 intacto
/mozo = comportamiento preexistente intacto
```

Esta prevalidación (realizada antes del deploy, en R1B) es distinta y
NO se confunde con la certificación física del operador registrada en
§4 de este documento.

## 12. Archivos certificados

```text
PRODUCT_FILES_CHANGED_IN_R1B=1 (src/components/shared/install-prompt.tsx)
TEST_FILES_CHANGED_IN_R1B=1 (src/components/shared/install-prompt.test.ts)
```

Durante este cierre documental:

```text
PRODUCT_FILES_CHANGED_DURING_CLOSEOUT=0
TEST_FILES_CHANGED_DURING_CLOSEOUT=0
API_FILES_CHANGED_DURING_CLOSEOUT=0
MANIFEST_FILES_CHANGED_DURING_CLOSEOUT=0
PWA_ASSET_FILES_CHANGED_DURING_CLOSEOUT=0
SERVICE_WORKER_CHANGED_DURING_CLOSEOUT=0
```

## 13. Invariantes preservados

```text
ROLE_CONFIG_CHANGED=NO
DYNAMIC_MANIFEST_CHANGED=NO
PUSH_CHANGED=NO
SERVICE_WORKER_CHANGED=NO
AUTH_CHANGED=NO
SESSION_CHANGED=NO
DB_MUTATED=NO
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
T38_FUNCTIONAL_SCOPE_TOUCHED=NO
```

## 14. Estado final T52

```text
P2_T52_AUDIT_COMPLETE=SI
P2_T52_IMPLEMENTATION_COMPLETE=SI
P2_T52_AUTOMATED_CERTIFICATION=PASS
P2_T52_PHYSICAL_CERTIFICATION=PASS

P2_T52_STATUS=CLOSED_TESTING_CERTIFIED

P2_T52_RELEASE_ELIGIBLE=YES

P2_T52_PRODUCTION_PROMOTED=NO
```

## 15. Production

```text
PRODUCTION_TOUCHED=NO
```

`origin/main` verificado sólo en lectura: `ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`
— checkpoint vigente sin cambios. No merge, no deploy Production, no
tag Production.

## 16. Otros estados — preservados sin cambios

```text
P2_T51_STATUS=CLOSED_TESTING_CERTIFIED
P2_T55_STATUS=CLOSED_TESTING_CERTIFIED
P2_T50_STATUS=CLOSED_TESTING_CERTIFIED
P2_T49_STATUS=CLOSED_TESTING_CERTIFIED
P2_T47_STATUS=CLOSED_TESTING_CERTIFIED
P2_T45_STATUS=CLOSED_TESTING_CERTIFIED
P2_T43_STATUS=CLOSED_TESTING_CERTIFIED
P2_T44_STATUS=PAUSED_UNRESOLVED_AFTER_TIMEBOX
P2_T46_ORIGINAL_STATUS=CLOSED_PRODUCTION
P2_T46_R2_STATUS=CLOSED_TESTING_CERTIFIED_AWAITING_PRODUCTION_PROMOTION
CLIENT_MESA_SILENT_DEFAULT_PAYMENT_FINDING=OPEN
T38_STATUS=READY_FUTURE
T40_STATUS=READY_FUTURE
T39_STATUS=READY_FUTURE
T39_TOUCHED=NO
```

## 17. Cierre

```text
PRODUCT_FILES_CHANGED_DURING_CLOSEOUT=0
TEST_FILES_CHANGED_DURING_CLOSEOUT=0
API_FILES_CHANGED_DURING_CLOSEOUT=0
MANIFEST_FILES_CHANGED_DURING_CLOSEOUT=0
PWA_ASSET_FILES_CHANGED_DURING_CLOSEOUT=0
SERVICE_WORKER_CHANGED_DURING_CLOSEOUT=0
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
DB_MUTATED=NO
REDEPLOY_PERFORMED=NO
PRODUCTION_TOUCHED=NO
```
