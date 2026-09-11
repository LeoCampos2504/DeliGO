# P2-POST-T46-R1 — Canonical backlog reconciliation

Fecha: 2026-09-11. Tipo: documentation-only.

## Baseline y causa del drift

R4 cerró correctamente T46 en Production, pero dejó `NEXT_RECOMMENDED_SOFTWARE_TASK=P2-T32`, aunque T32 ya estaba checkpointed en Production. Además, la sección anterior de `ROADMAP.md` conservaba snapshots previos donde T42 y T46 aún aparecían pendientes. Esta entrada y la nueva sección superior de `ROADMAP.md` superseden sólo esas recomendaciones/lecturas vigentes; los reportes históricos, incluido R4, no se reescriben.

```text
HEAD=testing-codex@c826e796d33de5d00f8efddf4fa258fb86587c6a
CURRENT_BRANCH=testing-codex
origin/testing-codex=c826e796d33de5d00f8efddf4fa258fb86587c6a
origin/main=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
CURRENT_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
CURRENT_T46_STABLE_TAG=p2-t46-stable-2026-09-11
CURRENT_T46_STABLE_TAG_PEELED_COMMIT=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
BACKLOG_AUTHORITY_BEFORE=STALE
BACKLOG_AUTHORITY_AFTER=RECONCILED_CURRENT
```

El preflight no detectó commits nuevos en `origin/testing-codex`, ni drift funcional. Production y su tag permanecen intactos.

## Cierres reconciliados

| Task | Current status | Production status | Latest authority | Active excluded |
|---|---|---|---|---|
| P2-T29 | CLOSED_PRODUCTION_CHECKPOINTED | checkpointed | P2_T29D_T29E_PROMOTE_TO_MAIN_AND_PRODUCTION.md | SI |
| P2-T30 | CLOSED_PRODUCTION_CHECKPOINTED | checkpointed | P2_T30_T32_PROMOTION_TO_MAIN_AND_PRODUCTION.md | SI |
| P2-T31 | CLOSED_TESTING_CERTIFIED | no checkpoint current | P2_T31_R21_FINAL_DIAGNOSTICS_DISPOSITION_AND_CLOSEOUT.md | SI |
| P2-T32 | CLOSED_PRODUCTION_CHECKPOINTED | checkpointed | P2_T30_T32_PROMOTION_TO_MAIN_AND_PRODUCTION.md | SI |
| P2-T35 | CLOSED_PRODUCTION_CHECKPOINTED | checkpointed | P2_T35_T36_PROMOTION_TO_MAIN_AND_PRODUCTION.md | SI |
| P2-T36 | CLOSED_PRODUCTION_CHECKPOINTED | checkpointed | P2_T35_T36_PROMOTION_TO_MAIN_AND_PRODUCTION.md | SI |
| P2-T41 | CLOSED_PRODUCTION_CHECKPOINTED | checkpointed | P2_T41_PROMOTION_TO_MAIN_AND_PRODUCTION.md | SI |
| P2-T42 | CLOSED_PRODUCTION | Production | P2_T42_R1_FORMAL_CLOSEOUT_AND_CURATED_PRODUCTION_PROMOTION.md | SI |
| P2-T46 | CLOSED_PRODUCTION | Production | P2_T46_R4_CURATED_PRODUCTION_PROMOTION.md | SI |
| P2-T48 | CLOSED_PRODUCTION | Production | P2_T48_R2_CURATED_PRODUCTION_PROMOTION.md | SI |

## Findings

`PREVIOUS_OCCUPATION_OPEN_ORDERS_SURFACE_IN_NEXT_OCCUPATION` queda
`RESOLVED_BY_P2_T46`: la superficie actual, la cuenta corriente y el historial
fueron aislados y certificados PASS. Esto no implica reconstrucción de legacy
NULL: `LEGACY_NULL_OCCUPATION_INFERENCE=NO`,
`LEGACY_NULL_OCCUPATION_BACKFILL=NO` y `LEGACY_ACCOUNTING_RECONSTRUCTION=NO`.

`NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG=CONFIRMED_PHYSICAL` continúa
`OPEN`, con datos correctos después de cerrar/reabrir y sin fix incluido en
T46. No tiene owner existente real. El siguiente ID libre tras grep completo
del backlog es `P2-T53`, formalizado como `Negocio Occupation Close Live
Refresh Parity`, `PRIORITY=TO_BE_TRIAGED`, `READY_FUTURE`. No desplaza P1.

## Tabla de backlog vigente

### Active / actionable

| Task | Title | Priority | Status | Dependencies / blockers | Actionable |
|---|---|---:|---|---|---|
| P2-T43 | Employee Join Identity + Admin Feedback | P1 | READY_FUTURE | no hard dependency; audit feedback/identity | SI |
| P2-T44 | Operaciones Personal Push UX + PyR Coverage | P1 | READY_FUTURE | audit Push coverage and mobile UX | SI |
| P2-T45 | Terminal Operations Notification Architecture | P1 | READY_FUTURE | audit existing Salón mechanism first | SI |
| P2-T49 | Terminal Mobile Shell + Chat Layout | P1 | READY_FUTURE | mobile shell/safe-area audit | SI |
| P2-T53 | Negocio Occupation Close Live Refresh Parity | TO_BE_TRIAGED | READY_FUTURE | root cause audit; no T46/T48 reopen | SI |
| P2-T47 | Operations Product Personalization UX | P2_UX | READY_FUTURE | confirm whether duplicate is real | SI |
| P2-T50 | Salon Statistics Custom Date Filtering | P2 | READY_FUTURE | audit existing from/to contract | SI |
| P2-T51 | DeliGO Operaciones Home Visual Redesign | P2_UX | READY_FUTURE | visual audit | SI |
| P2-T52 | Operations PWA Identity Consolidation / Legacy Artifact Cleanup | unassigned | READY_FUTURE | migrate active /mozo identity | SI |
| P2-T38 | PWA Installation UX | unassigned | READY_FUTURE | physical validation later | SI |
| P2-T40 | Push Session Lifecycle + Login Re-Enrollment | unassigned | READY_FUTURE | distinct from T44/T45 | SI |
| P2-T39 | Admin/SuperAdmin Functional Review | unassigned | READY_FUTURE | precedes T33 | SI |

### Blocked / operator or external

| Task | Status | Blocker | Actionable |
|---|---|---|---|
| P2-T02 | WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE | Android device and exterior evidence | NO |
| P2-T23 | FUTURE | depends on T02 | NO |
| P2-T24 | FUTURE | depends on T23 | NO |
| P2-T34 | READY_TO_START | Android hardware for physical isolation | NO |
| P2-T33 | READY_TO_START_AFTER_FUNCTIONAL_TASKS | T38/T40/T39 and prior functional work | NO |
| P2-T37 | FUTURE | prior backlog and launch gates | NO |

Support/Instagram remains `DEFERRED_TO_END_OF_CURRENT_BACKLOG`.

## Selección

```text
OPEN_P0_TASKS=0
OPEN_P1_HIGH_TASKS=0
OPEN_P1_TASKS=4
OPEN_P2_TASKS=3
OPEN_PRIORITY_UNSPECIFIED_TASKS=11
OPEN_PRIORITY_TRIAGE_REQUIRED_TASKS=1
ACTIONABLE_NOW_TASKS=12
BLOCKED_TASKS=6
DEFERRED_TASKS=1
NEXT_RECOMMENDED_SOFTWARE_TASK=P2-T43
NEXT_RECOMMENDED_SOFTWARE_TASK_TITLE=Employee Join Identity + Admin Feedback
NEXT_RECOMMENDED_SOFTWARE_TASK_PRIORITY=P1
NEXT_RECOMMENDED_SOFTWARE_TASK_REASON=Primer P1 accionable, sin dependencia dura, después de excluir todos los cierres y mantener T02/T34 bloqueadas por hardware. P2-T53 queda TO_BE_TRIAGED y no desplaza P1.
ALTERNATIVE_NEXT_TASK_1=P2-T44
ALTERNATIVE_NEXT_TASK_2=P2-T45
```

## Resultado y límites

```text
P2_T46_STATUS=CLOSED_PRODUCTION
P2_T48_STATUS=CLOSED_PRODUCTION
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T32_STATUS_CURRENT=CLOSED_PRODUCTION_CHECKPOINTED
P2_T32_ALREADY_PRODUCTION=SI
P2_T32_EXCLUDED_FROM_ACTIVE_BACKLOG=SI
R4_NEXT_TASK_P2_T32_VALID=NO
R4_NEXT_TASK_RECOMMENDATION_STATUS=SUPERSEDED_BY_POST_T46_BACKLOG_RECONCILIATION
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
P2_T02_SOFTWARE_ACTIONABLE_NOW=NO
NEGOCIO_REFRESH_EXISTING_TASK_OWNER=NONE
NEW_TASK_CREATED_FOR_NEGOCIO_REFRESH=SI
NEW_TASK_ID=P2-T53
DOCUMENTATION_CHANGED=SI
PRODUCT_FILES_CHANGED=0
TEST_FILES_CHANGED=0
PRISMA_FILES_CHANGED=0
MIGRATION_FILES_CHANGED=0
DB_MUTATION_OCCURRED=NO
FUNCTIONAL_TREE_CHANGED=NO
DIFF_CHECK_PASS=PENDING
DOC_RECONCILIATION_COMMIT=PENDING
DOC_PUSH_PERFORMED=PENDING
DOC_PUSH_TARGET=testing-codex
TESTING_AUTODEPLOY_TRIGGERED_BY_DOC_PUSH=PENDING
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
```
